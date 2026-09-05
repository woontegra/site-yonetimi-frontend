import { apiRequest, ApiError } from "@/lib/http";

type AdminAuth = { token: string };

export type AdminSubscription = {
  id: string;
  plan: "DEMO" | "ANNUAL";
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  storedStatus?: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  remainingDays: number;
  note: string | null;
  updatedAt?: string;
  netPrice?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  grossPrice?: number | null;
  currency?: string | null;
  readOnly?: boolean;
  isExpired?: boolean;
  version?: number;
};

export type AdminSubscriptionSummary = {
  total?: number;
  activeDemo?: number;
  activeAnnual?: number;
  expiringSoon?: number;
  expired?: number;
  suspended?: number;
  cancelled?: number;
  withoutLicense?: number;
  // FE fallback aliases
  demo?: number;
  annual?: number;
  active?: number;
  expiring?: number;
  none?: number;
  demoActive?: number;
  annualActive?: number;
};

export type AdminSubscriptionHistoryItem = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  adminUser: { id: string; fullName: string; email: string } | null;
  metadata?: unknown;
};

export type AdminOwner = { id: string; fullName: string; email: string } | null;

export type AdminPaged<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
};

export type AdminOverview = {
  metrics: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants?: number;
    totalSites: number;
    totalApartments: number;
    totalUsers: number;
    activeUsers?: number;
    inactiveUsers?: number;
    usersActive30d?: number;
    trialSubscriptions: number;
    activeSubscriptions: number;
    expiredSubscriptions?: number;
    suspendedSubscriptions?: number;
    whatsappConnected: number;
    whatsappError?: number;
    expiringSubscriptions: number;
    expiringCritical7d?: number;
    tenantsWithoutUsers?: number;
    tenantsWithoutSubscription?: number;
    failedEmailDeliveries?: number;
    failedMessages?: number;
  };
  alerts?: Array<{
    code: string;
    severity: "warning" | "danger";
    title: string;
    description: string;
    href: string;
    count: number;
  }>;
  recentTenants: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    subscription: AdminSubscription | null;
  }>;
  expiringSubscriptions: Array<AdminSubscription & { tenant: { id: string; name: string; isActive: boolean } }>;
  criticalExpiring?: Array<AdminSubscription & { tenant: { id: string; name: string; isActive: boolean } }>;
  expiredButActive?: Array<AdminSubscription & { tenant: { id: string; name: string; isActive: boolean } }>;
  errorIntegrations: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    connectionStatus: string;
    lastCheckedAt: string | null;
  }>;
  failedMessages: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    siteId: string;
    siteName: string;
    status: string;
    provider: string | null;
    channel: string;
    createdAt: string;
  }>;
};

export type AdminTenantListItem = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  owner: AdminOwner;
  siteCount: number;
  apartmentCount: number;
  userCount: number;
  subscription: AdminSubscription | null;
};

export type AdminTenantDetail = AdminTenantListItem & {
  updatedAt: string;
  isProtected?: boolean;
  whatsapp: {
    id: string;
    connectionStatus: string;
    wabaLinked: boolean;
    displayPhoneNumber: string | null;
    lastCheckedAt: string | null;
  } | null;
  email?: { connected: boolean; status: string | null };
  integrationSummary?: {
    whatsappConnected: boolean;
    emailConnected: boolean;
    connectedCount: number;
  };
  usage: { sites: number; apartments: number; users: number; persons: number; messages: number };
  recordCounts?: {
    sites: number;
    buildings: number;
    apartments: number;
    users: number;
    persons: number;
    debts: number;
    payments: number;
    expenses: number;
    integrations: number;
  };
};

export type AdminUserListItem = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isPlatformAdmin?: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: string | null;
  tenant: { id: string; name: string; isActive: boolean } | null;
  subscription: AdminSubscription | null;
};

export type AdminUserMembership = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantIsActive: boolean;
  role: string;
  status: string;
  allSites: boolean;
  invitedAt: string | null;
  createdAt: string;
  siteAccesses: Array<{ siteId: string; siteName: string; isActive: boolean }>;
};

export type AdminUserDetail = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isPlatformAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: string | null;
  membershipStatus: string | null;
  activationPending: boolean;
  activationExpiresAt: string | null;
  interventionStatus: "normal" | "passive" | "activation_pending" | "org_blocked";
  accessBlocks: string[];
  tenant: { id: string; name: string; isActive: boolean; siteCount: number } | null;
  subscription: AdminSubscription | null;
  licenseScope: "organization";
  memberships: AdminUserMembership[];
  primaryAccess: {
    membershipId: string;
    allSites: boolean;
    siteCount: number;
    sites: Array<{ siteId: string; siteName: string; isActive: boolean }>;
    primarySiteName: string | null;
  } | null;
  usage: {
    tenantSites: number;
    tenantMessages: number;
    activityLast30d: number;
    failedEmails: number;
  };
};

export type AdminUserActivityItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  result: "success";
};

export type AdminUserCommunicationItem = {
  id: string;
  channel: "EMAIL";
  type: string;
  subject: string;
  status: string;
  recipientEmail: string;
  errorCode: string | null;
  errorSummary: string | null;
  createdAt: string;
  sentAt: string | null;
  attemptCount: number;
};

export type AdminUserDeletePreview = {
  user: { id: string; fullName: string; email: string };
  canDelete: boolean;
  blockers: string[];
  counts: Record<string, number>;
};

export type AdminSiteListItem = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  isActive: boolean;
  setupStatus: string;
  createdAt: string;
  tenant: { id: string; name: string; isActive: boolean };
  buildingCount: number;
  apartmentCount: number;
  residentCount: number;
};

export type AdminSiteDetail = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  isActive: boolean;
  setupStatus: string;
  setupCompletedAt: string | null;
  createdAt: string;
  tenant: { id: string; name: string; isActive: boolean };
  counts: {
    buildings: number;
    apartments: number;
    residents: number;
    insideVisitors: number;
    assets: number;
  };
};

export type AdminSubscriptionListItem = AdminSubscription & {
  tenant: { id: string; name: string; isActive: boolean; siteCount: number };
};

export type AdminIntegrationListItem = {
  id: string;
  tenant: { id: string; name: string; isActive: boolean };
  connectionStatus: string;
  wabaLinked: boolean;
  displayPhoneNumber: string | null;
  templateCount: number;
  approvedTemplateCount: number;
  lastSyncedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

export type AdminMessageListItem = {
  id: string;
  tenant: { id: string; name: string };
  site: { id: string; name: string };
  channel: string;
  status: string;
  provider: string | null;
  toPhoneMasked: string;
  createdAt: string;
  sentAt: string | null;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  tenantId: string | null;
  metadata: unknown;
  createdAt: string;
  adminUser: { id: string; fullName: string; email: string };
  tenant: { id: string; name: string } | null;
};

export type AdminNote = {
  id: string;
  content: string;
  createdAt: string;
  adminUser: { id: string; fullName: string; email: string };
};

export type AdminSystemStatus = {
  api: { status: string };
  database: { reachable: boolean };
  environment: string;
  whatsappProviderMode: string;
  emailProviderMode?: string;
  encryption?: {
    emailProviderMode: string;
    encryptUses: string | null;
    keys: Array<{
      name: string;
      present: boolean;
      length: number;
      wrappingQuotes: boolean;
      leadingOrTrailingWhitespace: boolean;
      containsNewline: boolean;
      fingerprint: string | null;
    }>;
  };
  lastMigration: { name: string; finishedAt: string | null } | null;
  integrations: { whatsappTotal: number; whatsappConnected: number; whatsappError: number };
};

function qs(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function getAdminOverview(auth: AdminAuth) {
  return apiRequest<AdminOverview>("/api/admin/overview", auth);
}

export function listAdminTenants(
  auth: AdminAuth,
  params: { page?: number; perPage?: number; search?: string; filter?: string },
) {
  return apiRequest<AdminPaged<AdminTenantListItem>>(`/api/admin/tenants${qs(params)}`, auth);
}

export function getAdminTenant(auth: AdminAuth, id: string) {
  return apiRequest<{ tenant: AdminTenantDetail }>(`/api/admin/tenants/${id}`, auth);
}

export function listAdminTenantSites(auth: AdminAuth, id: string) {
  return apiRequest<{ items: AdminSiteListItem[] }>(`/api/admin/tenants/${id}/sites`, auth);
}

export function listAdminTenantUsers(auth: AdminAuth, id: string) {
  return apiRequest<{ items: AdminUserListItem[] }>(`/api/admin/tenants/${id}/users`, auth);
}

export function listAdminTenantNotes(auth: AdminAuth, id: string) {
  return apiRequest<{ items: AdminNote[] }>(`/api/admin/tenants/${id}/notes`, auth);
}

export function createAdminTenantNote(auth: AdminAuth, id: string, content: string) {
  return apiRequest<{ note: AdminNote }>(`/api/admin/tenants/${id}/notes`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function activateAdminTenant(auth: AdminAuth, id: string) {
  return apiRequest(`/api/admin/tenants/${id}/activate`, { ...auth, method: "POST" });
}

export function deactivateAdminTenant(auth: AdminAuth, id: string) {
  return apiRequest(`/api/admin/tenants/${id}/deactivate`, { ...auth, method: "POST" });
}

export function deleteAdminTenant(auth: AdminAuth, id: string, confirmName: string) {
  return apiRequest<{ message: string }>(`/api/admin/tenants/${id}`, {
    ...auth,
    method: "DELETE",
    body: JSON.stringify({ confirmName }),
  });
}

export function extendAdminTenantSubscription(
  auth: AdminAuth,
  id: string,
  body: { days?: number; endsAt?: string; plan?: string; reason: string },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/tenants/${id}/subscription/extend`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function trialAdminTenantSubscription(auth: AdminAuth, id: string, days: number, reason: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/tenants/${id}/subscription/trial`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ days, reason }),
  });
}

export function listAdminTenantAuditLogs(auth: AdminAuth, id: string, params?: { page?: number; perPage?: number }) {
  return apiRequest<AdminPaged<AdminAuditLog>>(`/api/admin/tenants/${id}/audit-logs${qs(params ?? {})}`, auth);
}

export function getAdminUserSummary(auth: AdminAuth) {
  return apiRequest<{ total: number; active: number; inactive: number; trial: number }>(
    "/api/admin/users/summary",
    auth,
  );
}

export function listAdminUsers(
  auth: AdminAuth,
  params: { page?: number; perPage?: number; search?: string; status?: string; tenantId?: string },
) {
  return apiRequest<AdminPaged<AdminUserListItem>>(`/api/admin/users${qs(params)}`, auth);
}

export function getAdminUser(auth: AdminAuth, id: string) {
  return apiRequest<{ user: AdminUserDetail }>(`/api/admin/users/${id}`, auth);
}

export function updateAdminUser(auth: AdminAuth, id: string, body: { fullName: string }) {
  return apiRequest<{ user: { id: string; fullName: string; email: string } }>(`/api/admin/users/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateAdminUserAccess(
  auth: AdminAuth,
  id: string,
  body: { membershipId: string; role?: string; allSites?: boolean; siteIds?: string[] },
) {
  return apiRequest<{ ok: true }>(`/api/admin/users/${id}/access`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listAdminUserAccess(auth: AdminAuth, id: string) {
  return apiRequest<{
    memberships: AdminUserMembership[];
    primaryAccess: AdminUserDetail["primaryAccess"];
  }>(`/api/admin/users/${id}/access`, auth);
}

export function listAdminUserTenantSites(auth: AdminAuth, id: string) {
  return apiRequest<{ items: Array<{ id: string; name: string; isActive: boolean }> }>(
    `/api/admin/users/${id}/tenant-sites`,
    auth,
  );
}

export function listAdminUserActivity(
  auth: AdminAuth,
  id: string,
  params?: { page?: number; perPage?: number; search?: string },
) {
  return apiRequest<AdminPaged<AdminUserActivityItem> & { coverageNote?: string }>(
    `/api/admin/users/${id}/activity${qs(params ?? {})}`,
    auth,
  );
}

export function listAdminUserCommunications(
  auth: AdminAuth,
  id: string,
  params?: { page?: number; perPage?: number },
) {
  return apiRequest<AdminPaged<AdminUserCommunicationItem>>(
    `/api/admin/users/${id}/communications${qs(params ?? {})}`,
    auth,
  );
}

export function listAdminUserNotes(auth: AdminAuth, id: string) {
  return apiRequest<{
    items: AdminNote[];
    scope: "organization" | "none";
    note?: string;
  }>(`/api/admin/users/${id}/notes`, auth);
}

export function activateAdminUser(auth: AdminAuth, id: string) {
  return apiRequest(`/api/admin/users/${id}/activate`, { ...auth, method: "POST" });
}

export function deactivateAdminUser(auth: AdminAuth, id: string, reason: string) {
  return apiRequest(`/api/admin/users/${id}/deactivate`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function previewAdminUserDelete(auth: AdminAuth, id: string) {
  return apiRequest<AdminUserDeletePreview>(`/api/admin/users/${id}/delete-preview`, auth);
}

export function deleteAdminUser(auth: AdminAuth, id: string, body: { reason: string; confirmEmail: string }) {
  return apiRequest<{ message: string }>(`/api/admin/users/${id}`, {
    ...auth,
    method: "DELETE",
    body: JSON.stringify(body),
  });
}

export function createAdminUserNote(auth: AdminAuth, id: string, content: string) {
  return apiRequest<{ note: AdminNote }>(`/api/admin/users/${id}/notes`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function listAdminUserAuditLogs(auth: AdminAuth, id: string, params?: { page?: number; perPage?: number }) {
  return apiRequest<AdminPaged<AdminAuditLog>>(`/api/admin/users/${id}/audit-logs${qs(params ?? {})}`, auth);
}

export function listAdminSites(
  auth: AdminAuth,
  params: { page?: number; perPage?: number; search?: string; status?: string; setupStatus?: string; city?: string; tenantId?: string },
) {
  return apiRequest<AdminPaged<AdminSiteListItem>>(`/api/admin/sites${qs(params)}`, auth);
}

export function getAdminSite(auth: AdminAuth, id: string) {
  return apiRequest<{ site: AdminSiteDetail }>(`/api/admin/sites/${id}`, auth);
}

export function listAdminSubscriptions(
  auth: AdminAuth,
  params: { page?: number; perPage?: number; search?: string; status?: string; plan?: string; filter?: string },
) {
  return apiRequest<AdminPaged<AdminSubscriptionListItem>>(`/api/admin/subscriptions${qs(params)}`, auth);
}

export async function getAdminSubscriptionSummary(auth: AdminAuth): Promise<AdminSubscriptionSummary> {
  try {
    return await apiRequest<AdminSubscriptionSummary>("/api/admin/subscriptions/summary", auth);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      const list = await listAdminSubscriptions(auth, { page: 1, perPage: 200 });
      return summarizeSubscriptions(list.items);
    }
    throw err;
  }
}

function summarizeSubscriptions(items: AdminSubscriptionListItem[]): AdminSubscriptionSummary {
  const summary: AdminSubscriptionSummary = {
    total: items.length,
    demo: 0,
    annual: 0,
    active: 0,
    expiring: 0,
    expired: 0,
    suspended: 0,
    cancelled: 0,
    none: 0,
    demoActive: 0,
    annualActive: 0,
  };
  for (const item of items) {
    if (item.plan === "DEMO") {
      summary.demo = (summary.demo ?? 0) + 1;
      if (item.status === "ACTIVE") summary.demoActive = (summary.demoActive ?? 0) + 1;
    }
    if (item.plan === "ANNUAL") {
      summary.annual = (summary.annual ?? 0) + 1;
      if (item.status === "ACTIVE") summary.annualActive = (summary.annualActive ?? 0) + 1;
    }
    if (item.status === "ACTIVE") {
      summary.active = (summary.active ?? 0) + 1;
      if (item.remainingDays >= 0 && item.remainingDays <= 30) {
        summary.expiring = (summary.expiring ?? 0) + 1;
      }
    } else if (item.status === "EXPIRED") summary.expired = (summary.expired ?? 0) + 1;
    else if (item.status === "SUSPENDED") summary.suspended = (summary.suspended ?? 0) + 1;
    else if (item.status === "CANCELLED") summary.cancelled = (summary.cancelled ?? 0) + 1;
  }
  return summary;
}

export function getAdminSubscriptionDetail(auth: AdminAuth, tenantId: string) {
  return apiRequest<{ subscription: AdminSubscription; tenant: { id: string; name: string; isActive: boolean } }>(
    `/api/admin/subscriptions/${tenantId}`,
    auth,
  );
}

export function listAdminSubscriptionHistory(
  auth: AdminAuth,
  tenantId: string,
  params?: { page?: number; perPage?: number },
) {
  return apiRequest<AdminPaged<AdminSubscriptionHistoryItem>>(
    `/api/admin/subscriptions/${tenantId}/history${qs(params ?? {})}`,
    auth,
  );
}

export function startAdminDemo(
  auth: AdminAuth,
  tenantId: string,
  body: { days?: number; reason: string },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/demo/start`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function extendAdminDemo(
  auth: AdminAuth,
  tenantId: string,
  body: { days: number; reason: string; expectedVersion?: number },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/demo/extend`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function convertAdminAnnual(
  auth: AdminAuth,
  tenantId: string,
  body: { reason: string; netPrice?: number; paymentNote?: string },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/convert-annual`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startAdminAnnual(
  auth: AdminAuth,
  tenantId: string,
  body: { reason: string; netPrice?: number; endsAt?: string },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/annual/start`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function renewAdminAnnual(
  auth: AdminAuth,
  tenantId: string,
  body: { reason: string; paymentNote?: string },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/annual/renew`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function cancelAdminSubscription(auth: AdminAuth, tenantId: string, reason: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/cancel`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Prefer demo extend for day-based extensions; endsAt still uses legacy extend. */
export function extendAdminSubscription(
  auth: AdminAuth,
  tenantId: string,
  body: { days?: number; endsAt?: string; reason: string; expectedVersion?: number },
) {
  if (body.days != null && body.endsAt == null) {
    return extendAdminDemo(auth, tenantId, {
      days: body.days,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
    });
  }
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/extend`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** ANNUAL plan change maps to convert-annual; other plans use legacy plan endpoint. */
export function changeAdminSubscriptionPlan(
  auth: AdminAuth,
  tenantId: string,
  plan: string,
  reason: string,
) {
  if (plan === "ANNUAL") {
    return convertAdminAnnual(auth, tenantId, { reason });
  }
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/plan`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ plan, reason }),
  });
}

export function suspendAdminSubscription(auth: AdminAuth, tenantId: string, reason: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/suspend`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function reactivateAdminSubscription(auth: AdminAuth, tenantId: string, reason: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/reactivate`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listAdminIntegrations(
  auth: AdminAuth,
  params: { page?: number; perPage?: number; search?: string; status?: string },
) {
  return apiRequest<AdminPaged<AdminIntegrationListItem>>(`/api/admin/integrations${qs(params)}`, auth);
}

export function getAdminIntegration(auth: AdminAuth, id: string) {
  return apiRequest<{ integration: AdminIntegrationListItem & { tokenLastFour?: string | null; apiVersion?: string; isActive?: boolean } }>(
    `/api/admin/integrations/${id}`,
    auth,
  );
}

export function listAdminCommunications(
  auth: AdminAuth,
  params: {
    page?: number;
    perPage?: number;
    tenantId?: string;
    siteId?: string;
    provider?: string;
    status?: string;
    from?: string;
    to?: string;
  },
) {
  return apiRequest<AdminPaged<AdminMessageListItem> & { summary: { sent: number; delivered: number; read: number; failed: number } }>(
    `/api/admin/communications${qs(params)}`,
    auth,
  );
}

export function getAdminCommunication(auth: AdminAuth, id: string) {
  return apiRequest<{
    message: AdminMessageListItem & { template: string; errorSummary: string | null; errorAt: string | null };
  }>(`/api/admin/communications/${id}`, auth);
}

export function getAdminSystem(auth: AdminAuth) {
  return apiRequest<AdminSystemStatus>("/api/admin/system", auth);
}

export function listAdminAuditLogs(
  auth: AdminAuth,
  params: {
    page?: number;
    perPage?: number;
    search?: string;
    tenantId?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
  },
) {
  return apiRequest<AdminPaged<AdminAuditLog>>(`/api/admin/audit-logs${qs(params)}`, auth);
}

export type AdminTenantStatsItem = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  siteCount: number;
  buildingCount: number;
  apartmentCount: number;
  userCount: number;
  lastLoginAt: string | null;
  activeUsers7d: number;
  activeUsers30d: number;
  subscription: AdminSubscription | null;
  usageFlags: {
    hasDebts: boolean;
    hasPayments: boolean;
    hasBankImport: boolean;
    whatsappConnected: boolean;
    whatsappStatus: string | null;
  };
};

export function listAdminTenantStats(
  auth: AdminAuth,
  params: { page?: number; perPage?: number; search?: string } = {},
) {
  return apiRequest<AdminPaged<AdminTenantStatsItem>>(`/api/admin/tenant-stats${qs(params)}`, auth);
}

export type PlatformEmailIntegration = {
  id: string;
  providerType: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "SSL_TLS" | "STARTTLS";
  smtpUsername: string;
  hasPassword: boolean;
  passwordDecryptable?: boolean;
  isActive: boolean;
  status: "UNCONFIGURED" | "READY" | "ERROR" | "INACTIVE";
  publicStatus: "READY" | "UNCONFIGURED" | "ERROR" | "INACTIVE";
  publicLabel: string;
  lastTestedAt: string | null;
  lastSuccessfulAt: string | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  notificationEmail: string;
  updatedAt: string;
  securityWarning: string | null;
};

export type EmailDelivery = {
  id: string;
  type: "TENANT_WELCOME_ACTIVATION" | "PLATFORM_NEW_TENANT_NOTIFICATION" | "SMTP_TEST" | string;
  recipientEmailMasked: string;
  recipientName: string | null;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED" | string;
  attempts: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  safeErrorCode: string | null;
  safeErrorSummary: string | null;
  relatedTenantId: string | null;
  relatedUserId: string | null;
  relatedTenantName: string | null;
  createdAt: string;
};

export type CreateAdminTenantResult = {
  tenant: AdminTenantDetail;
  emails: {
    welcome: EmailDelivery | null;
    platformNotification: EmailDelivery | null;
  };
};

export type EmailInviteResult = {
  welcome: EmailDelivery | null;
  platformNotification: EmailDelivery | null;
  managerEmailMasked?: string;
};

export function createAdminTenant(
  auth: AdminAuth,
  body: {
    name: string;
    managerFullName: string;
    managerEmail: string;
    plan: "DEMO" | "ANNUAL";
    trialDays?: number;
    annualDays?: number;
    endsAt?: string;
  },
) {
  return apiRequest<CreateAdminTenantResult>("/api/admin/tenants", {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAdminEmailIntegration(auth: AdminAuth) {
  return apiRequest<{ integration: PlatformEmailIntegration | null }>("/api/admin/email-integration", auth);
}

export function upsertAdminEmailIntegration(
  auth: AdminAuth,
  body: {
    senderName: string;
    senderEmail: string;
    replyToEmail?: string | null;
    smtpHost: string;
    smtpPort: number;
    smtpSecurity: "SSL_TLS" | "STARTTLS";
    smtpUsername: string;
    smtpPassword?: string;
    notificationEmail: string;
    isActive: boolean;
  },
) {
  return apiRequest<{
    integration: PlatformEmailIntegration;
    securityWarning: string | null;
    passwordUpdated?: boolean;
  }>(
    "/api/admin/email-integration",
    { ...auth, method: "PUT", body: JSON.stringify(body) },
  );
}

export function setAdminEmailActive(auth: AdminAuth, isActive: boolean) {
  return apiRequest<{ integration: PlatformEmailIntegration }>("/api/admin/email-integration/set-active", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ isActive }),
  });
}

export function testAdminEmailConnection(auth: AdminAuth) {
  return apiRequest<{ ok: boolean; integration: PlatformEmailIntegration }>(
    "/api/admin/email-integration/test-connection",
    { ...auth, method: "POST" },
  );
}

export function sendAdminEmailTest(auth: AdminAuth, recipientEmail?: string) {
  return apiRequest<{ delivery: EmailDelivery }>("/api/admin/email-integration/test-send", {
    ...auth,
    method: "POST",
    body: JSON.stringify(recipientEmail ? { recipientEmail } : {}),
  });
}

export function listAdminEmailDeliveries(
  auth: AdminAuth,
  params: {
    page?: number;
    perPage?: number;
    status?: string;
    type?: string;
    tenantId?: string;
    from?: string;
    to?: string;
  },
) {
  return apiRequest<AdminPaged<EmailDelivery>>(`/api/admin/email-deliveries${qs(params)}`, auth);
}

export function retryAdminEmailDelivery(auth: AdminAuth, id: string) {
  return apiRequest<EmailInviteResult & { id?: string; status?: string }>(`/api/admin/email-deliveries/${id}/retry`, {
    ...auth,
    method: "POST",
  });
}

export function resendAdminUserInvite(auth: AdminAuth, userId: string) {
  return apiRequest<EmailInviteResult>(`/api/admin/users/${userId}/resend-invite`, {
    ...auth,
    method: "POST",
  });
}

export function resendAdminTenantNotification(auth: AdminAuth, tenantId: string) {
  return apiRequest<EmailInviteResult>(`/api/admin/tenants/${tenantId}/resend-notification`, {
    ...auth,
    method: "POST",
  });
}
