import { apiRequest } from "@/lib/http";

type Auth = { token: string; tenantId: string; siteId?: string | null };

export type TenantSubscriptionPlan = "DEMO" | "STANDARD" | "PROFESSIONAL";
export type TenantSubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

export type TenantSubscription = {
  plan: TenantSubscriptionPlan;
  status: TenantSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  trialEndsAt: string | null;
  remainingDays: number;
};

export type LicenseAccess = {
  isPlatformAdmin: boolean;
  exempt: boolean;
  accountType: "PLATFORM_ADMIN" | "TENANT_USER";
  managementAccess: "UNLIMITED" | "SUBSCRIPTION_BOUND";
  licenseStatus: "EXEMPT" | "BOUND";
};

export const PLAN_LABELS: Record<TenantSubscriptionPlan, string> = {
  DEMO: "Demo",
  STANDARD: "Standart",
  PROFESSIONAL: "Profesyonel",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<TenantSubscriptionStatus, string> = {
  TRIAL: "Deneme",
  ACTIVE: "Aktif",
  EXPIRED: "Süresi doldu",
  SUSPENDED: "Askıda",
  CANCELLED: "İptal edildi",
};

export function getMySubscription(auth: Auth) {
  return apiRequest<{ access: LicenseAccess; subscription: TenantSubscription | null }>(
    "/api/subscription/me",
    {
      token: auth.token,
      tenantId: auth.tenantId,
    },
  );
}
