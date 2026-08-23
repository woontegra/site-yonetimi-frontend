const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiRequestOptions = RequestInit & {
  token?: string | null;
  tenantId?: string | null;
  siteId?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, tenantId, siteId, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
        ...(siteId ? { "X-Site-Id": siteId } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, "Sunucuya bağlanılamadı. API ve veritabanının çalıştığını kontrol edin.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: { message?: string } = {};
  try {
    payload = (await response.json()) as { message?: string };
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload.message ?? "İşlem tamamlanamadı.");
  }

  return payload as T;
}

export { API_URL };
