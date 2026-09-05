import { apiRequest } from "@/lib/http";
import type { TenantSubscription } from "@/lib/subscription-api";

type Auth = { token: string; tenantId: string; siteId?: string | null };

export type AnnualLicenseOffer = {
  product: {
    code: "ANNUAL";
    name: string;
    billingPeriod: "year";
    netPrice: number;
    vatRate: number;
    vatAmount: number;
    grossPrice: number;
    currency: string;
    monthlyNetApprox: number;
  };
  organization: { id: string; name: string };
  requester: { id: string; fullName: string; email: string; phone: string | null };
  license: TenantSubscription | null;
  projectedEndsAt: string;
  remainingDemoDaysPreserved: boolean;
  openRequest: AnnualLicenseRequest | null;
  support: { email: string | null; renewalUrl: string | null; whatsapp: string | null };
  features: string[];
};

export type AnnualLicenseRequestStatus =
  | "PENDING"
  | "CONTACTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type AnnualLicenseRequest = {
  id: string;
  tenantId: string;
  status: AnnualLicenseRequestStatus;
  note: string | null;
  netPrice: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  grossPrice: number | null;
  currency: string;
  organizationName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  currentPlan: string | null;
  currentEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  adminNote: string | null;
  tenant?: { id: string; name: string };
  requestedBy?: { id: string; fullName: string; email: string };
  processedBy?: { id: string; fullName: string; email: string } | null;
};

export function getAnnualLicenseOffer(auth: Auth) {
  return apiRequest<AnnualLicenseOffer>("/api/subscription/annual-offer", {
    token: auth.token,
    tenantId: auth.tenantId,
  });
}

export function createAnnualLicenseRequest(auth: Auth, body: { note?: string }) {
  return apiRequest<{ request: AnnualLicenseRequest }>("/api/subscription/annual-requests", {
    token: auth.token,
    tenantId: auth.tenantId,
    method: "POST",
    body: JSON.stringify(body),
  });
}
