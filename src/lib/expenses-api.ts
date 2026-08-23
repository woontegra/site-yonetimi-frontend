import { apiRequest } from "@/lib/http";
import type { PaymentMethod } from "@/lib/payments-api";

export type ExpenseStatus = "COMPLETED" | "CANCELLED";

export type ExpenseType = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt: string | null;
  expenseCount: number;
};

export type Expense = {
  id: string;
  title: string;
  amount: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNo: string | null;
  description: string | null;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt?: string;
  cancelledAt: string | null;
  building: { id: string; name: string } | null;
  expenseType: { id: string; name: string; isActive: boolean };
  supplier: { id: string; name: string; isActive: boolean } | null;
};

export type ExpensePayload = {
  title: string;
  expenseTypeId: string;
  amount: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  buildingId?: string;
  supplierId?: string;
  referenceNo?: string;
  description?: string;
};

export type ExpenseListResponse = {
  items: Expense[];
  page: number;
  perPage: number;
  total: number;
  summary: { totalAmount: string };
};

export type MonthlyExpenseSummary = {
  year: number;
  months: Array<{ month: number; total: string }>;
  currentMonthTotal: string;
};

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export type ExpenseListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  expenseTypeId?: string;
  buildingId?: string;
  supplierId?: string;
  paymentMethod?: PaymentMethod;
  status?: ExpenseStatus;
  dateFrom?: string;
  dateTo?: string;
};

export function listExpenses(auth: AuthContext, params: ExpenseListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.expenseTypeId) query.set("expenseTypeId", params.expenseTypeId);
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.supplierId) query.set("supplierId", params.supplierId);
  if (params.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<ExpenseListResponse>(`/api/expenses${suffix}`, auth);
}

export function getExpense(auth: AuthContext, id: string) {
  return apiRequest<{ expense: Expense }>(`/api/expenses/${id}`, auth);
}

export function createExpense(auth: AuthContext, payload: ExpensePayload) {
  return apiRequest<{ expense: Expense }>("/api/expenses", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ExpenseUpdatePayload = {
  title?: string;
  expenseTypeId?: string;
  amount?: number;
  expenseDate?: string;
  paymentMethod?: PaymentMethod;
  buildingId?: string | null;
  supplierId?: string | null;
  referenceNo?: string | null;
  description?: string | null;
};

export function updateExpense(auth: AuthContext, id: string, payload: ExpenseUpdatePayload) {
  return apiRequest<{ expense: Expense }>(`/api/expenses/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cancelExpense(auth: AuthContext, id: string) {
  return apiRequest<{ expense: Expense }>(`/api/expenses/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function getMonthlyExpenseSummary(auth: AuthContext, year?: number) {
  const query = year ? `?year=${year}` : "";
  return apiRequest<MonthlyExpenseSummary>(`/api/expenses/summary/monthly${query}`, auth);
}

export function listExpenseTypes(auth: AuthContext, params: { search?: string; activeOnly?: boolean } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.activeOnly) query.set("activeOnly", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: ExpenseType[] }>(`/api/expense-types${suffix}`, auth);
}

export function createExpenseType(auth: AuthContext, payload: { name: string; sortOrder?: number }) {
  return apiRequest<{ expenseType: ExpenseType }>("/api/expense-types", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateExpenseType(
  auth: AuthContext,
  id: string,
  payload: { name?: string; isActive?: boolean; sortOrder?: number },
) {
  return apiRequest<{ expenseType: ExpenseType }>(`/api/expense-types/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteExpenseType(auth: AuthContext, id: string) {
  return apiRequest<{ expenseType: ExpenseType; deactivated: boolean }>(`/api/expense-types/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
