import { apiRequest } from "@/lib/http";

type Auth = { token: string; tenantId: string; siteId?: string | null };

export type TenantSubscriptionPlan = "DEMO" | "ANNUAL";
export type TenantSubscriptionStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

export type TenantSubscription = {
  id?: string;
  plan: TenantSubscriptionPlan;
  status: TenantSubscriptionStatus;
  storedStatus?: TenantSubscriptionStatus;
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
  usage?: { siteCount: number; userCount: number };
  licenseScope?: string;
  support?: { email: string | null; renewalUrl: string | null; whatsapp?: string | null };
  state?: "HAS_LICENSE" | "NO_LICENSE";
  /** Yeni alan — backend tek kaynak. */
  license?: TenantSubscription | null;
  /** Geriye uyumluluk */
  subscription: TenantSubscription | null;
};

export type TenantLicenseHistoryItem = {
  id: string;
  action: string;
  label: string;
  createdAt: string;
  previousEndsAt: string | null;
  newEndsAt: string | null;
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

export function licenseFromResponse(result: MyLicenseResponse): TenantSubscription | null {
  return result.license ?? result.subscription ?? null;
}

/** Tenant + token ile current license — siteId gönderilmez. */
export function getMySubscription(auth: Auth) {
  return apiRequest<MyLicenseResponse>("/api/subscription/me", {
    token: auth.token,
    tenantId: auth.tenantId,
    // Site header yok — lisans organizasyona aittir.
  });
}

export function listMySubscriptionHistory(auth: Auth, limit = 20) {
  return apiRequest<{ items: TenantLicenseHistoryItem[] }>(
    `/api/subscription/me/history?limit=${limit}`,
    {
      token: auth.token,
      tenantId: auth.tenantId,
    },
  );
}

type CacheEntry = { at: number; data: MyLicenseResponse };
const cache = new Map<string, CacheEntry>();
const listeners = new Set<(tenantId: string) => void>();

function cacheKey(tenantId: string) {
  return `license:${tenantId}`;
}

export function invalidateMyLicenseCache(tenantId?: string | null) {
  if (tenantId) cache.delete(cacheKey(tenantId));
  else cache.clear();
  for (const listener of listeners) listener(tenantId ?? "");
}

export function subscribeMyLicenseCache(listener: (tenantId: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getMySubscriptionCached(
  auth: Auth,
  options?: { force?: boolean; ttlMs?: number },
): Promise<MyLicenseResponse> {
  const key = cacheKey(auth.tenantId);
  const ttl = options?.ttlMs ?? 15_000;
  const hit = cache.get(key);
  if (!options?.force && hit && Date.now() - hit.at < ttl) {
    return hit.data;
  }
  const data = await getMySubscription(auth);
  cache.set(key, { at: Date.now(), data });
  return data;
}
