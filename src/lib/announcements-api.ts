import { apiRequest } from "@/lib/http";

export type AnnouncementAudienceType = "ALL_SITE" | "BUILDINGS" | "APARTMENTS";
export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "CANCELLED";

export type Announcement = {
  id: string;
  siteId: string;
  title: string;
  content: string;
  audienceType: AnnouncementAudienceType;
  audienceLabel: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publishAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string | null;
  createdByUser?: { id: string; fullName: string; email?: string | null } | null;
  site: { id: string; name: string };
  targetBuildingCount: number;
  targetApartmentCount: number;
  targetSummary: string;
  buildings: Array<{ id: string; name: string; code: string | null }>;
  apartments: Array<{
    id: string;
    number: string;
    floor: string;
    building: { id: string; name: string };
  }>;
};

export type AnnouncementPayload = {
  title: string;
  content: string;
  audienceType: AnnouncementAudienceType;
  priority?: AnnouncementPriority;
  buildingIds?: string[];
  apartmentIds?: string[];
  publishAt?: string | null;
  expiresAt?: string | null;
  publish?: boolean;
};

export type AnnouncementUpdatePayload = {
  title?: string;
  content?: string;
  audienceType?: AnnouncementAudienceType;
  priority?: AnnouncementPriority;
  buildingIds?: string[];
  apartmentIds?: string[];
  publishAt?: string | null;
  expiresAt?: string | null;
};

export type AnnouncementListParams = {
  search?: string;
  status?: AnnouncementStatus;
  priority?: AnnouncementPriority;
  audienceType?: AnnouncementAudienceType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
};

export type AnnouncementListResponse = {
  items: Announcement[];
  page: number;
  perPage: number;
  total: number;
};

export type AudiencePreviewPayload = {
  audienceType: AnnouncementAudienceType;
  buildingIds?: string[];
  apartmentIds?: string[];
};

export type AudiencePreviewRecipient = {
  apartmentId: string;
  apartmentNumber?: string;
  buildingName?: string;
  residentName?: string | null;
  phone?: string | null;
};

export type AudiencePreview = {
  audienceType: AnnouncementAudienceType;
  audienceLabel: string;
  apartmentCount: number;
  recipientCount: number;
  withPhoneCount: number;
  withoutPhoneCount: number;
  recipients: AudiencePreviewRecipient[];
  truncated: boolean;
};

type Auth = { token: string; tenantId: string; siteId?: string | null };

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  DRAFT: "Taslak",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi",
  CANCELLED: "İptal",
};

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  NORMAL: "Normal",
  IMPORTANT: "Önemli",
  URGENT: "Acil",
};

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudienceType, string> = {
  ALL_SITE: "Tüm Site",
  BUILDINGS: "Belirli Binalar",
  APARTMENTS: "Belirli Daireler",
};

export function listAnnouncements(auth: Auth, params: AnnouncementListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.audienceType) query.set("audienceType", params.audienceType);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<AnnouncementListResponse>(`/api/announcements${suffix}`, auth);
}

export function getAnnouncement(auth: Auth, id: string) {
  return apiRequest<{ announcement: Announcement }>(`/api/announcements/${id}`, auth);
}

export function createAnnouncement(auth: Auth, payload: AnnouncementPayload) {
  return apiRequest<{ announcement: Announcement }>("/api/announcements", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAnnouncement(auth: Auth, id: string, payload: AnnouncementUpdatePayload) {
  return apiRequest<{ announcement: Announcement }>(`/api/announcements/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function publishAnnouncement(auth: Auth, id: string) {
  return apiRequest<{ announcement: Announcement }>(`/api/announcements/${id}/publish`, {
    ...auth,
    method: "POST",
  });
}

export function archiveAnnouncement(auth: Auth, id: string) {
  return apiRequest<{ announcement: Announcement }>(`/api/announcements/${id}/archive`, {
    ...auth,
    method: "POST",
  });
}

export function cancelAnnouncement(auth: Auth, id: string) {
  return apiRequest<{ announcement: Announcement }>(`/api/announcements/${id}/cancel`, {
    ...auth,
    method: "POST",
  });
}

export function previewAnnouncementAudience(auth: Auth, payload: AudiencePreviewPayload) {
  return apiRequest<AudiencePreview>("/api/announcements/preview-audience", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAnnouncement(auth: Auth, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/announcements/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
