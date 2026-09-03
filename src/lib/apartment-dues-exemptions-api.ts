import { apiRequest } from "@/lib/http";
import type { ApartmentDuesExemptionSummary } from "@/lib/apartments-api";

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type ApartmentDuesExemption = ApartmentDuesExemptionSummary & {
  apartment?: {
    id: string;
    number: string;
    building: { id: string; name: string };
  };
};

export type CreateExemptionPayload = {
  exemptionType: "FULL" | "PERCENT" | "FIXED";
  value?: number | null;
  startDate: string;
  endDate?: string | null;
  indefinite?: boolean;
  reason: "MANAGER" | "STAFF" | "BOARD_DECISION" | "OTHER";
  note?: string | null;
};

export const EXEMPTION_TYPE_LABELS: Record<CreateExemptionPayload["exemptionType"], string> = {
  FULL: "Tam Muafiyet",
  PERCENT: "Yüzde İndirim",
  FIXED: "Sabit İndirim",
};

export const EXEMPTION_REASON_LABELS: Record<CreateExemptionPayload["reason"], string> = {
  MANAGER: "Yönetici muafiyeti",
  STAFF: "Personel/görevli muafiyeti",
  BOARD_DECISION: "Yönetim kararı",
  OTHER: "Diğer",
};

export function listApartmentDuesExemptions(auth: AuthContext, apartmentId: string) {
  return apiRequest<{ items: ApartmentDuesExemption[] }>(
    `/api/apartments/${apartmentId}/dues-exemptions`,
    auth,
  );
}

export function getActiveApartmentDuesExemption(auth: AuthContext, apartmentId: string) {
  return apiRequest<{ exemption: ApartmentDuesExemption | null }>(
    `/api/apartments/${apartmentId}/dues-exemptions/active`,
    auth,
  );
}

export function createApartmentDuesExemption(
  auth: AuthContext,
  apartmentId: string,
  payload: CreateExemptionPayload,
) {
  return apiRequest<{ exemption: ApartmentDuesExemption }>(
    `/api/apartments/${apartmentId}/dues-exemptions`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateApartmentDuesExemption(
  auth: AuthContext,
  id: string,
  payload: Partial<CreateExemptionPayload>,
) {
  return apiRequest<{ exemption: ApartmentDuesExemption }>(`/api/apartment-dues-exemptions/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function revokeApartmentDuesExemption(auth: AuthContext, id: string) {
  return apiRequest<{ exemption: ApartmentDuesExemption }>(
    `/api/apartment-dues-exemptions/${id}/revoke`,
    { ...auth, method: "POST", body: "{}" },
  );
}
