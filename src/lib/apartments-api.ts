import { apiRequest } from "@/lib/http";

export type ApartmentPersonSummary = {
  id: string;
  fullName: string;
  phone: string | null;
};

export type ApartmentDuesExemptionSummary = {
  id: string;
  apartmentId: string;
  exemptionType: "FULL" | "PERCENT" | "FIXED";
  value: string | null;
  startDate: string;
  endDate: string | null;
  reason: "MANAGER" | "STAFF" | "BOARD_DECISION" | "OTHER";
  reasonLabel: string;
  note: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  revokedAt?: string | null;
};

export type Apartment = {
  id: string;
  number: string;
  floor: string | null;
  roomType: string | null;
  squareMeters: number | null;
  hasBalcony: boolean | null;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt?: string;
  building: {
    id: string;
    name: string;
  };
  owners?: ApartmentPersonSummary[];
  tenants?: ApartmentPersonSummary[];
  ownerLabel?: string;
  residentLabel?: string;
  occupantLine?: string;
  displayPerson?: {
    id: string;
    fullName: string;
    role: "OWNER" | "TENANT" | null;
    roleLabel: string | null;
  } | null;
  occupancy?: "OWNER_OCCUPIED" | "TENANT_OCCUPIED" | "VACANT";
  occupancyLabel?: string;
  primaryPhone?: string | null;
  duesStatus?: {
    code: "NORMAL" | "EXEMPT" | "DISCOUNTED" | "EXPIRING_SOON";
    label: string;
    exemption: ApartmentDuesExemptionSummary | null;
  };
  debtStatus?: {
    code: "NONE" | "OPEN" | "OVERDUE";
    label: string;
    openAmount: string;
    overdueAmount?: string;
    isOverdue: boolean;
  };
  relationHistory?: Array<{
    id: string;
    relationType: "OWNER" | "TENANT";
    isPrimary: boolean;
    isActive: boolean;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
    person: {
      id: string;
      fullName: string;
      phone: string | null;
      email: string | null;
      isActive: boolean;
      deleted: boolean;
    };
  }>;
};

export type ApartmentListResponse = {
  items: Apartment[];
  page: number;
  perPage: number;
  total: number;
};

export type ApartmentPayload = {
  buildingId: string;
  number: string;
  floor?: string | null;
  roomType?: string | null;
  squareMeters?: number;
  hasBalcony?: boolean | null;
  description?: string;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type ApartmentListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  buildingId?: string;
  floor?: string;
  roomType?: string;
  status?: "aktif" | "pasif";
};

export function listApartments(auth: AuthContext, params: ApartmentListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.floor) query.set("floor", params.floor);
  if (params.roomType) query.set("roomType", params.roomType);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<ApartmentListResponse>(`/api/apartments${suffix}`, auth);
}

export function getApartment(auth: AuthContext, id: string) {
  return apiRequest<{ apartment: Apartment }>(`/api/apartments/${id}`, auth);
}

export function createApartment(auth: AuthContext, payload: ApartmentPayload) {
  return apiRequest<{ apartment: Apartment }>("/api/apartments", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateApartment(auth: AuthContext, id: string, payload: ApartmentPayload) {
  return apiRequest<{ apartment: Apartment }>(`/api/apartments/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteApartment(auth: AuthContext, id: string) {
  return apiRequest<void>(`/api/apartments/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
