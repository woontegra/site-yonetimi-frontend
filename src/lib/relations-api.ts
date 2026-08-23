import { apiRequest } from "@/lib/http";
import type { RelationType } from "@/lib/person-constants";

export type ApartmentPersonRelation = {
  id: string;
  relationType: RelationType;
  startDate: string | null;
  endDate: string | null;
  isPrimary: boolean;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt?: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    isActive: boolean;
  };
  apartment: {
    id: string;
    number: string;
    building: { id: string; name: string };
  };
};

export type RelationListResponse = {
  items: ApartmentPersonRelation[];
  page: number;
  perPage: number;
  total: number;
};

export type RelationPayload = {
  apartmentId: string;
  personId: string;
  relationType: RelationType;
  startDate?: string;
  endDate?: string;
  isPrimary?: boolean;
  note?: string;
};

export type RelationUpdatePayload = {
  relationType?: RelationType;
  startDate?: string;
  endDate?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  note?: string;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type RelationListParams = {
  apartmentId?: string;
  personId?: string;
  relationType?: RelationType;
  active?: boolean;
  page?: number;
  perPage?: number;
};

export function listRelations(auth: AuthContext, params: RelationListParams = {}) {
  const query = new URLSearchParams();
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.personId) query.set("personId", params.personId);
  if (params.relationType) query.set("relationType", params.relationType);
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<RelationListResponse>(`/api/apartment-person-relations${suffix}`, auth);
}

export function createRelation(auth: AuthContext, payload: RelationPayload) {
  return apiRequest<{ relation: ApartmentPersonRelation }>("/api/apartment-person-relations", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRelation(auth: AuthContext, id: string, payload: RelationUpdatePayload) {
  return apiRequest<{ relation: ApartmentPersonRelation }>(`/api/apartment-person-relations/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function endRelation(auth: AuthContext, id: string, endDate?: string) {
  return apiRequest<{ relation: ApartmentPersonRelation }>(`/api/apartment-person-relations/${id}`, {
    ...auth,
    method: "DELETE",
    body: JSON.stringify(endDate ? { endDate } : {}),
  });
}
