import { apiRequest } from "@/lib/http";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "OTHER";
export type PaymentStatus = "COMPLETED" | "CANCELLED";

export type PaymentAllocation = {
  id: string;
  amount: string;
  debt: {
    id: string;
    title: string;
    dueDate: string;
    type: string;
    status: string;
  };
};

export type Payment = {
  id: string;
  title: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNo: string | null;
  description: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
  cancelledAt: string | null;
  apartment: { id: string; number: string };
  building: { id: string; name: string };
  person: { id: string; fullName: string } | null;
  allocations: PaymentAllocation[];
};

export type PaymentListResponse = {
  items: Payment[];
  page: number;
  perPage: number;
  total: number;
  summary: { totalAmount: string };
};

export type PaymentPayload = {
  apartmentId: string;
  personId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  description?: string;
  allocations: Array<{ apartmentDebtId: string; amount: number }>;
  confirmedWarningCodes?: string[];
  expectedRemainings?: Array<{ apartmentDebtId: string; remainingAmount: number }>;
};

export type FinanceCheckResult = {
  allowed: boolean;
  requiresConfirmation: boolean;
  issues: Array<{
    code: string;
    severity: "INFO" | "WARNING" | "BLOCK";
    title: string;
    message: string;
    apartmentId?: string;
    debtId?: string;
    paymentId?: string;
    period?: string | null;
    amount?: string;
    details?: Record<string, unknown>;
  }>;
  summary: Record<string, unknown>;
  proposedAllocation: Array<{
    apartmentDebtId: string;
    title: string;
    periodYear: number | null;
    periodMonth: number | null;
    periodLabel: string | null;
    amount: string;
    remainingBefore: string;
    remainingAfter: string;
  }>;
  debtSnapshot: Array<{ apartmentDebtId: string; remainingAmount: string }>;
};

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export type PaymentListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  buildingId?: string;
  apartmentId?: string;
  apartmentDebtId?: string;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
};

export function listPayments(auth: AuthContext, params: PaymentListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.apartmentId) query.set("apartmentId", params.apartmentId);
  if (params.apartmentDebtId) query.set("apartmentDebtId", params.apartmentDebtId);
  if (params.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<PaymentListResponse>(`/api/payments${suffix}`, auth);
}

export function getPayment(auth: AuthContext, id: string) {
  return apiRequest<{ payment: Payment }>(`/api/payments/${id}`, auth);
}

export function createPayment(auth: AuthContext, payload: PaymentPayload, idempotencyKey?: string) {
  return apiRequest<{ payment: Payment }>("/api/payments", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function previewPayment(auth: AuthContext, payload: Partial<PaymentPayload> & {
  apartmentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
}) {
  return apiRequest<{ check: FinanceCheckResult }>("/api/payments/preview", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function previewPaymentCancel(auth: AuthContext, id: string) {
  return apiRequest<{ check: FinanceCheckResult }>(`/api/payments/${id}/cancel-preview`, auth);
}

export function cancelPayment(auth: AuthContext, id: string) {
  return apiRequest<{ payment: Payment }>(`/api/payments/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function getMonthlyPaymentSummary(auth: AuthContext, year?: number) {
  const query = year ? `?year=${year}` : "";
  return apiRequest<MonthlyPaymentSummary>(`/api/payments/summary/monthly${query}`, auth);
}

export type MonthlyPaymentSummary = {
  year: number;
  months: Array<{ month: number; total: string }>;
  currentMonthTotal: string;
};
