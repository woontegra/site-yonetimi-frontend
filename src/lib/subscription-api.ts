import { apiRequest } from "@/lib/http";

type Auth = { token: string; tenantId: string; siteId?: string | null };

export type TenantSubscriptionPlan = "DEMO" | "ANNUAL";
export type TenantSubscriptionStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

export type TenantSubscription = {
  plan: TenantSubscriptionPlan;
  status: TenantSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  remainingDays: number;
  readOnly?: boolean;
  isExpired?: boolean;
  version?: number;
  netPrice?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  grossPrice?: number | null;
  currency?: string | null;
};

export type LicenseAccess = {
  isPlatformAdmin: boolean;
  exempt: boolean;
  readOnly?: boolean;
  accountType: "PLATFORM_ADMIN" | "TENANT_USER";
  managementAccess: "UNLIMITED" | "SUBSCRIPTION_BOUND";
  licenseStatus: "EXEMPT" | "BOUND";
};

export type MyLicenseResponse = {
  access: LicenseAccess;
  organization?: { id: string; name: string } | null;
  licenseScope?: string;
  support?: { email: string | null; renewalUrl: string | null };
  subscription: TenantSubscription | null;
};

export const PLAN_LABELS: Record<TenantSubscriptionPlan, string> = {
  DEMO: "Demo",
  ANNUAL: "Yıllık",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<TenantSubscriptionStatus, string> = {
  ACTIVE: "Aktif",
  EXPIRED: "Süresi doldu",
  SUSPENDED: "Askıda",
  CANCELLED: "İptal edildi",
};

export function getMySubscription(auth: Auth) {
  return apiRequest<MyLicenseResponse>("/api/subscription/me", {
    token: auth.token,
    tenantId: auth.tenantId,
  });
}
