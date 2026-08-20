import { apiRequest } from "@/lib/http";

export type Building = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  apartmentCount: number;
  floorCount: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type BuildingListResponse = {
  items: Building[];
  page: number;
  perPage: number;
  total: number;
};

export type BuildingPayload = {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  district?: string;
  description?: string;
  apartmentCount: number;
  floorCount: number;
};

type SessionResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenants?: Array<{ id: string; name: string }>;
  };
};

type AuthContext = {
  token: string;
  tenantId: string;
};

export function fetchPreviewSession() {
  return apiRequest<SessionResponse>("/api/auth/preview-session", { method: "POST" });
}

export function listBuildings(
  auth: AuthContext,
  params: { search?: string; page?: number; perPage?: number; status?: "aktif" | "pasif" },
) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<BuildingListResponse>(`/api/buildings${suffix}`, auth);
}

export function getBuilding(auth: AuthContext, id: string) {
  return apiRequest<{ building: Building }>(`/api/buildings/${id}`, auth);
}

export function createBuilding(auth: AuthContext, payload: BuildingPayload) {
  return apiRequest<{ building: Building }>("/api/buildings", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBuilding(auth: AuthContext, id: string, payload: BuildingPayload) {
  return apiRequest<{ building: Building }>(`/api/buildings/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBuilding(auth: AuthContext, id: string) {
  return apiRequest<void>(`/api/buildings/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
