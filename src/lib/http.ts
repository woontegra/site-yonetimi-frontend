import {
  isAuthRefreshPath,
  redirectToLoginForExpiredSession,
  refreshAccessTokenSingleFlight,
} from "@/lib/auth-refresh";
import { API_URL, ApiError } from "@/lib/http-core";
import { getAccessToken } from "@/lib/session";

export { API_URL, ApiError };

type ApiRequestOptions = RequestInit & {
  token?: string | null;
  tenantId?: string | null;
  siteId?: string | null;
  /** Tek seferlik retry sonrası tekrar refresh deneme. */
  _retried?: boolean;
  /** Auth endpoint'lerinde refresh kapalı. */
  skipAuthRefresh?: boolean;
};

async function parsePayload(
  response: Response,
): Promise<{ message?: string; code?: string; details?: unknown }> {
  if (response.status === 204) return {};
  try {
    return (await response.json()) as { message?: string; code?: string; details?: unknown };
  } catch {
    return {};
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, tenantId, siteId, headers, _retried, skipAuthRefresh, ...rest } = options;
  const accessToken = token ?? getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
        ...(siteId ? { "X-Site-Id": siteId } : {}),
        ...headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, "İşlem iptal edildi.", "ABORTED");
    }
    throw new ApiError(0, "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parsePayload(response);

  if (response.status === 401 && !_retried && !skipAuthRefresh && !isAuthRefreshPath(path)) {
    const refreshed = await refreshAccessTokenSingleFlight();
    if (refreshed.ok) {
      return apiRequest<T>(path, {
        ...options,
        token: refreshed.token,
        _retried: true,
      });
    }
    if (refreshed.reason === "invalid" || refreshed.reason === "missing") {
      redirectToLoginForExpiredSession();
    }
    // network/server: oturumu silme
    throw new ApiError(
      refreshed.reason === "network" || refreshed.reason === "server" ? 0 : 401,
      refreshed.reason === "network" || refreshed.reason === "server"
        ? "Sunucuya bağlanılamadı. Lütfen tekrar deneyin."
        : (payload.message ?? "Oturumunuz sona erdi. Lütfen yeniden giriş yapın."),
    );
  }

  if (!response.ok) {
    const rawMessage = payload.message ?? "İşlem tamamlanamadı.";
    const code = payload.code;
    const preserve403 =
      typeof code === "string" &&
      (code.startsWith("LICENSE_") ||
        code === "FORBIDDEN_TENANT" ||
        code === "ORGANIZATION_CONTEXT_REQUIRED");
    const safeMessage =
      response.status >= 500
        ? "İşlem sırasında beklenmeyen bir hata oluştu. Lütfen yeniden deneyin."
        : response.status === 403 && !preserve403
          ? "Bu işlemi yapmaya yetkiniz bulunmuyor."
          : response.status === 401
            ? "Oturumunuz sona erdi. Lütfen yeniden giriş yapın."
            : rawMessage;
    throw new ApiError(response.status, safeMessage, payload.code, payload.details);
  }

  return payload as T;
}
