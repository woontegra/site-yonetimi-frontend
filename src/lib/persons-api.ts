import { apiRequest } from "@/lib/http";
import type { RelationType } from "@/lib/person-constants";

export type PersonActiveRelation = {
  id: string;
  relationType: RelationType;
  isPrimary: boolean;
  apartment: {
    id: string;
    number: string;
    building: { id: string; name: string };
  };
};

export type PersonListItem = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  relationSummary: string;
  apartmentSummary: string;
  activeRelations: PersonActiveRelation[];
};

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  gender: string | null;
  occupation: string | null;
  birthDate: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type PersonListResponse = {
  items: PersonListItem[];
  page: number;
  perPage: number;
  total: number;
};

export type PersonPayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  gender?: string;
  occupation?: string;
  birthDate?: string;
  note?: string;
  isActive?: boolean;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type PersonListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  status?: "aktif" | "pasif";
  relationType?: RelationType;
  buildingId?: string;
  apartmentId?: string;
};

export function listPersons(auth: AuthContext, params: PersonListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.status) query.set("status", params.status);
  if (params.relationType) query.set("relationType", params.relationType);
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<PersonListResponse>(`/api/persons${suffix}`, auth);
}

export function getPerson(auth: AuthContext, id: string) {
  return apiRequest<{ person: Person }>(`/api/persons/${id}`, auth);
}

export function createPerson(auth: AuthContext, payload: PersonPayload) {
  return apiRequest<{ person: Person }>("/api/persons", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type PersonWithRelationPayload = PersonPayload & {
  apartmentId?: string;
  relationType?: RelationType;
};

export function createPersonWithRelation(auth: AuthContext, payload: PersonWithRelationPayload) {
  return apiRequest<{ person: Person }>("/api/persons/with-relation", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePerson(auth: AuthContext, id: string, payload: PersonPayload) {
  return apiRequest<{ person: Person }>(`/api/persons/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePerson(auth: AuthContext, id: string) {
  return apiRequest<void>(`/api/persons/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
