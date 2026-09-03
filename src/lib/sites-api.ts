import { apiRequest } from "@/lib/http";

export type SetupStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export type Site = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  buildingCount?: number;
  apartmentCount?: number;
  activeApartmentCount?: number;
  setupStatus?: SetupStatus;
  setupCompletedAt?: string | null;
};

export type SiteListResponse = {
  items: Site[];
  page: number;
  perPage: number;
  total: number;
};

/** Site listesindeki bina/daire sayaçları. */
export function readSiteCounts(site: Site): { buildings: number; apartments: number } {
  return {
    buildings: site.buildingCount ?? 0,
    apartments: site.apartmentCount ?? site.activeApartmentCount ?? 0,
  };
}

export function setupWizardActionLabel(status?: SetupStatus): string {
  if (status === "COMPLETED" || status === "SKIPPED") return "Kurulum Sihirbazı";
  return "Kuruluma Devam Et";
}

export type SitePayload = {
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export type SiteSummary = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export function listSites(
  auth: AuthContext,
  params: { search?: string; page?: number; perPage?: number; status?: "aktif" | "pasif" | "hepsi" },
) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.status && params.status !== "hepsi") query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<SiteListResponse>(`/api/sites${suffix}`, auth);
}

export function listActiveSites(auth: AuthContext) {
  return apiRequest<{ items: SiteSummary[] }>("/api/sites/active", auth);
}

export function getSite(auth: AuthContext, id: string) {
  return apiRequest<{ site: Site }>(`/api/sites/${id}`, auth);
}

export function createSite(auth: AuthContext, payload: SitePayload) {
  return apiRequest<{ site: Site }>("/api/sites", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSite(auth: AuthContext, id: string, payload: SitePayload) {
  return apiRequest<{ site: Site }>(`/api/sites/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSite(auth: AuthContext, id: string, confirmName: string) {
  return apiRequest<{ message: string }>(`/api/sites/${id}`, {
    ...auth,
    method: "DELETE",
    body: JSON.stringify({ confirmName }),
  });
}

export type SiteDeleteCounts = {
  buildings: number;
  apartments: number;
  assets: number;
  announcements: number;
  relations: number;
  debts: number;
  payments: number;
  expenses: number;
  feedback: number;
  other: number;
};

export function getSiteDeletePreview(auth: AuthContext, id: string) {
  return apiRequest<{ site: { id: string; name: string }; counts: SiteDeleteCounts }>(
    `/api/sites/${id}/delete-preview`,
    auth,
  );
}
