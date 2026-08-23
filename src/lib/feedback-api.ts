import { apiRequest } from "@/lib/http";

export type FeedbackType = "INFO" | "SUGGESTION" | "REQUEST" | "COMPLAINT";
export type FeedbackPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type FeedbackStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type FeedbackStatusGroup = "open" | "resolved" | "all";

export type FeedbackCategory = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
};

export type FeedbackRecord = {
  id: string;
  siteId: string;
  buildingId: string | null;
  apartmentId: string | null;
  personId: string | null;
  employeeId: string | null;
  categoryId: string | null;
  type: FeedbackType;
  title: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  locationLabel: string;
  site: { id: string; name: string };
  building: { id: string; name: string; code: string | null } | null;
  apartment: {
    id: string;
    number: string;
    floor: string;
    building: { id: string; name: string };
  } | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string | null;
  } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    label: string | null;
  } | null;
  category: { id: string; name: string; isActive: boolean } | null;
};

export type FeedbackHistoryItem = {
  id: string;
  previousStatus: FeedbackStatus | null;
  newStatus: FeedbackStatus;
  note: string | null;
  createdAt: string;
};

export type FeedbackPayload = {
  type: FeedbackType;
  title: string;
  description: string;
  priority?: FeedbackPriority;
  categoryId?: string | null;
  buildingId?: string | null;
  apartmentId?: string | null;
  personId?: string | null;
  employeeId?: string | null;
};

export type FeedbackListParams = {
  search?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
  statusGroup?: FeedbackStatusGroup;
  priority?: FeedbackPriority;
  categoryId?: string;
  buildingId?: string;
  apartmentId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
};

export type FeedbackListResponse = {
  items: FeedbackRecord[];
  page: number;
  perPage: number;
  total: number;
  summary: { open: number; inProgress: number; active: number };
};

type Auth = { token: string; tenantId: string; siteId?: string | null };

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  INFO: "Bilgi",
  SUGGESTION: "Öneri",
  REQUEST: "Talep",
  COMPLAINT: "Şikâyet",
};

export const FEEDBACK_PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  LOW: "Düşük",
  NORMAL: "Normal",
  HIGH: "Yüksek",
  URGENT: "Acil",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "İşlemde",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapandı",
};

export function listFeedbackCategories(
  auth: Auth,
  params: { search?: string; status?: "aktif" | "pasif" | "hepsi" } = {},
) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: FeedbackCategory[] }>(`/api/feedback-categories${suffix}`, auth);
}

export function createFeedbackCategory(auth: Auth, payload: { name: string; sortOrder?: number }) {
  return apiRequest<{ category: FeedbackCategory }>("/api/feedback-categories", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFeedbackCategory(
  auth: Auth,
  id: string,
  payload: { name?: string; isActive?: boolean; sortOrder?: number },
) {
  return apiRequest<{ category: FeedbackCategory }>(`/api/feedback-categories/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteFeedbackCategory(auth: Auth, id: string) {
  return apiRequest<{ id: string; deactivated: boolean }>(`/api/feedback-categories/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function listFeedbackRecords(auth: Auth, params: FeedbackListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.statusGroup) query.set("statusGroup", params.statusGroup);
  if (params.priority) query.set("priority", params.priority);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.employeeId) query.set("employeeId", params.employeeId);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<FeedbackListResponse>(`/api/feedback-records${suffix}`, auth);
}

export function getFeedbackRecord(auth: Auth, id: string) {
  return apiRequest<{ record: FeedbackRecord }>(`/api/feedback-records/${id}`, auth);
}

export function listFeedbackHistory(auth: Auth, id: string) {
  return apiRequest<{ items: FeedbackHistoryItem[] }>(`/api/feedback-records/${id}/history`, auth);
}

export function createFeedbackRecord(auth: Auth, payload: FeedbackPayload) {
  return apiRequest<{ record: FeedbackRecord }>("/api/feedback-records", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFeedbackRecord(auth: Auth, id: string, payload: Partial<FeedbackPayload>) {
  return apiRequest<{ record: FeedbackRecord }>(`/api/feedback-records/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function changeFeedbackStatus(
  auth: Auth,
  id: string,
  payload: { status: FeedbackStatus; resolution?: string; note?: string },
) {
  return apiRequest<{ record: FeedbackRecord }>(`/api/feedback-records/${id}/status`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteFeedbackRecord(auth: Auth, id: string) {
  return apiRequest<{ id: string }>(`/api/feedback-records/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
