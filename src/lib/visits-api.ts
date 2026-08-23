import { apiRequest } from "@/lib/http";

export type VisitStatus = "EXPECTED" | "INSIDE" | "COMPLETED" | "CANCELLED";

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  EXPECTED: "Beklenen",
  INSIDE: "İçeride",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export type Visitor = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  note: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type VisitorDetail = Visitor & {
  nationalId: string | null;
};

export type VisitorListResponse = {
  items: Visitor[];
  page: number;
  perPage: number;
  total: number;
};

export type VisitorPayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  nationalId?: string;
  note?: string;
};

export type VisitorUpdatePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  nationalId?: string | null;
  note?: string | null;
};

export type Visit = {
  id: string;
  purpose: string | null;
  vehiclePlate: string | null;
  expectedAt: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  status: VisitStatus;
  note: string | null;
  createdAt: string;
  updatedAt?: string;
  cancelledAt: string | null;
  visitor: {
    id: string;
    fullName: string;
    phone: string | null;
  };
  building: {
    id: string;
    name: string;
  };
  apartment: {
    id: string;
    number: string;
  };
  hostPerson: {
    id: string;
    fullName: string;
  } | null;
};

export type VisitListResponse = {
  items: Visit[];
  page: number;
  perPage: number;
  total: number;
  summary: { insideCount: number };
};

export type VisitPayload = {
  visitorId: string;
  apartmentId: string;
  hostPersonId?: string;
  purpose?: string;
  vehiclePlate?: string;
  checkInAt?: string;
  note?: string;
};

export type VisitUpdatePayload = {
  hostPersonId?: string | null;
  purpose?: string | null;
  vehiclePlate?: string | null;
  checkInAt?: string;
  checkOutAt?: string | null;
  note?: string | null;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export type VisitorListParams = {
  search?: string;
  page?: number;
  perPage?: number;
};

export type VisitListParams = {
  search?: string;
  status?: VisitStatus;
  statusGroup?: "active" | "history";
  buildingId?: string;
  apartmentId?: string;
  visitorId?: string;
  vehiclePlate?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
};

export function formatTimeTr(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Duration from checkInAt to checkOutAt (or now). e.g. "38 dk" / "1 sa 12 dk" */
export function formatVisitDuration(
  checkInAt: string | null | undefined,
  checkOutAt?: string | null,
  now: Date = new Date(),
): string {
  if (!checkInAt) return "—";
  const start = new Date(checkInAt);
  if (Number.isNaN(start.getTime())) return "—";
  const end = checkOutAt ? new Date(checkOutAt) : now;
  if (Number.isNaN(end.getTime())) return "—";
  const totalMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} dk`;
  if (minutes === 0) return `${hours} sa`;
  return `${hours} sa ${minutes} dk`;
}

export function toDateTimeLocalValue(value: string | Date | null | undefined = new Date()): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateTimeLocalToIso(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function listVisitors(auth: AuthContext, params: VisitorListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<VisitorListResponse>(`/api/visitors${suffix}`, auth);
}

export function getVisitor(auth: AuthContext, id: string) {
  return apiRequest<{ visitor: VisitorDetail }>(`/api/visitors/${id}`, auth);
}

export function createVisitor(auth: AuthContext, payload: VisitorPayload) {
  return apiRequest<{ visitor: VisitorDetail }>("/api/visitors", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateVisitor(auth: AuthContext, id: string, payload: VisitorUpdatePayload) {
  return apiRequest<{ visitor: VisitorDetail }>(`/api/visitors/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteVisitor(auth: AuthContext, id: string) {
  return apiRequest<{ ok: true }>(`/api/visitors/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function listVisits(auth: AuthContext, params: VisitListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.statusGroup) query.set("statusGroup", params.statusGroup);
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.visitorId) query.set("visitorId", params.visitorId);
  if (params.vehiclePlate) query.set("vehiclePlate", params.vehiclePlate);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<VisitListResponse>(`/api/visits${suffix}`, auth);
}

export function getVisit(auth: AuthContext, id: string) {
  return apiRequest<{ visit: Visit }>(`/api/visits/${id}`, auth);
}

export function createVisit(auth: AuthContext, payload: VisitPayload) {
  return apiRequest<{ visit: Visit }>("/api/visits", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateVisit(auth: AuthContext, id: string, payload: VisitUpdatePayload) {
  return apiRequest<{ visit: Visit }>(`/api/visits/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function checkOutVisit(auth: AuthContext, id: string) {
  return apiRequest<{ visit: Visit }>(`/api/visits/${id}/check-out`, {
    ...auth,
    method: "POST",
  });
}

export function cancelVisit(auth: AuthContext, id: string) {
  return apiRequest<{ visit: Visit }>(`/api/visits/${id}/cancel`, {
    ...auth,
    method: "POST",
  });
}

export function getInsideVisitSummary(auth: AuthContext) {
  return apiRequest<{ insideCount: number }>("/api/visits/summary/inside", auth);
}
