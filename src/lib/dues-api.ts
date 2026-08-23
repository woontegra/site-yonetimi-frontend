import { apiRequest } from "@/lib/http";

export type DuesDefinition = {
  id: string;
  name: string;
  amount: string;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  building: { id: string; name: string };
  chargedApartmentCount: number;
  activeApartmentCount?: number;
  chargedOpenCount?: number;
  totalOriginalAmount?: string;
  totalRemainingAmount?: string;
};

export type DuesListResponse = {
  items: DuesDefinition[];
  page: number;
  perPage: number;
  total: number;
};

export type DuesPayload = {
  buildingId: string;
  name: string;
  amount: number;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  description?: string;
};

export type ChargePreview = {
  dues: DuesDefinition;
  activeApartmentCount: number;
  alreadyChargedCount: number;
  pendingChargeCount: number;
  totalChargeAmount: string;
};

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export function listDuesDefinitions(
  auth: AuthContext,
  params: {
    search?: string;
    page?: number;
    perPage?: number;
    buildingId?: string;
    periodYear?: number;
    periodMonth?: number;
    status?: "aktif" | "pasif";
  } = {},
) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.periodYear) query.set("periodYear", String(params.periodYear));
  if (params.periodMonth) query.set("periodMonth", String(params.periodMonth));
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<DuesListResponse>(`/api/dues-definitions${suffix}`, auth);
}

export function getDuesDefinition(auth: AuthContext, id: string) {
  return apiRequest<{ dues: DuesDefinition }>(`/api/dues-definitions/${id}`, auth);
}

export function createDuesDefinition(auth: AuthContext, payload: DuesPayload) {
  return apiRequest<{ dues: DuesDefinition }>("/api/dues-definitions", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDuesDefinition(auth: AuthContext, id: string, payload: Partial<DuesPayload> & { isActive?: boolean }) {
  return apiRequest<{ dues: DuesDefinition }>(`/api/dues-definitions/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDuesDefinition(auth: AuthContext, id: string) {
  return apiRequest<void>(`/api/dues-definitions/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function getChargePreview(auth: AuthContext, id: string) {
  return apiRequest<ChargePreview>(`/api/dues-definitions/${id}/charge-preview`, auth);
}

export function chargeDues(auth: AuthContext, id: string) {
  return apiRequest<{ createdCount: number; totalAmount: string; dues: DuesDefinition }>(
    `/api/dues-definitions/${id}/charge`,
    { ...auth, method: "POST", body: "{}" },
  );
}

export function cancelOpenDuesDebts(auth: AuthContext, id: string) {
  return apiRequest<{ cancelledCount: number; dues: DuesDefinition }>(
    `/api/dues-definitions/${id}/cancel-open-debts`,
    { ...auth, method: "POST", body: "{}" },
  );
}
