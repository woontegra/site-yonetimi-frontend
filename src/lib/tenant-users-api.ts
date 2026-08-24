import { apiRequest } from "@/lib/http";

export type TenantMember = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "INVITED" | "ACTIVE" | "DISABLED" | "EXPIRED";
  allSites: boolean;
  siteIds: string[] | null;
  siteNames: string[];
  permissions: string[];
  lastLoginAt: string | null;
  invitedAt: string;
  createdAt: string;
};

export type TenantUserCatalog = {
  roles: Array<{ value: string; label: string; permissions: string[] }>;
  groups: Array<{ id: string; label: string; items: Array<{ code: string; label: string }> }>;
  viewOf: Record<string, string>;
};

type Auth = { token: string; tenantId: string; siteId?: string | null };

export function listTenantUsers(auth: Auth) {
  return apiRequest<{
    summary: { total: number; active: number; invited: number; disabled: number };
    items: TenantMember[];
  }>("/api/tenant-users", { token: auth.token, tenantId: auth.tenantId, siteId: auth.siteId });
}

export function getTenantUserCatalog(auth: Auth) {
  return apiRequest<TenantUserCatalog>("/api/tenant-users/catalog", {
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
  });
}

export function inviteTenantUser(
  auth: Auth,
  body: {
    fullName: string;
    email: string;
    role: string;
    allSites: boolean;
    siteIds: string[];
    permissions: string[];
  },
) {
  return apiRequest<{
    membershipId: string;
    existingUser: boolean;
    invite: { status: string } | null;
  }>("/api/tenant-users", {
    method: "POST",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
    body: JSON.stringify(body),
  });
}

export function updateTenantUser(
  auth: Auth,
  id: string,
  body: { role?: string; allSites?: boolean; siteIds?: string[]; permissions?: string[] },
) {
  return apiRequest<{ ok: boolean }>(`/api/tenant-users/${id}`, {
    method: "PATCH",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
    body: JSON.stringify(body),
  });
}

export function resendTenantInvite(auth: Auth, id: string) {
  return apiRequest<{ invite: { status: string } }>(`/api/tenant-users/${id}/resend-invite`, {
    method: "POST",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
  });
}

export function setTenantUserStatus(auth: Auth, id: string, enabled: boolean) {
  return apiRequest<{ ok: boolean }>(`/api/tenant-users/${id}/${enabled ? "enable" : "disable"}`, {
    method: "POST",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
  });
}

export function removeTenantUser(auth: Auth, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/tenant-users/${id}`, {
    method: "DELETE",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
  });
}
