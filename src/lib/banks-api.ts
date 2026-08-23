import { apiRequest } from "@/lib/http";

export type BankConnectionType = "MANUAL" | "API";
export type BankDirection = "CREDIT" | "DEBIT";
export type BankMatchStatus = "UNMATCHED" | "SUGGESTED" | "MATCHED" | "PROCESSED";
export type BankTransactionStatus = "ACTIVE" | "IGNORED";

export type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  ibanFull?: string | null;
  accountNumber: string | null;
  branchName: string | null;
  currency: string;
  openingBalance: string;
  bookBalance: string;
  isActive: boolean;
  connectionType: BankConnectionType;
  connectionLabel: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BankTransaction = {
  id: string;
  transactionDate: string;
  valueDate: string | null;
  direction: BankDirection;
  amount: string;
  description: string;
  senderName: string | null;
  senderIban: string | null;
  referenceNo: string | null;
  balanceAfter: string | null;
  status: BankTransactionStatus;
  matchStatus: BankMatchStatus;
  matchedAt: string | null;
  processedAt: string | null;
  ignoredAt: string | null;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  bankAccount: { id: string; bankName: string; accountName: string };
  matchedApartment: {
    id: string;
    number: string;
    building: { id: string; name: string };
  } | null;
  matchedPerson: { id: string; fullName: string } | null;
  payment: { id: string; amount: string; status: string } | null;
};

export type BankMatchingRule = {
  id: string;
  name: string;
  containsText: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  bankAccount: { id: string; bankName: string; accountName: string } | null;
  building: { id: string; name: string } | null;
  apartment: { id: string; number: string } | null;
  person: { id: string; fullName: string } | null;
};

export type BankAccountPayload = {
  bankName: string;
  accountName: string;
  iban?: string;
  accountNumber?: string;
  branchName?: string;
  openingBalance?: number;
};

export type BankAccountUpdatePayload = {
  bankName?: string;
  accountName?: string;
  iban?: string | null;
  accountNumber?: string | null;
  branchName?: string | null;
  openingBalance?: number;
  isActive?: boolean;
};

export type BankTransactionPayload = {
  bankAccountId: string;
  transactionDate: string;
  direction: BankDirection;
  amount: number;
  description: string;
  senderName?: string;
  senderIban?: string;
  referenceNo?: string;
};

export type BankMatchPayload = {
  apartmentId: string;
  personId?: string;
  createRule?: boolean;
  ruleName?: string;
  containsText?: string;
};

export type BankProcessPayload = {
  personId?: string;
  allocations: Array<{ apartmentDebtId: string; amount: number }>;
};

export type BankMatchingRulePayload = {
  bankAccountId?: string;
  name: string;
  containsText: string;
  buildingId?: string;
  apartmentId?: string;
  personId?: string;
  priority?: number;
};

export type BankMatchingRuleUpdatePayload = {
  name?: string;
  containsText?: string;
  buildingId?: string | null;
  apartmentId?: string | null;
  personId?: string | null;
  priority?: number;
  isActive?: boolean;
};

export type BankAccountListResponse = {
  items: BankAccount[];
  page: number;
  perPage: number;
  total: number;
};

export type BankTransactionListResponse = {
  items: BankTransaction[];
  page: number;
  perPage: number;
  total: number;
};

export type BankMatchingRuleListResponse = {
  items: BankMatchingRule[];
};

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

export type BankAccountListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  activeOnly?: boolean;
};

export type BankTransactionListParams = {
  search?: string;
  page?: number;
  perPage?: number;
  bankAccountId?: string;
  direction?: BankDirection;
  matchStatus?: BankMatchStatus;
  status?: BankTransactionStatus;
  dateFrom?: string;
  dateTo?: string;
};

export type BankMatchingRuleListParams = {
  bankAccountId?: string;
  activeOnly?: boolean;
};

export function listBankAccounts(auth: AuthContext, params: BankAccountListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.activeOnly) query.set("activeOnly", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<BankAccountListResponse>(`/api/bank-accounts${suffix}`, auth);
}

export function getBankAccount(auth: AuthContext, id: string) {
  return apiRequest<{ bankAccount: BankAccount }>(`/api/bank-accounts/${id}`, auth);
}

export function createBankAccount(auth: AuthContext, payload: BankAccountPayload) {
  return apiRequest<{ bankAccount: BankAccount }>("/api/bank-accounts", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBankAccount(auth: AuthContext, id: string, payload: BankAccountUpdatePayload) {
  return apiRequest<{ bankAccount: BankAccount }>(`/api/bank-accounts/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBankAccount(auth: AuthContext, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/bank-accounts/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function listBankTransactions(auth: AuthContext, params: BankTransactionListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  if (params.bankAccountId) query.set("bankAccountId", params.bankAccountId);
  if (params.direction) query.set("direction", params.direction);
  if (params.matchStatus) query.set("matchStatus", params.matchStatus);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<BankTransactionListResponse>(`/api/bank-transactions${suffix}`, auth);
}

export function getBankTransaction(auth: AuthContext, id: string) {
  return apiRequest<{ bankTransaction: BankTransaction }>(`/api/bank-transactions/${id}`, auth);
}

export function createBankTransaction(auth: AuthContext, payload: BankTransactionPayload) {
  return apiRequest<{ bankTransaction: BankTransaction }>("/api/bank-transactions", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function matchBankTransaction(auth: AuthContext, id: string, payload: BankMatchPayload) {
  return apiRequest<{ bankTransaction: BankTransaction }>(`/api/bank-transactions/${id}/match`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function processBankTransaction(auth: AuthContext, id: string, payload: BankProcessPayload) {
  return apiRequest<{ bankTransaction: BankTransaction }>(`/api/bank-transactions/${id}/process`, {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function ignoreBankTransaction(auth: AuthContext, id: string) {
  return apiRequest<{ bankTransaction: BankTransaction }>(`/api/bank-transactions/${id}/ignore`, {
    ...auth,
    method: "POST",
  });
}

export function listBankMatchingRules(auth: AuthContext, params: BankMatchingRuleListParams = {}) {
  const query = new URLSearchParams();
  if (params.bankAccountId) query.set("bankAccountId", params.bankAccountId);
  if (params.activeOnly) query.set("activeOnly", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<BankMatchingRuleListResponse>(`/api/bank-matching-rules${suffix}`, auth);
}

export function createBankMatchingRule(auth: AuthContext, payload: BankMatchingRulePayload) {
  return apiRequest<{ rule: BankMatchingRule }>("/api/bank-matching-rules", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBankMatchingRule(
  auth: AuthContext,
  id: string,
  payload: BankMatchingRuleUpdatePayload,
) {
  return apiRequest<{ rule: BankMatchingRule }>(`/api/bank-matching-rules/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBankMatchingRule(auth: AuthContext, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/bank-matching-rules/${id}`, {
    ...auth,
    method: "DELETE",
  });
}
