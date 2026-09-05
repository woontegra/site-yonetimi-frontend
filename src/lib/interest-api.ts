import { apiRequest } from "@/lib/http";

export type InterestDecisionStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export type InterestDecision = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  monthlyRate: string;
  ratePeriod: "MONTHLY";
  description: string | null;
  status: InterestDecisionStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string } | null;
  applicationCount: number;
  formula: string;
};

export type InterestDecisionPayload = {
  name: string;
  startDate: string;
  endDate: string;
  monthlyRate: number;
  ratePeriod?: "MONTHLY";
  description?: string;
  status?: InterestDecisionStatus;
};

export type InterestPreviewRow = {
  status: "APPLICABLE" | "ALREADY_APPLIED" | "EXCLUDED";
  excludeReason: string | null;
  warning: string | null;
  sourceDebtId: string;
  buildingName: string;
  apartmentNumber: string;
  apartmentId: string;
  personLabel: string;
  relationLabel: string | null;
  sourceTitle: string;
  sourceType: "DUES" | "MANUAL" | "INTEREST";
  sourcePeriodLabel: string | null;
  dueDate: string;
  elapsedLabel: string;
  paymentsInWindow: string;
  principalBase: string;
  monthlyRate: string;
  interestAmount: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  calculationNote: string | null;
  alreadyAppliedInterestDebtId: string | null;
};

export type InterestPreviewSummary = {
  apartmentsInspected: number;
  apartmentsApplicable: number;
  debtsApplicable: number;
  debtsExcluded: number;
  alreadyAppliedCount: number;
  applicableCount: number;
  excludedCount: number;
  totalOpenPrincipal: string;
  totalInterest: string;
  calculationAsOf: string;
  applyMessage: string;
};

export type InterestPreviewResult = {
  decision: InterestDecision;
  formula: string;
  summary: InterestPreviewSummary;
  rows: InterestPreviewRow[];
};

export type InterestApplyResult = {
  createdCount: number;
  interestDebtIds: string[];
  summary: InterestPreviewSummary;
  message: string;
};

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export function listInterestDecisions(
  auth: AuthContext,
  params: { status?: InterestDecisionStatus; page?: number; perPage?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const qs = query.toString();
  return apiRequest<{
    items: InterestDecision[];
    page: number;
    perPage: number;
    total: number;
  }>(`/api/interest-decisions${qs ? `?${qs}` : ""}`, {
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
  });
}

export function createInterestDecision(auth: AuthContext, payload: InterestDecisionPayload) {
  return apiRequest<{ decision: InterestDecision }>("/api/interest-decisions", {
    method: "POST",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
    body: JSON.stringify(payload),
  });
}

export function updateInterestDecision(
  auth: AuthContext,
  id: string,
  payload: Partial<InterestDecisionPayload>,
) {
  return apiRequest<{ decision: InterestDecision }>(`/api/interest-decisions/${id}`, {
    method: "PATCH",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
    body: JSON.stringify(payload),
  });
}

export function deleteInterestDecision(auth: AuthContext, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/interest-decisions/${id}`, {
    method: "DELETE",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
  });
}

export type InterestRangePayload = {
  decisionId: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  buildingId?: string;
  apartmentId?: string;
};

export function previewInterest(auth: AuthContext, payload: InterestRangePayload) {
  return apiRequest<InterestPreviewResult>("/api/interest-decisions/preview", {
    method: "POST",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
    body: JSON.stringify(payload),
  });
}

export function applyInterest(auth: AuthContext, payload: InterestRangePayload) {
  return apiRequest<InterestApplyResult>("/api/interest-decisions/apply", {
    method: "POST",
    token: auth.token,
    tenantId: auth.tenantId,
    siteId: auth.siteId,
    body: JSON.stringify(payload),
  });
}
