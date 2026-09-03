import { API_URL } from "@/lib/http-core";
import {
  clearSession,
  getRefreshToken,
  readSession,
  updateSessionTokens,
  writeSession,
  type SessionUser,
} from "@/lib/session";

export type RefreshResponse = {
  token: string;
  refreshToken: string;
  expiresIn?: number;
  user?: {
    id: string;
    email: string;
    fullName: string;
    isPlatformAdmin?: boolean;
    tenants?: Array<{
      id?: string;
      name: string;
      role?: string;
      permissions?: string[];
      allSites?: boolean;
      siteIds?: string[] | null;
    }>;
  };
};

export type RefreshResult =
  | { ok: true; token: string }
  | { ok: false; reason: "network" | "server" | "invalid" | "missing" };

let refreshPromise: Promise<RefreshResult> | null = null;
let redirectingToLogin = false;

function mapUser(user: NonNullable<RefreshResponse["user"]>, fallback?: SessionUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenants?.[0]?.id ?? fallback?.tenantId,
    tenantName: user.tenants?.[0]?.name ?? fallback?.tenantName,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
    role: user.tenants?.[0]?.role ?? fallback?.role,
    permissions: user.tenants?.[0]?.permissions ?? fallback?.permissions ?? [],
    allSites: user.tenants?.[0]?.allSites ?? fallback?.allSites ?? true,
    siteIds: user.tenants?.[0]?.siteIds ?? fallback?.siteIds ?? null,
  };
}

export function redirectToLoginForExpiredSession(): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  const path = window.location.pathname;
  if (path.startsWith("/giris") || path.startsWith("/login") || path.startsWith("/aktivasyon")) {
    return;
  }
  redirectingToLogin = true;
  clearSession();
  const next = `${path}${window.location.search}`;
  const params = new URLSearchParams();
  params.set("reason", "session_expired");
  if (next.startsWith("/app")) params.set("next", next);
  window.location.assign(`/giris?${params.toString()}`);
}

async function performRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return { ok: false, reason: "missing" };

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (response.status >= 500) {
    return { ok: false, reason: "server" };
  }

  if (!response.ok) {
    return { ok: false, reason: "invalid" };
  }

  let payload: RefreshResponse;
  try {
    payload = (await response.json()) as RefreshResponse;
  } catch {
    return { ok: false, reason: "server" };
  }

  if (!payload.token || !payload.refreshToken) {
    return { ok: false, reason: "invalid" };
  }

  const current = readSession();
  if (payload.user) {
    writeSession({
      token: payload.token,
      refreshToken: payload.refreshToken,
      user: mapUser(payload.user, current?.user),
    });
  } else {
    updateSessionTokens({
      token: payload.token,
      refreshToken: payload.refreshToken,
    });
  }

  return { ok: true, token: payload.token };
}

/**
 * Tek uçuşlu refresh: eşzamanlı 401'lerde yalnızca bir /refresh çağrısı.
 */
export function refreshAccessTokenSingleFlight(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function isAuthRefreshPath(path: string): boolean {
  return (
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/refresh") ||
    path.startsWith("/api/auth/logout") ||
    path.startsWith("/api/auth/activation") ||
    path.startsWith("/api/auth/activate") ||
    path.startsWith("/api/auth/preview-session")
  );
}
