import { apiRequest } from "@/lib/http";

export type Supplier = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt: string | null;
};

export type SupplierSummary = {
  completedExpenseCount: number;
  completedExpenseTotal: string;
  cancelledExpenseCount: number;
};

export type SupplierDetail = Supplier & {
  summary: SupplierSummary;
};

export type SupplierListResponse = {
  items: Supplier[];
  page: number;
  perPage: number;
  total: number;
};

export type SupplierPayload = {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  taxOffice?: string;
  city?: string;
  district?: string;
  address?: string;
  note?: string;
  isActive?: boolean;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type SupplierListParams = {
  search?: string;
  status?: "aktif" | "pasif";
  city?: string;
  page?: number;
  perPage?: number;
};

export function listSuppliers(auth: AuthContext, params: SupplierListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.city) query.set("city", params.city);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<SupplierListResponse>(`/api/suppliers${suffix}`, auth);
}

export function getSupplier(auth: AuthContext, id: string) {
  return apiRequest<{ supplier: SupplierDetail }>(`/api/suppliers/${id}`, auth);
}

export function createSupplier(auth: AuthContext, payload: SupplierPayload) {
  return apiRequest<{ supplier: Supplier }>("/api/suppliers", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSupplier(auth: AuthContext, id: string, payload: SupplierPayload) {
  return apiRequest<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSupplier(auth: AuthContext, id: string) {
  return apiRequest<{ ok: true }>(`/api/suppliers/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function archiveSupplier(auth: AuthContext, id: string) {
  return deleteSupplier(auth, id);
}
