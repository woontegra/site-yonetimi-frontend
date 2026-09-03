import { AUTH_COOKIE } from "@/lib/auth-cookie";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  tenantId?: string;
  tenantName?: string;
  isPlatformAdmin?: boolean;
  role?: string;
  permissions?: string[];
  allSites?: boolean;
  siteIds?: string[] | null;
};

export type SessionState = {
  token: string;
  refreshToken?: string | null;
  user: SessionUser;
};

const STORAGE_KEY = "sy_session";
/** Refresh süresiyle hizalı (~7 gün). */
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type SessionListener = () => void;

let memorySession: SessionState | null = null;
const listeners = new Set<SessionListener>();

function authCookieFlags(maxAge: number): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${AUTH_COOKIE}=`));
}

/** Middleware /app erişimi için cookie'yi yazar. */
export function ensureAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=1; ${authCookieFlags(AUTH_COOKIE_MAX_AGE)}`;
}

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySessionListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

function readStorage(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function readSession(): SessionState | null {
  if (memorySession) return memorySession;
  const stored = readStorage();
  memorySession = stored;
  return stored;
}

export function getAccessToken(): string | null {
  return readSession()?.token ?? null;
}

export function getRefreshToken(): string | null {
  return readSession()?.refreshToken ?? null;
}

export function writeSession(session: SessionState): void {
  const next: SessionState = {
    token: session.token,
    refreshToken: session.refreshToken ?? readSession()?.refreshToken ?? null,
    user: session.user,
  };
  memorySession = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    ensureAuthCookie();
  }
  notifySessionListeners();
}

export function updateSessionTokens(tokens: {
  token: string;
  refreshToken?: string | null;
}): SessionState | null {
  const current = readSession();
  if (!current) return null;
  writeSession({
    ...current,
    token: tokens.token,
    refreshToken: tokens.refreshToken ?? current.refreshToken ?? null,
  });
  return readSession();
}

export function clearSession(): void {
  memorySession = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${AUTH_COOKIE}=; ${authCookieFlags(0)}`;
  }
  notifySessionListeners();
}

/** JWT payload exp kontrolü (imza doğrulamaz; yalnızca bootstrap için). */
export function isAccessTokenExpired(token: string | null | undefined, skewSeconds = 30): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Kullanıcı";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
