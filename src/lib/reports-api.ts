import { API_URL, ApiError, apiRequest } from "@/lib/http";

type Auth = { token: string; tenantId: string; siteId: string };

export type ReportType =
  | "financial-summary"
  | "apartment-debts"
  | "payments"
  | "expenses"
  | "bank-transactions"
  | "apartment-statement";

export type ReportQuery = {
  dateFrom?: string;
  dateTo?: string;
  buildingId?: string;
  apartmentId?: string;
  debtFilter?: "all" | "with_debt" | "overdue" | "closed";
  paymentMethod?: string;
  includeCancelled?: boolean;
  expenseTypeId?: string;
  supplierId?: string;
  status?: string;
  bankAccountId?: string;
  direction?: string;
  matchFilter?: string;
};

function toQuery(params: ReportQuery): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function fetchFinancialSummaryReport(auth: Auth, params: ReportQuery) {
  return apiRequest<Record<string, unknown>>(`/api/reports/financial-summary${toQuery(params)}`, auth);
}

export function fetchApartmentDebtsReport(auth: Auth, params: ReportQuery) {
  return apiRequest<Record<string, unknown>>(`/api/reports/apartment-debts${toQuery(params)}`, auth);
}

export function fetchPaymentsReport(auth: Auth, params: ReportQuery) {
  return apiRequest<Record<string, unknown>>(`/api/reports/payments${toQuery(params)}`, auth);
}

export function fetchExpensesReport(auth: Auth, params: ReportQuery) {
  return apiRequest<Record<string, unknown>>(`/api/reports/expenses${toQuery(params)}`, auth);
}

export function fetchBankTransactionsReport(auth: Auth, params: ReportQuery) {
  return apiRequest<Record<string, unknown>>(
    `/api/reports/bank-transactions${toQuery(params)}`,
    auth,
  );
}

export function fetchApartmentStatementReport(auth: Auth, params: ReportQuery) {
  return apiRequest<Record<string, unknown>>(
    `/api/reports/apartment-statement${toQuery(params)}`,
    auth,
  );
}

export async function fetchReport(
  auth: Auth,
  reportType: ReportType,
  params: ReportQuery,
): Promise<Record<string, unknown>> {
  switch (reportType) {
    case "financial-summary":
      return fetchFinancialSummaryReport(auth, params);
    case "apartment-debts":
      return fetchApartmentDebtsReport(auth, params);
    case "payments":
      return fetchPaymentsReport(auth, params);
    case "expenses":
      return fetchExpensesReport(auth, params);
    case "bank-transactions":
      return fetchBankTransactionsReport(auth, params);
    case "apartment-statement":
      return fetchApartmentStatementReport(auth, params);
    default:
      throw new ApiError(400, "Geçersiz rapor türü.");
  }
}

export async function downloadReportExport(
  auth: Auth,
  reportType: ReportType,
  format: "pdf" | "xlsx",
  params: ReportQuery,
): Promise<void> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  query.set("format", format);
  const response = await fetch(`${API_URL}/api/reports/${reportType}/export?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "X-Tenant-Id": auth.tenantId,
      "X-Site-Id": auth.siteId,
    },
  });

  if (!response.ok) {
    let message = format === "pdf" ? "PDF oluşturulamadı. Lütfen tekrar deneyin." : "Excel indirilemedi.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] ?? `${reportType}.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
