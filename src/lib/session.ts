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
  user: SessionUser;
};

const STORAGE_KEY = "sy_session";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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

export function readSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function writeSession(session: SessionState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  ensureAuthCookie();
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${AUTH_COOKIE}=; ${authCookieFlags(0)}`;
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Kullanıcı";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
