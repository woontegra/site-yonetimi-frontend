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

export type BankDebitClass = "UNCLASSIFIED" | "EXPENSE" | "EXCLUDED";

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
  debitClass: BankDebitClass | null;
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
  expense: { id: string; title: string; amount: string; status: string } | null;
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
  debitClass?: BankDebitClass;
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
  if (params.debitClass) query.set("debitClass", params.debitClass);
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

export function processBankTransactionAuto(auth: AuthContext, id: string, personId?: string | null) {
  return apiRequest<{ bankTransaction: BankTransaction }>(
    `/api/bank-transactions/${id}/process-auto`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify(personId ? { personId } : {}),
    },
  );
}

export function confirmBankTransactionMatch(auth: AuthContext, id: string) {
  return apiRequest<{ bankTransaction: BankTransaction }>(
    `/api/bank-transactions/${id}/confirm-match`,
    {
      ...auth,
      method: "POST",
    },
  );
}

export type ClassifyBankDebitPayload =
  | { action: "EXCLUDE" }
  | { action: "RESET" }
  | {
      action: "CREATE_EXPENSE";
      title: string;
      expenseTypeId: string;
      expenseDate: string;
      paymentMethod?: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "OTHER";
      buildingId?: string;
      supplierId?: string;
      referenceNo?: string;
      description?: string;
    };

export function classifyBankDebit(auth: AuthContext, id: string, payload: ClassifyBankDebitPayload) {
  return apiRequest<{ bankTransaction: BankTransaction }>(
    `/api/bank-transactions/${id}/classify-debit`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export type BankProcessPreviewAllocation = {
  apartmentDebtId: string;
  amount: string;
  title: string;
  periodYear: number | null;
  periodMonth: number | null;
  remainingBefore: string;
  remainingAfter: string;
};

export type BankProcessPreviewItem = {
  id: string;
  eligible: boolean;
  bulkSafe: boolean;
  risky: boolean;
  warning: string | null;
  amount: string | null;
  senderHint: string | null;
  description?: string;
  transactionDate?: string;
  apartment: { id: string; number: string; building: { id: string; name: string } } | null;
  registeredPerson: string | null;
  matchedPerson: string | null;
  openDebtTotal: string | null;
  allocations: BankProcessPreviewAllocation[];
  matchKind: string | null;
  nameMismatch: boolean;
  matchStatus?: BankMatchStatus;
  apartmentGroupStatus?: string | null;
  periodHints?: Array<{ year: number | null; month: number }>;
};

export type BankApartmentGroupStatus =
  | "READY"
  | "OVERPAYMENT"
  | "NO_OPEN_DEBT"
  | "MANUAL_REVIEW";

export type BankApartmentGroupPreview = {
  apartmentId: string;
  apartment: { id: string; number: string; building: { id: string; name: string } } | null;
  registeredPerson: string | null;
  ownerLabel?: string | null;
  senderLabels?: string[];
  transactionIds: string[];
  transactionCount: number;
  totalIncoming: string;
  openDebtTotal: string;
  allocatableTotal: string;
  remainderTotal: string;
  debtsCovered?: number;
  unifiedAllocations: Array<{
    apartmentDebtId: string;
    title: string;
    periodYear: number | null;
    periodMonth: number | null;
    amount: string;
    remainingAfter: string;
  }>;
  periodConflicts?: Array<{
    periodYear: number | null;
    periodMonth: number;
    label: string;
    transactionIds: string[];
  }>;
  status: BankApartmentGroupStatus;
  warning: string | null;
  summaryLine?: string | null;
  transactionPlans: Array<{
    transactionId: string;
    allocations: BankProcessPreviewAllocation[];
    allocatedTotal: string;
    remainder: string;
    allocatable: boolean;
    periodHints?: Array<{ year: number | null; month: number }>;
    warning: string | null;
  }>;
};

export type BankProcessPreviewResponse = {
  items: BankProcessPreviewItem[];
  apartmentGroups?: BankApartmentGroupPreview[];
  summary: {
    total: number;
    eligible: number;
    bulkSafe: number;
    risky: number;
    blocked: number;
    totalAmount: string;
    bulkSafeAmount: string;
    multiPaymentApartmentCount?: number;
    periodConflictApartmentCount?: number;
  };
};

export function previewBankProcessBatch(auth: AuthContext, ids: string[]) {
  return apiRequest<BankProcessPreviewResponse>("/api/bank-transactions/process-batch/preview", {
    ...auth,
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function processBankTransactionBatch(
  auth: AuthContext,
  ids: string[],
  options?: {
    includeRisky?: boolean;
    resolvePeriodConflicts?: "SKIP" | "SEQUENTIAL";
    allocationOverrides?: Array<{
      transactionId: string;
      allocations: Array<{ apartmentDebtId: string; amount: number }>;
    }>;
  },
) {
  return apiRequest<{
    results: Array<{
      id: string;
      status: "processed" | "skipped" | "failed";
      message: string;
      paymentId?: string;
    }>;
    summary: { processed: number; skipped: number; failed: number };
    apartmentGroups?: BankApartmentGroupPreview[];
  }>("/api/bank-transactions/process-batch", {
    ...auth,
    method: "POST",
    body: JSON.stringify({
      ids,
      includeRisky: options?.includeRisky ?? false,
      resolvePeriodConflicts: options?.resolvePeriodConflicts ?? "SKIP",
      ...(options?.allocationOverrides
        ? { allocationOverrides: options.allocationOverrides }
        : {}),
    }),
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

export type BankHubSummary = {
  accounts: number;
  pendingMatch: number;
  unmatched: number;
  unmatchedCredit?: number;
  unclassifiedDebit: number;
  processedThisMonth: number;
  expensesThisMonth: number;
};

export type StatementPreviewMatch = {
  apartmentId: string | null;
  personId: string | null;
  buildingId: string | null;
  matchStatus: "UNMATCHED" | "SUGGESTED";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reason: string;
  candidateCount: number;
  matchReason?: string;
  matchKind?: string;
  matchedPersonRole?: "OWNER" | "TENANT" | null;
  matchedPersonName?: string | null;
  nameMismatch?: boolean;
};

export type StatementPreviewRow = {
  rowIndex: number;
  transactionDate: string;
  valueDate?: string | null;
  direction: BankDirection;
  amount: number;
  description: string;
  referenceNo?: string | null;
  balanceAfter?: number | null;
  sourceRowNumber?: number;
  sourcePage?: number | null;
  fingerprint: string;
  previewStatus: "READY" | "DUPLICATE" | "INVALID" | "DEBIT_SKIP_PAYMENT" | "AMBIGUOUS";
  match: StatementPreviewMatch | null;
  suggestedPattern: string | null;
  message: string;
  allocationPreview?: Array<{ apartmentDebtId: string; label: string; amount: string }>;
  allocationRemainder?: string;
  canAutoProcess?: boolean;
};

export type StatementPreviewResponse = {
  summary: {
    totalRows: number;
    creditCount: number;
    debitCount: number;
    invalidCount: number;
    duplicateCount: number;
    autoMatchedCount: number;
    unmatchedCount: number;
    importableCreditTotal: string;
  };
  rows: StatementPreviewRow[];
};

export type StatementCommitRow = {
  transactionDate: string;
  valueDate?: string | null;
  direction: BankDirection;
  amount: number;
  description: string;
  referenceNo?: string | null;
  balanceAfter?: number | null;
  sourceRowNumber?: number;
  fingerprint?: string;
  matchedApartmentId?: string | null;
  matchedPersonId?: string | null;
  processPayment?: boolean;
  createRule?: boolean;
  containsText?: string | null;
  ruleName?: string | null;
  skip?: boolean;
};

export type StatementCommitResponse = {
  createdCount: number;
  duplicateSkipped: number;
  processedPayments: number;
  matchedWithoutPayment: number;
  createdIds: string[];
};

export type BankColumnMapping = {
  date: string;
  description: string;
  amount?: string | null;
  debit?: string | null;
  credit?: string | null;
  reference?: string | null;
  balance?: string | null;
  valueDate?: string | null;
};

export type BankColumnTemplate = {
  id: string;
  name: string;
  mapping: BankColumnMapping;
  createdAt: string;
  updatedAt: string;
  bankAccount: { id: string; bankName: string; accountName: string } | null;
};

export function getBankHubSummary(auth: AuthContext) {
  return apiRequest<{ summary: BankHubSummary }>("/api/bank-transactions/summary/hub", auth);
}

export function previewBankStatementImport(
  auth: AuthContext,
  payload: { bankAccountId: string; rows: StatementCommitRow[] },
  options?: { signal?: AbortSignal },
) {
  return apiRequest<StatementPreviewResponse>("/api/bank-transactions/import/preview", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
    signal: options?.signal,
  });
}

export function commitBankStatementImport(
  auth: AuthContext,
  payload: { bankAccountId: string; rows: StatementCommitRow[] },
) {
  return apiRequest<StatementCommitResponse>("/api/bank-transactions/import/commit", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function unmatchBankTransaction(auth: AuthContext, id: string) {
  return apiRequest<{ bankTransaction: BankTransaction }>(`/api/bank-transactions/${id}/unmatch`, {
    ...auth,
    method: "POST",
  });
}

export function listBankColumnTemplates(auth: AuthContext, bankAccountId?: string) {
  const query = new URLSearchParams();
  if (bankAccountId) query.set("bankAccountId", bankAccountId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: BankColumnTemplate[] }>(`/api/bank-column-templates${suffix}`, auth);
}

export function createBankColumnTemplate(
  auth: AuthContext,
  payload: { name: string; bankAccountId?: string | null; mapping: BankColumnMapping },
) {
  return apiRequest<{ template: BankColumnTemplate }>("/api/bank-column-templates", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteBankColumnTemplate(auth: AuthContext, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/bank-column-templates/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

