import { apiRequest } from "@/lib/http";

type AdminAuth = { token: string };

export type AdminSubscription = {
  id: string;
  plan: "DEMO" | "STANDARD" | "PROFESSIONAL";
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  remainingDays: number;
  note: string | null;
  updatedAt?: string;
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
    totalSites: number;
    totalApartments: number;
    totalUsers: number;
    trialSubscriptions: number;
    activeSubscriptions: number;
    whatsappConnected: number;
    expiringSubscriptions: number;
  };
  recentTenants: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    subscription: AdminSubscription | null;
  }>;
  expiringSubscriptions: Array<AdminSubscription & { tenant: { id: string; name: string; isActive: boolean } }>;
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
  lastLoginAt: string | null;
  createdAt: string;
  role: string | null;
  tenant: { id: string; name: string; isActive: boolean } | null;
  subscription: AdminSubscription | null;
};

export type AdminUserDetail = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: string | null;
  tenant: { id: string; name: string; isActive: boolean; siteCount: number } | null;
  subscription: AdminSubscription | null;
  memberships: Array<{ tenantId: string; tenantName: string; role: string }>;
  usage: { sites: number; messages: number };
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
  body: { days?: number; endsAt?: string; plan?: string },
) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/tenants/${id}/subscription/extend`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function trialAdminTenantSubscription(auth: AdminAuth, id: string, days: number) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/tenants/${id}/subscription/trial`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ days }),
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

export function activateAdminUser(auth: AdminAuth, id: string) {
  return apiRequest(`/api/admin/users/${id}/activate`, { ...auth, method: "POST" });
}

export function deactivateAdminUser(auth: AdminAuth, id: string) {
  return apiRequest(`/api/admin/users/${id}/deactivate`, { ...auth, method: "POST" });
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
  params: { page?: number; perPage?: number; search?: string; status?: string },
) {
  return apiRequest<AdminPaged<AdminSubscriptionListItem>>(`/api/admin/subscriptions${qs(params)}`, auth);
}

export function extendAdminSubscription(auth: AdminAuth, tenantId: string, body: { days?: number; endsAt?: string }) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/extend`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function changeAdminSubscriptionPlan(auth: AdminAuth, tenantId: string, plan: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/plan`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export function suspendAdminSubscription(auth: AdminAuth, tenantId: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/suspend`, {
    ...auth,
    method: "POST",
  });
}

export function reactivateAdminSubscription(auth: AdminAuth, tenantId: string) {
  return apiRequest<{ subscription: AdminSubscription }>(`/api/admin/subscriptions/${tenantId}/reactivate`, {
    ...auth,
    method: "POST",
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
  params: { page?: number; perPage?: number; search?: string; tenantId?: string; action?: string },
) {
  return apiRequest<AdminPaged<AdminAuditLog>>(`/api/admin/audit-logs${qs(params)}`, auth);
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
    plan: "DEMO" | "STANDARD" | "PROFESSIONAL";
    trialDays: number;
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
  return apiRequest<{ integration: PlatformEmailIntegration; securityWarning: string | null }>(
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
