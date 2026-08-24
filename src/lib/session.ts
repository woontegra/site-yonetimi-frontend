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
  document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax`;
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${AUTH_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Kullanıcı";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
