import { apiRequest } from "@/lib/http";

export type DuesDefinition = {
  id: string;
  name: string;
  amount: string;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  assessmentBatchId?: string | null;
  building: { id: string; name: string };
  chargedApartmentCount: number;
  activeApartmentCount?: number;
  chargedOpenCount?: number;
  totalOriginalAmount?: string;
  totalRemainingAmount?: string;
  hasCollections?: boolean;
  canHardDelete?: boolean;
  canSafeCancel?: boolean;
  canChargeMore?: boolean;
  financialFieldsLocked?: boolean;
  collectedAmount?: string;
};

export type DuesListResponse = {
  items: DuesDefinition[];
  page: number;
  perPage: number;
  total: number;
};

export type DuesPayload = {
  buildingId: string;
  name: string;
  amount: number;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  description?: string;
  chargeImmediately?: boolean;
};

export type ChargePreview = {
  dues: DuesDefinition;
  activeApartmentCount: number;
  alreadyChargedCount: number;
  pendingChargeCount: number;
  normalChargeCount?: number;
  exemptCount?: number;
  discountedCount?: number;
  amountPerApartment?: string;
  totalChargeAmount: string;
  exemptApartments?: Array<{
    apartmentId: string;
    number: string;
    label: string;
    exemptionType: string;
    reason: string;
    reasonLabel: string;
    startDate: string;
    endDate: string | null;
    note: string | null;
  }>;
  discountedApartments?: Array<{
    apartmentId: string;
    number: string;
    label: string;
    exemptionType: string;
    reason: string;
    reasonLabel: string;
    startDate: string;
    endDate: string | null;
    amount: string;
  }>;
};

export type ChargeScopePreview = Omit<ChargePreview, "dues">;

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export function listDuesDefinitions(
  auth: AuthContext,
  params: {
    search?: string;
    page?: number;
    perPage?: number;
    buildingId?: string;
    periodYear?: number;
    periodMonth?: number;
    status?: "aktif" | "pasif";
  } = {},
) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.periodYear) query.set("periodYear", String(params.periodYear));
  if (params.periodMonth) query.set("periodMonth", String(params.periodMonth));
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<DuesListResponse>(`/api/dues-definitions${suffix}`, auth);
}

export function getDuesDefinition(auth: AuthContext, id: string) {
  return apiRequest<{ dues: DuesDefinition }>(`/api/dues-definitions/${id}`, auth);
}

export function createDuesDefinition(
  auth: AuthContext,
  payload: DuesPayload,
  options?: { idempotencyKey?: string },
) {
  return apiRequest<{ dues: DuesDefinition; createdCount?: number; totalAmount?: string }>(
    "/api/dues-definitions",
    {
      ...auth,
      method: "POST",
      body: JSON.stringify(payload),
      headers: options?.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : undefined,
    },
  );
}

export function updateDuesDefinition(auth: AuthContext, id: string, payload: Partial<DuesPayload> & { isActive?: boolean }) {
  return apiRequest<{ dues: DuesDefinition }>(`/api/dues-definitions/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDuesDefinition(auth: AuthContext, id: string) {
  return apiRequest<void>(`/api/dues-definitions/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function getChargePreview(auth: AuthContext, id: string) {
  return apiRequest<ChargePreview>(`/api/dues-definitions/${id}/charge-preview`, auth);
}

export function getChargeScopePreview(
  auth: AuthContext,
  params: { buildingId: string; periodYear: number; periodMonth: number; amount: number },
) {
  const query = new URLSearchParams({
    buildingId: params.buildingId,
    periodYear: String(params.periodYear),
    periodMonth: String(params.periodMonth),
    amount: String(params.amount),
  });
  return apiRequest<ChargeScopePreview>(
    `/api/dues-definitions/charge-scope-preview?${query.toString()}`,
    auth,
  );
}

export function chargeDues(auth: AuthContext, id: string) {
  return apiRequest<{ createdCount: number; totalAmount: string; dues: DuesDefinition }>(
    `/api/dues-definitions/${id}/charge`,
    { ...auth, method: "POST", body: "{}" },
  );
}

export function cancelOpenDuesDebts(auth: AuthContext, id: string) {
  return apiRequest<{ cancelledCount: number; skippedDueToPayment?: number; dues: DuesDefinition }>(
    `/api/dues-definitions/${id}/cancel-open-debts`,
    { ...auth, method: "POST", body: "{}" },
  );
}

export type DuesPurgePreview = {
  dues: DuesDefinition;
  debtCount: number;
  deletableDebtCount: number;
  collectedAmount: string;
  canHardDelete: boolean;
  hasCollections: boolean;
  blockedReason: string | null;
  totalOriginalAmount: string;
};

export function getDuesPurgePreview(auth: AuthContext, id: string) {
  return apiRequest<DuesPurgePreview>(`/api/dues-definitions/${id}/purge-preview`, auth);
}

export function purgeDuesAssessment(auth: AuthContext, id: string, confirmName: string) {
  return apiRequest<{ deletedDebtCount: number; totalAmount: string }>(
    `/api/dues-definitions/${id}/purge`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify({ confirmName }),
    },
  );
}

export type MultiPeriodAssessmentPayload = {
  buildingId: string;
  amount: number;
  description?: string;
  dueDay: number | "END";
  conflictPolicy: "ABORT" | "SKIP";
  mode: "SINGLE" | "RANGE" | "YEAR" | "CUSTOM";
  periodYear?: number;
  periodMonth?: number;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  year?: number;
  months?: number[];
  assessmentBatchId?: string;
};

export type AssessmentPeriodPreview = {
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  name: string;
  dueDate: string;
  status: "EXISTS" | "CREATE";
  existingDuesId: string | null;
  existingDuesName: string | null;
  activeApartmentCount: number;
  normalChargeCount: number;
  exemptCount: number;
  discountedCount: number;
  pendingChargeCount: number;
  totalChargeAmount: string;
  exemptApartments?: ChargeScopePreview["exemptApartments"];
};

export type MultiPeriodAssessmentPreview = {
  buildingId: string;
  amountPerApartment: string;
  dueDay: number | "END";
  conflictPolicy: "ABORT" | "SKIP";
  periodCount: number;
  createPeriodCount: number;
  skipPeriodCount: number;
  totalDebtCount: number;
  totalExemptRows: number;
  totalChargeAmount: string;
  periods: AssessmentPeriodPreview[];
  canCreate: boolean;
  requiresConflictChoice: boolean;
  blockedByConflicts?: boolean;
};

export type MultiPeriodAssessmentResult = {
  assessmentBatchId: string;
  replay: boolean;
  createdPeriodCount: number;
  createdDebtCount: number;
  skippedPeriodCount: number;
  skippedPeriods: Array<{ periodYear: number; periodMonth: number; existingDuesId: string }>;
  totalAmount: string;
  dues: DuesDefinition[];
};

export type AssessmentBatchResponse = {
  assessmentBatchId: string;
  periodCount: number;
  canHardDelete: boolean;
  blockedReason: string | null;
  items: DuesDefinition[];
};

export function previewMultiPeriodAssessment(
  auth: AuthContext,
  payload: MultiPeriodAssessmentPayload,
) {
  return apiRequest<MultiPeriodAssessmentPreview>("/api/dues-definitions/assessment-preview", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createMultiPeriodAssessment(
  auth: AuthContext,
  payload: MultiPeriodAssessmentPayload,
  options?: { idempotencyKey?: string },
) {
  return apiRequest<MultiPeriodAssessmentResult>("/api/dues-definitions/assessment-batch", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
    headers: options?.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined,
  });
}

export function getAssessmentBatch(auth: AuthContext, batchId: string) {
  return apiRequest<AssessmentBatchResponse>(`/api/dues-definitions/batches/${batchId}`, auth);
}

export function purgeAssessmentBatch(auth: AuthContext, batchId: string, confirmName: string) {
  return apiRequest<{
    assessmentBatchId: string;
    deletedPeriodCount: number;
    deletedDebtCount: number;
    totalAmount: string;
  }>(`/api/dues-definitions/batches/${batchId}/purge`, {
    ...auth,
    method: "POST",
    body: JSON.stringify({ confirmName }),
  });
}
