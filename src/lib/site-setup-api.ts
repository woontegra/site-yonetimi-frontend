import { apiRequest } from "@/lib/http";
import type { RelationType } from "@/lib/person-constants";
import type { Person } from "@/lib/persons-api";
import type { Site } from "@/lib/sites-api";

export type SetupStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export type SetupSummarySite = {
  id: string;
  name: string;
  setupStatus: SetupStatus;
  setupCompletedAt: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
};

export type SetupSummaryBuilding = {
  id: string;
  name: string;
  apartmentCount: number;
};

export type SetupSummary = {
  site: SetupSummarySite;
  counts: {
    buildings: number;
    apartments: number;
    owners: number;
    tenants: number;
    apartmentsWithoutResident: number;
  };
  buildings: SetupSummaryBuilding[];
};

export type BulkBuildingInput = {
  name: string;
  code?: string | null;
  apartmentNumbers?: string[];
};

export type BulkApartmentInput = {
  number: string;
  floor?: string | null;
  roomType?: string | null;
};

export type ImportRow = {
  buildingName: string;
  apartmentNumber: string;
  floor?: string | null;
  roomType?: string | null;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerPhone?: string;
  tenantFirstName?: string;
  tenantLastName?: string;
  tenantPhone?: string;
};

export type ImportPreviewResult = {
  apartmentCount: number;
  ownerCount: number;
  tenantCount: number;
  warnings: string[];
  errors: string[];
  rows: ImportRow[];
};

export type ImportCommitResult = {
  buildingsCreated: number;
  apartmentsCreated: number;
  personsCreated: number;
  relationsCreated: number;
  skippedApartments: number;
};

type AuthContext = {
  token: string;
  tenantId: string;
  siteId?: string | null;
};

export function getSetupSummary(auth: AuthContext) {
  return apiRequest<SetupSummary>("/api/site-setup/summary", auth);
}

export function updateSetupStatus(auth: AuthContext, status: SetupStatus) {
  return apiRequest<{ site: Site }>("/api/site-setup/status", {
    ...auth,
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function bulkCreateBuildings(auth: AuthContext, buildings: BulkBuildingInput[]) {
  return apiRequest<{
    buildings: Array<{ id: string; name: string; code: string | null }>;
    apartmentsCreated: number;
  }>("/api/site-setup/buildings/bulk", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ buildings }),
  });
}

export function bulkCreateApartments(
  auth: AuthContext,
  buildingId: string,
  apartments: BulkApartmentInput[],
) {
  return apiRequest<{ created: number; skipped: number }>("/api/site-setup/apartments/bulk", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ buildingId, apartments }),
  });
}

export type AssignResidentPayload = {
  apartmentId: string;
  relationType: RelationType;
  personId?: string;
  person?: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  isPrimary?: boolean;
};

export function assignResident(auth: AuthContext, payload: AssignResidentPayload) {
  return apiRequest<{
    person: Person;
    relation: { id: string; relationType: RelationType; isPrimary: boolean };
  }>("/api/site-setup/residents", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function previewImport(auth: AuthContext, rows: ImportRow[]) {
  return apiRequest<ImportPreviewResult>("/api/site-setup/import/preview", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export function commitImport(auth: AuthContext, rows: ImportRow[]) {
  return apiRequest<ImportCommitResult>("/api/site-setup/import/commit", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export type ResidentImportRow = {
  buildingName?: string;
  apartmentNumber: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  tenantFirstName?: string;
  tenantLastName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
};

export type ResidentImportPreviewRow = {
  line: number;
  buildingName: string | null;
  apartmentNumber: string;
  apartmentId: string | null;
  ownerLabel: string | null;
  tenantLabel: string | null;
  status: "ready" | "warning" | "error" | "skip";
  errors: string[];
  warnings: string[];
};

export type ResidentImportPreviewResult = {
  needsBuilding: boolean;
  rowCount: number;
  matchedApartmentCount: number;
  ownerCount: number;
  tenantCount: number;
  readyCount: number;
  warningCount: number;
  errorCount: number;
  errors: string[];
  warnings: string[];
  rows: ResidentImportPreviewRow[];
};

export type ResidentImportCommitResult = {
  personsCreated: number;
  ownersLinked: number;
  tenantsLinked: number;
  relationsReplaced: number;
  skippedRows: number;
  importedRows: number;
};

export function previewResidentsImport(auth: AuthContext, rows: ResidentImportRow[]) {
  return apiRequest<ResidentImportPreviewResult>("/api/site-setup/residents/import/preview", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export function commitResidentsImport(auth: AuthContext, rows: ResidentImportRow[]) {
  return apiRequest<ResidentImportCommitResult>("/api/site-setup/residents/import/commit", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}
