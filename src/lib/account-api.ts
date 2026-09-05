import { apiRequest } from "@/lib/http";
import type { SessionUser } from "@/lib/session";

type Auth = { token: string };

export type AccountUser = {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    permissions: string[];
    allSites: boolean;
    siteIds: string[] | null;
  }>;
};

export function updateMyProfile(auth: Auth, payload: { fullName: string }) {
  return apiRequest<{ user: AccountUser }>("/api/auth/me", {
    token: auth.token,
    method: "PATCH",
    body: JSON.stringify(payload),
    skipAuthRefresh: false,
  });
}

export function changeMyPassword(
  auth: Auth,
  payload: { currentPassword: string; newPassword: string; confirmPassword: string },
) {
  return apiRequest<{ ok: boolean }>("/api/auth/change-password", {
    token: auth.token,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** API PublicUser → oturumdaki SessionUser alanları (tenant bağlamı korunur). */
export function mergeAccountUserIntoSession(
  current: SessionUser,
  account: AccountUser,
): SessionUser {
  const tenant =
    account.tenants.find((item) => item.id === current.tenantId) ?? account.tenants[0] ?? null;
  return {
    ...current,
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    isPlatformAdmin: account.isPlatformAdmin,
    tenantId: tenant?.id ?? current.tenantId,
    tenantName: tenant?.name ?? current.tenantName,
    role: tenant?.role ?? current.role,
    permissions: tenant?.permissions ?? current.permissions,
    allSites: tenant?.allSites ?? current.allSites,
    siteIds: tenant?.siteIds ?? current.siteIds,
  };
}
