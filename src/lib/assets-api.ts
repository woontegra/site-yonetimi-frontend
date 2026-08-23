import { apiRequest } from "@/lib/http";

export type AssetStatus =
  | "ACTIVE"
  | "IN_MAINTENANCE"
  | "OUT_OF_SERVICE"
  | "LOST"
  | "SCRAPPED"
  | "DISPOSED";

export type AssetMovementType =
  | "CREATED"
  | "LOCATION_CHANGED"
  | "STATUS_CHANGED"
  | "QUANTITY_CHANGED"
  | "UPDATED";

export type AssetCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
};

export type Asset = {
  id: string;
  siteId: string;
  buildingId: string | null;
  apartmentId: string | null;
  assetCategoryId: string | null;
  name: string;
  code: string | null;
  quantity: number;
  unit: string | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  currentValue: string | null;
  supplierName: string | null;
  location: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  warrantyEndDate: string | null;
  status: AssetStatus;
  description: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; isActive: boolean } | null;
  building: { id: string; name: string; code: string | null } | null;
  apartment: { id: string; number: string; building: { id: string; name: string } } | null;
  site: { id: string; name: string };
};

export type AssetMaintenance = {
  id: string;
  assetId: string;
  type: string;
  maintenanceDate: string;
  description: string;
  cost: string | null;
  performedBy: string | null;
  nextMaintenanceDate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetMaintenancePayload = {
  type: string;
  maintenanceDate: string;
  description: string;
  cost?: number | null;
  performedBy?: string | null;
  nextMaintenanceDate?: string | null;
  note?: string | null;
};

export type AssetMovement = {
  id: string;
  type: AssetMovementType;
  fromBuildingId: string | null;
  toBuildingId: string | null;
  fromBuilding: { id: string; name: string } | null;
  toBuilding: { id: string; name: string } | null;
  fromLocation: string | null;
  toLocation: string | null;
  previousStatus: AssetStatus | null;
  newStatus: AssetStatus | null;
  previousQuantity: number | null;
  newQuantity: number | null;
  note: string | null;
  occurredAt: string;
  createdAt: string;
};

export type AssetPayload = {
  name: string;
  code?: string | null;
  assetCategoryId?: string | null;
  buildingId?: string | null;
  apartmentId?: string | null;
  quantity?: number;
  unit?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  supplierName?: string | null;
  location?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  warrantyEndDate?: string | null;
  status?: AssetStatus;
  description?: string | null;
  note?: string | null;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: "Aktif",
  IN_MAINTENANCE: "Bakımda",
  OUT_OF_SERVICE: "Kullanım Dışı",
  LOST: "Kayıp",
  SCRAPPED: "Hurda",
  DISPOSED: "Elden Çıkarıldı",
};

export const ASSET_MOVEMENT_LABELS: Record<AssetMovementType, string> = {
  CREATED: "Oluşturuldu",
  LOCATION_CHANGED: "Konum Değişti",
  STATUS_CHANGED: "Durum Değişti",
  QUANTITY_CHANGED: "Adet Değişti",
  UPDATED: "Güncellendi",
};

export const ASSET_UNIT_OPTIONS = ["Adet", "Takım", "Set", "Metre", "Paket"] as const;

export const MAINTENANCE_TYPE_OPTIONS = [
  "Periyodik Bakım",
  "Arıza",
  "Onarım",
  "Kontrol",
  "Parça Değişimi",
  "Diğer",
] as const;

export function listAssetCategories(
  auth: AuthContext,
  params?: { search?: string; status?: "aktif" | "pasif" | "hepsi" },
) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: AssetCategory[] }>(`/api/asset-categories${suffix}`, auth);
}

export function createAssetCategory(
  auth: AuthContext,
  payload: { name: string; description?: string; sortOrder?: number },
) {
  return apiRequest<{ category: AssetCategory }>("/api/asset-categories", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAssetCategory(
  auth: AuthContext,
  id: string,
  payload: { name?: string; description?: string | null; isActive?: boolean; sortOrder?: number },
) {
  return apiRequest<{ category: AssetCategory }>(`/api/asset-categories/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAssetCategory(auth: AuthContext, id: string) {
  return apiRequest<{ id: string; deactivated: boolean }>(`/api/asset-categories/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function listAssets(
  auth: AuthContext,
  params: {
    search?: string;
    categoryId?: string;
    buildingId?: string;
    apartmentId?: string;
    status?: AssetStatus;
    upcomingMaintenanceDays?: number;
    page?: number;
    perPage?: number;
  },
) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.status) query.set("status", params.status);
  if (params.upcomingMaintenanceDays) {
    query.set("upcomingMaintenanceDays", String(params.upcomingMaintenanceDays));
  }
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{
    items: Asset[];
    page: number;
    perPage: number;
    total: number;
    totalCurrentValue: string | null;
    summary: { total: number; inMaintenance: number; outOfService: number };
  }>(`/api/assets${suffix}`, auth);
}

export function getAsset(auth: AuthContext, id: string) {
  return apiRequest<{ asset: Asset }>(`/api/assets/${id}`, auth);
}

export function listAssetMovements(auth: AuthContext, id: string) {
  return apiRequest<{ items: AssetMovement[] }>(`/api/assets/${id}/movements`, auth);
}

export function createAsset(auth: AuthContext, payload: AssetPayload) {
  return apiRequest<{ asset: Asset }>("/api/assets", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAsset(auth: AuthContext, id: string, payload: AssetPayload) {
  return apiRequest<{ asset: Asset }>(`/api/assets/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function changeAssetStatus(
  auth: AuthContext,
  id: string,
  payload: { status: AssetStatus; note?: string },
) {
  return apiRequest<{ asset: Asset }>(`/api/assets/${id}/status`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function changeAssetLocation(
  auth: AuthContext,
  id: string,
  payload: { buildingId?: string | null; location?: string | null; note?: string },
) {
  return apiRequest<{ asset: Asset }>(`/api/assets/${id}/location`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function archiveAsset(auth: AuthContext, id: string) {
  return apiRequest<{ ok: true }>(`/api/assets/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function listAssetMaintenances(
  auth: AuthContext,
  assetId: string,
  params?: { type?: string; page?: number; perPage?: number },
) {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.page) query.set("page", String(params.page));
  if (params?.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{
    items: AssetMaintenance[];
    page: number;
    perPage: number;
    total: number;
    totalCost: string | null;
  }>(`/api/assets/${assetId}/maintenances${suffix}`, auth);
}

export function createAssetMaintenance(
  auth: AuthContext,
  assetId: string,
  payload: AssetMaintenancePayload,
) {
  return apiRequest<{ maintenance: AssetMaintenance }>(`/api/assets/${assetId}/maintenances`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAssetMaintenance(
  auth: AuthContext,
  assetId: string,
  maintenanceId: string,
  payload: Partial<AssetMaintenancePayload>,
) {
  return apiRequest<{ maintenance: AssetMaintenance }>(
    `/api/assets/${assetId}/maintenances/${maintenanceId}`,
    {
      ...auth,
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteAssetMaintenance(
  auth: AuthContext,
  assetId: string,
  maintenanceId: string,
) {
  return apiRequest<{ ok: true }>(`/api/assets/${assetId}/maintenances/${maintenanceId}`, {
    ...auth,
    method: "DELETE",
  });
}
