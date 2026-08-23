import { apiRequest } from "@/lib/http";

export type DebtStatus = "OPEN" | "PAID" | "CANCELLED";
export type DebtType = "DUES" | "MANUAL";
export type DueState = "upcoming" | "today" | "overdue";

export type ApartmentDebt = {
  id: string;
  type: DebtType;
  title: string;
  originalAmount: string;
  remainingAmount: string;
  dueDate: string;
  periodYear: number | null;
  periodMonth: number | null;
  description: string | null;
  status: DebtStatus;
  dueState: DueState | null;
  createdAt: string;
  updatedAt?: string;
  cancelledAt: string | null;
  duesDefinitionId: string | null;
  building: { id: string; name: string };
  apartment: { id: string; number: string };
  primaryOwnerName?: string | null;
  primaryTenantName?: string | null;
};

export type DebtListResponse = {
  items: ApartmentDebt[];
  page: number;
  perPage: number;
  total: number;
  summary: {
    totalOriginalAmount: string;
    totalRemainingAmount: string;
    openDebtCount: number;
    overdueDebtCount: number;
    indebtedApartmentCount: number;
  };
};

export type ManualDebtPayload = {
  buildingId: string;
  apartmentId: string;
  title: string;
  amount: number;
  dueDate: string;
  description?: string;
  periodYear?: number;
  periodMonth?: number;
};

export type DebtUpdatePayload = {
  title?: string;
  dueDate?: string;
  description?: string;
  amount?: number;
};

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export type DebtListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  buildingId?: string;
  apartmentId?: string;
  type?: DebtType;
  status?: DebtStatus;
  periodYear?: number;
  periodMonth?: number;
  dueFrom?: string;
  dueTo?: string;
};

export function listApartmentDebts(auth: AuthContext, params: DebtListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.periodYear) query.set("periodYear", String(params.periodYear));
  if (params.periodMonth) query.set("periodMonth", String(params.periodMonth));
  if (params.dueFrom) query.set("dueFrom", params.dueFrom);
  if (params.dueTo) query.set("dueTo", params.dueTo);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<DebtListResponse>(`/api/apartment-debts${suffix}`, auth);
}

export function getApartmentDebt(auth: AuthContext, id: string) {
  return apiRequest<{ debt: ApartmentDebt }>(`/api/apartment-debts/${id}`, auth);
}

export function createApartmentDebt(auth: AuthContext, payload: ManualDebtPayload) {
  return apiRequest<{ debt: ApartmentDebt }>("/api/apartment-debts", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateApartmentDebt(auth: AuthContext, id: string, payload: DebtUpdatePayload) {
  return apiRequest<{ debt: ApartmentDebt }>(`/api/apartment-debts/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cancelApartmentDebt(auth: AuthContext, id: string) {
  return apiRequest<{ debt: ApartmentDebt }>(`/api/apartment-debts/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
