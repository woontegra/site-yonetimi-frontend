"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Building2,
  ListFilter,
  MoreHorizontal,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  BankAccountFormModal,
  bankAccountFormToPayload,
  emptyBankAccountForm,
  type BankAccountFormValues,
} from "@/components/accounting/BankAccountFormModal";
import {
  AccountingChartPanel,
  MonthlyBarChart,
} from "@/components/accounting/AccountingChartPanel";
import { AccountingSummaryCard } from "@/components/accounting/AccountingSummaryCard";
import {
  DebtFormModal,
  debtFormToPayload,
  emptyDebtForm,
  type DebtFormValues,
} from "@/components/accounting/DebtFormModal";
import { DebtReminderBar } from "@/components/accounting/DebtReminderBar";
import { DebtReminderHistoryModal } from "@/components/accounting/DebtReminderHistoryModal";
import { DebtReminderSendModal } from "@/components/accounting/DebtReminderSendModal";
import {
  ExpenseFormModal,
  emptyExpenseForm,
  expenseFormToPayload,
  type ExpenseFormValues,
} from "@/components/accounting/ExpenseFormModal";
import { ExpenseTypesModal } from "@/components/accounting/ExpenseTypesModal";
import { PaymentFormModal } from "@/components/accounting/PaymentFormModal";
import {
  SupplierFormModal,
  emptySupplierForm,
  supplierFormToPayload,
  type SupplierFormValues,
} from "@/components/suppliers/SupplierFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { createBankAccount, listBankAccounts } from "@/lib/banks-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";
import {
  cancelApartmentDebt,
  createApartmentDebt,
  listApartmentDebts,
  type ApartmentDebt,
} from "@/lib/debts-api";
import {
  createExpense,
  getMonthlyExpenseSummary,
  listExpenseTypes,
  listExpenses,
  type Expense,
  type ExpenseType,
} from "@/lib/expenses-api";
import { ApiError } from "@/lib/http";
import {
  DEBT_TYPE_LABELS,
  MONTH_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDateTr,
  formatMoney,
} from "@/lib/money";
import {
  createPayment,
  getMonthlyPaymentSummary,
  listPayments,
  type Payment,
  type PaymentMethod,
  type PaymentPayload,
} from "@/lib/payments-api";
import { RELATION_TYPE_LABELS } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import { listRelations } from "@/lib/relations-api";
import { createSupplier, listSuppliers, type Supplier } from "@/lib/suppliers-api";

const PER_PAGE = 20;

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function expenseDatePreset(kind: "thisMonth" | "lastMonth" | "thisYear") {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (kind === "thisMonth") {
    return { from: toIsoDate(new Date(year, month, 1)), to: toIsoDate(new Date(year, month + 1, 0)) };
  }
  if (kind === "lastMonth") {
    return { from: toIsoDate(new Date(year, month - 1, 1)), to: toIsoDate(new Date(year, month, 0)) };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const tabs = [
  { id: "gelirler", label: "Tahsilatlar" },
  { id: "giderler", label: "Giderler" },
  { id: "borclar", label: "Daire Borçları" },
  { id: "gecmis", label: "Geçmiş Borçlar" },
  { id: "ozet", label: "Özet Rapor" },
] as const;

export type AccountingTabId = (typeof tabs)[number]["id"];
type TabId = AccountingTabId;

function paidAmount(debt: ApartmentDebt): string {
  const paid = Number(debt.originalAmount) - Number(debt.remainingAmount);
  return paid.toFixed(2);
}

export function AccountingPage({ initialTab = "borclar" }: { initialTab?: TabId }) {
  const { ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [tab, setTab] = useState<TabId>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function selectTab(id: TabId) {
    if (id === "giderler") {
      if (pathname !== "/app/muhasebe/giderler") {
        router.push("/app/muhasebe/giderler");
        return;
      }
      setTab(id);
      return;
    }
    if (id === "gelirler") {
      if (pathname !== "/app/muhasebe/tahsilatlar") {
        router.push("/app/muhasebe/tahsilatlar");
        return;
      }
      setTab(id);
      return;
    }
    if (id === "borclar") {
      if (pathname !== "/app/muhasebe/borclar") {
        router.push("/app/muhasebe/borclar");
        return;
      }
      setTab(id);
      return;
    }
    if (pathname !== "/app/muhasebe") {
      router.push("/app/muhasebe");
    }
    setTab(id);
  }
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [bankAccountTotal, setBankAccountTotal] = useState(0);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [bankFormPending, setBankFormPending] = useState(false);
  const [bankFormError, setBankFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [openRemaining, setOpenRemaining] = useState("0.00");
  const [indebtedApartments, setIndebtedApartments] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState("0.00");
  const [monthlyExpense, setMonthlyExpense] = useState("0.00");
  const [chartMonths, setChartMonths] = useState<Array<{ month: number; total: string }>>([]);
  const [expenseChartMonths, setExpenseChartMonths] = useState<
    Array<{ month: number; total: string }>
  >([]);

  const [paymentSearch, setPaymentSearch] = useState("");
  const debouncedPaymentSearch = useDebouncedValue(paymentSearch, 300);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");

  const [expenseSearch, setExpenseSearch] = useState("");
  const debouncedExpenseSearch = useDebouncedValue(expenseSearch, 300);
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [expenseBuildingId, setExpenseBuildingId] = useState("");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");
  const [expenseMethod, setExpenseMethod] = useState("");
  const [expenseDateFrom, setExpenseDateFrom] = useState("");
  const [expenseDateTo, setExpenseDateTo] = useState("");
  const [expenseFiltersOpen, setExpenseFiltersOpen] = useState(false);
  const [expensePage, setExpensePage] = useState(1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expenseError, setExpenseError] = useState("");
  const [expenseTypesActive, setExpenseTypesActive] = useState<ExpenseType[]>([]);
  const [filterSuppliers, setFilterSuppliers] = useState<Supplier[]>([]);

  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseFormPending, setExpenseFormPending] = useState(false);
  const [expenseFormError, setExpenseFormError] = useState("");
  const [expenseFormInitial, setExpenseFormInitial] = useState<ExpenseFormValues>(emptyExpenseForm);
  const [applySupplier, setApplySupplier] = useState<{
    id: string;
    name?: string;
    token: number;
  } | null>(null);
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);
  const [supplierQuickPending, setSupplierQuickPending] = useState(false);
  const [supplierQuickError, setSupplierQuickError] = useState("");
  const [typesModalOpen, setTypesModalOpen] = useState(false);

  const [collectPickerOpen, setCollectPickerOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectPending, setCollectPending] = useState(false);
  const [collectError, setCollectError] = useState("");
  const [collectApartments, setCollectApartments] = useState<Apartment[]>([]);
  const [collectDebts, setCollectDebts] = useState<ApartmentDebt[]>([]);
  const [collectPersons, setCollectPersons] = useState<PersonListItem[]>([]);
  const [collectRelated, setCollectRelated] = useState<
    Array<{ id: string; fullName: string; roleLabel: string }>
  >([]);
  const [collectApartmentId, setCollectApartmentId] = useState("");
  const [collectBuildingId, setCollectBuildingId] = useState("");

  const [debtSearch, setDebtSearch] = useState("");
  const debouncedDebtSearch = useDebouncedValue(debtSearch, 300);
  const [debtBuildingId, setDebtBuildingId] = useState("");
  const [debtFiltersOpen, setDebtFiltersOpen] = useState(false);
  const [debtStatus, setDebtStatus] = useState("OPEN");
  const [debtType, setDebtType] = useState("");
  const [debtMonth, setDebtMonth] = useState("");
  const [debtYear, setDebtYear] = useState("");
  const [debtPage, setDebtPage] = useState(1);
  const [debts, setDebts] = useState<ApartmentDebt[]>([]);
  const [debtTotal, setDebtTotal] = useState(0);
  const [debtSummaryLine, setDebtSummaryLine] = useState({ openDebtCount: 0, remaining: "0.00" });
  const [debtsLoading, setDebtsLoading] = useState(true);
  const [debtError, setDebtError] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualPending, setManualPending] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualApartments, setManualApartments] = useState<Apartment[]>([]);
  const [cancellingDebt, setCancellingDebt] = useState<ApartmentDebt | null>(null);
  const [cancelDebtPending, setCancelDebtPending] = useState(false);

  const [debtReminderOpen, setDebtReminderOpen] = useState(false);
  const [debtReminderHistoryOpen, setDebtReminderHistoryOpen] = useState(false);

  const loadBuildings = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBuildings(auth, { status: "aktif", perPage: 100 });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    }
  }, [auth]);

  const loadBankAccountCount = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBankAccounts(auth, { perPage: 1 });
      setBankAccountTotal(result.total);
    } catch {
      setBankAccountTotal(0);
    }
  }, [auth]);

  const loadDashboard = useCallback(async () => {
    if (!auth) return;
    try {
      const [debtResult, paymentSummary, expenseSummary] = await Promise.all([
        listApartmentDebts(auth, { status: "OPEN", perPage: 1 }),
        getMonthlyPaymentSummary(auth),
        getMonthlyExpenseSummary(auth),
      ]);
      setOpenRemaining(debtResult.summary.totalRemainingAmount);
      setIndebtedApartments(debtResult.summary.indebtedApartmentCount);
      setMonthlyIncome(paymentSummary.currentMonthTotal);
      setChartMonths(paymentSummary.months);
      setMonthlyExpense(expenseSummary.currentMonthTotal);
      setExpenseChartMonths(expenseSummary.months);
    } catch {
      setOpenRemaining("0.00");
      setIndebtedApartments(0);
      setMonthlyIncome("0.00");
      setChartMonths([]);
      setMonthlyExpense("0.00");
      setExpenseChartMonths([]);
    }
  }, [auth]);

  const loadExpenseTypesActive = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listExpenseTypes(auth, { activeOnly: true });
      setExpenseTypesActive(result.items);
    } catch {
      setExpenseTypesActive([]);
    }
  }, [auth]);

  const loadFilterSuppliers = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listSuppliers(auth, { status: "aktif", perPage: 100 });
      setFilterSuppliers(result.items);
    } catch {
      setFilterSuppliers([]);
    }
  }, [auth]);

  const loadPayments = useCallback(async () => {
    if (!auth) {
      setPaymentsLoading(false);
      return;
    }
    setPaymentsLoading(true);
    setPaymentError("");
    try {
      const result = await listPayments(auth, {
        search: debouncedPaymentSearch.trim() || undefined,
        page: paymentPage,
        perPage: PER_PAGE,
        status: "COMPLETED",
        paymentMethod:
          paymentMethod === "CASH" ||
          paymentMethod === "BANK_TRANSFER" ||
          paymentMethod === "CREDIT_CARD" ||
          paymentMethod === "OTHER"
            ? paymentMethod
            : undefined,
      });
      setPayments(result.items);
      setPaymentTotal(result.total);
    } catch (error) {
      setPayments([]);
      setPaymentTotal(0);
      setPaymentError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setPaymentsLoading(false);
    }
  }, [auth, debouncedPaymentSearch, paymentPage, paymentMethod]);

  const loadExpenses = useCallback(async () => {
    if (!auth) {
      setExpensesLoading(false);
      return;
    }
    setExpensesLoading(true);
    setExpenseError("");
    try {
      const result = await listExpenses(auth, {
        search: debouncedExpenseSearch.trim() || undefined,
        page: expensePage,
        perPage: PER_PAGE,
        status: "COMPLETED",
        expenseTypeId: expenseTypeId || undefined,
        buildingId: expenseBuildingId || undefined,
        supplierId: expenseSupplierId || undefined,
        paymentMethod:
          expenseMethod === "CASH" ||
          expenseMethod === "BANK_TRANSFER" ||
          expenseMethod === "CREDIT_CARD" ||
          expenseMethod === "OTHER"
            ? expenseMethod
            : undefined,
        dateFrom: expenseDateFrom || undefined,
        dateTo: expenseDateTo || undefined,
      });
      setExpenses(result.items);
      setExpenseTotal(result.total);
    } catch (error) {
      setExpenses([]);
      setExpenseTotal(0);
      setExpenseError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setExpensesLoading(false);
    }
  }, [
    auth,
    debouncedExpenseSearch,
    expensePage,
    expenseTypeId,
    expenseBuildingId,
    expenseSupplierId,
    expenseMethod,
    expenseDateFrom,
    expenseDateTo,
  ]);

  const loadDebts = useCallback(async () => {
    if (!auth) {
      setDebtsLoading(false);
      return;
    }
    setDebtsLoading(true);
    setDebtError("");
    try {
      const result = await listApartmentDebts(auth, {
        search: debouncedDebtSearch.trim() || undefined,
        page: debtPage,
        perPage: PER_PAGE,
        buildingId: debtBuildingId || undefined,
        status:
          debtStatus === "OPEN" || debtStatus === "PAID" || debtStatus === "CANCELLED"
            ? debtStatus
            : undefined,
        type: debtType === "DUES" || debtType === "MANUAL" ? debtType : undefined,
        periodMonth: debtMonth ? Number(debtMonth) : undefined,
        periodYear: debtYear ? Number(debtYear) : undefined,
      });
      setDebts(result.items);
      setDebtTotal(result.total);
      setDebtSummaryLine({
        openDebtCount: result.summary.openDebtCount,
        remaining: result.summary.totalRemainingAmount,
      });
    } catch (error) {
      setDebts([]);
      setDebtTotal(0);
      setDebtError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setDebtsLoading(false);
    }
  }, [auth, debouncedDebtSearch, debtPage, debtBuildingId, debtStatus, debtType, debtMonth, debtYear]);

  useEffect(() => {
    if (!ready) return;
    void loadBuildings();
    void loadDashboard();
    void loadExpenseTypesActive();
    void loadBankAccountCount();
  }, [ready, loadBuildings, loadDashboard, loadExpenseTypesActive, loadBankAccountCount]);

  useEffect(() => {
    if (!ready || !expenseFiltersOpen) return;
    if (filterSuppliers.length > 0) return;
    void loadFilterSuppliers();
  }, [ready, expenseFiltersOpen, filterSuppliers.length, loadFilterSuppliers]);

  useEffect(() => {
    if (!ready || tab !== "borclar") return;
    void loadDebts();
  }, [ready, tab, loadDebts]);

  useEffect(() => {
    if (!ready || tab !== "gelirler") return;
    void loadPayments();
  }, [ready, tab, loadPayments]);

  useEffect(() => {
    if (!ready || tab !== "giderler") return;
    void loadExpenses();
  }, [ready, tab, loadExpenses]);

  useEffect(() => {
    if (!ready || tab !== "ozet") return;
    void loadDashboard();
  }, [ready, tab, loadDashboard]);

  useEffect(() => {
    setDebtPage(1);
  }, [debouncedDebtSearch, debtBuildingId, debtStatus, debtType, debtMonth, debtYear]);

  useEffect(() => {
    setPaymentPage(1);
  }, [debouncedPaymentSearch, paymentMethod]);

  useEffect(() => {
    setExpensePage(1);
  }, [
    debouncedExpenseSearch,
    expenseTypeId,
    expenseBuildingId,
    expenseSupplierId,
    expenseMethod,
    expenseDateFrom,
    expenseDateTo,
  ]);

  async function loadApartmentsForBuilding(buildingId: string) {
    if (!auth || !buildingId) {
      setManualApartments([]);
      return;
    }
    try {
      const result = await listApartments(auth, { buildingId, status: "aktif", perPage: 100 });
      setManualApartments(result.items);
    } catch {
      setManualApartments([]);
    }
  }

  async function loadCollectApartments(buildingId: string) {
    if (!auth || !buildingId) {
      setCollectApartments([]);
      return;
    }
    try {
      const result = await listApartments(auth, { buildingId, status: "aktif", perPage: 100 });
      setCollectApartments(result.items);
    } catch {
      setCollectApartments([]);
    }
  }

  async function handleCollectContinue() {
    if (!auth || !collectApartmentId) return;
    setCollectError("");
    try {
      const [debtList, personList, relationList] = await Promise.all([
        listApartmentDebts(auth, {
          apartmentId: collectApartmentId,
          status: "OPEN",
          perPage: 100,
        }),
        listPersons(auth, { status: "aktif", perPage: 100 }),
        listRelations(auth, { apartmentId: collectApartmentId, active: true, perPage: 50 }),
      ]);
      const openDebts = debtList.items.filter((item) => Number(item.remainingAmount) > 0);
      if (openDebts.length === 0) {
        showToast("Seçilen dairede açık borç bulunmuyor.", "error");
        return;
      }
      setCollectDebts(openDebts);
      setCollectPersons(personList.items);
      setCollectRelated(
        relationList.items.map((item) => ({
          id: item.person.id,
          fullName: item.person.fullName,
          roleLabel: RELATION_TYPE_LABELS[item.relationType],
        })),
      );
      setCollectPickerOpen(false);
      setCollectOpen(true);
    } catch (error) {
      toastError(error, "Tahsilat formu açılamadı.");
    }
  }

  async function handleCollectSubmit(payload: PaymentPayload, submitSiteId: string) {
    if (!auth || collectPending) return;
    setCollectPending(true);
    setCollectError("");
    try {
      await createPayment({ ...auth, siteId: submitSiteId }, payload, crypto.randomUUID());
      showToast(
        `${Number(payload.amount).toLocaleString("tr-TR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} TL tahsilat kaydedildi.`,
      );
      setCollectOpen(false);
      setCollectApartmentId("");
      setCollectBuildingId("");
      setCollectApartments([]);
      await Promise.all([
        loadDashboard(),
        tab === "borclar" ? loadDebts() : Promise.resolve(),
        loadPayments(),
      ]);
    } catch (error) {
      setCollectError(error instanceof ApiError ? error.message : "Tahsilat kaydedilemedi.");
    } finally {
      setCollectPending(false);
    }
  }

  async function handleManualSubmit(values: DebtFormValues) {
    if (!auth || manualPending) return;
    if (!values.siteId) {
      setManualError("Site seçimi zorunludur.");
      return;
    }
    setManualPending(true);
    setManualError("");
    try {
      await createApartmentDebt({ ...auth, siteId: values.siteId }, debtFormToPayload(values));
      showToast("Borç oluşturuldu.");
      setManualOpen(false);
      await Promise.all([loadDebts(), loadDashboard()]);
    } catch (error) {
      setManualError(error instanceof ApiError ? error.message : "Borç kaydedilemedi.");
    } finally {
      setManualPending(false);
    }
  }

  async function handleCancelDebt() {
    if (!auth || !cancellingDebt || cancelDebtPending) return;
    setCancelDebtPending(true);
    try {
      await cancelApartmentDebt(auth, cancellingDebt.id);
      showToast("Borç iptal edildi.");
      setCancellingDebt(null);
      await Promise.all([loadDebts(), loadDashboard()]);
    } catch (error) {
      toastError(error, "Borç iptal edilemedi.");
    } finally {
      setCancelDebtPending(false);
    }
  }

  async function openExpenseForm() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setExpenseFormError("");
    setApplySupplier(null);
    if (expenseTypesActive.length === 0) {
      await loadExpenseTypesActive();
    }
    setExpenseFormInitial(emptyExpenseForm({ siteId: siteId ?? "" }));
    setExpenseFormOpen(true);
  }

  async function handleExpenseSubmit(values: ExpenseFormValues) {
    if (!auth || expenseFormPending) return;
    if (!values.siteId) {
      setExpenseFormError("Site seçimi zorunludur.");
      return;
    }
    setExpenseFormPending(true);
    setExpenseFormError("");
    try {
      await createExpense({ ...auth, siteId: values.siteId }, expenseFormToPayload(values));
      showToast("Gider kaydedildi.");
      setExpenseFormOpen(false);
      await Promise.all([loadDashboard(), loadExpenses()]);
    } catch (error) {
      setExpenseFormError(error instanceof ApiError ? error.message : "Gider kaydedilemedi.");
    } finally {
      setExpenseFormPending(false);
    }
  }

  async function handleQuickSupplierSubmit(values: SupplierFormValues) {
    if (!auth || supplierQuickPending) return;
    setSupplierQuickPending(true);
    setSupplierQuickError("");
    try {
      const result = await createSupplier(auth, supplierFormToPayload(values));
      showToast("Tedarikçi oluşturuldu.");
      setSupplierQuickOpen(false);
      setApplySupplier({ id: result.supplier.id, name: result.supplier.name, token: Date.now() });
      void loadFilterSuppliers();
    } catch (error) {
      setSupplierQuickError(error instanceof ApiError ? error.message : "Tedarikçi kaydedilemedi.");
    } finally {
      setSupplierQuickPending(false);
    }
  }

  async function handleBankAccountSubmit(values: BankAccountFormValues) {
    if (!auth || bankFormPending) return;
    if (!values.siteId) {
      setBankFormError("Site seçimi zorunludur.");
      return;
    }
    setBankFormPending(true);
    setBankFormError("");
    try {
      const result = await createBankAccount(
        { ...auth, siteId: values.siteId },
        bankAccountFormToPayload(values),
      );
      showToast("Banka hesabı eklendi.");
      setBankFormOpen(false);
      await loadBankAccountCount();
      router.push(`/app/muhasebe/bankalar/${result.bankAccount.id}`);
    } catch (error) {
      setBankFormError(error instanceof ApiError ? error.message : "Hesap kaydedilemedi.");
    } finally {
      setBankFormPending(false);
    }
  }

  function openCreateWithSite(open: () => void) {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    open();
  }

  const debtFilterCount = [debtStatus !== "OPEN" ? debtStatus : "", debtType, debtMonth, debtYear].filter(
    Boolean,
  ).length;

  const expenseFilterCount = [
    expenseBuildingId,
    expenseSupplierId,
    expenseMethod,
    expenseDateFrom,
    expenseDateTo,
  ].filter(Boolean).length;

  const reportYear = new Date().getFullYear();
  const reportMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const income = Number(chartMonths.find((item) => item.month === month)?.total ?? 0);
      const expense = Number(expenseChartMonths.find((item) => item.month === month)?.total ?? 0);
      return { month, income, expense, net: income - expense };
    });
  }, [chartMonths, expenseChartMonths]);

  const reportIncomeTotal = reportMonths.reduce((sum, item) => sum + item.income, 0);
  const reportExpenseTotal = reportMonths.reduce((sum, item) => sum + item.expense, 0);
  const reportNet = reportIncomeTotal - reportExpenseTotal;

  const collectApartment = collectApartments.find((item) => item.id === collectApartmentId);
  const collectOpenDebtTotal = collectDebts
    .reduce((sum, item) => sum + Number(item.remainingAmount), 0)
    .toFixed(2);

  return (
    <PageContainer>
      <h1 className="mb-1 text-page text-ink">
        {tab === "giderler" ? "Giderler" : tab === "gelirler" ? "Tahsilatlar" : "Muhasebe"}
      </h1>
      {site?.name ? (
        <p className="mb-4 text-sm text-muted">{site.name} için gelir, gider ve borçları yönetin.</p>
      ) : (
        <div className="mb-4" />
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingSummaryCard
          label="Aylık Gelir"
          value={formatMoney(monthlyIncome)}
          valueClassName="text-success"
          icon={TrendingUp}
          tone="green"
        />
        <AccountingSummaryCard
          label="Aylık Gider"
          value={formatMoney(monthlyExpense)}
          valueClassName="text-danger"
          icon={TrendingDown}
          tone="rose"
        />
        <AccountingSummaryCard
          label="Daire Borçları"
          value={formatMoney(openRemaining)}
          valueClassName="text-warning"
          icon={Wallet}
          tone="amber"
        />
        <AccountingSummaryCard
          label="Borçlu Daire Sayısı"
          value={String(indebtedApartments)}
          valueClassName="text-brand"
          icon={Building2}
          tone="blue"
        />
      </div>

      <div className="mb-3">
        <DebtReminderBar
          indebtedApartmentCount={indebtedApartments}
          onSendClick={() => setDebtReminderOpen(true)}
          onHistoryClick={() => setDebtReminderHistoryOpen(true)}
        />
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AccountingChartPanel
          title="Gelir Grafiği"
          subtitle="Aylık gelir dağılımı"
          tone="income"
          icon={TrendingUp}
          action={
            <Button
              size="sm"
              variant="secondary"
              className="border-emerald-200 bg-white text-success hover:bg-emerald-50"
              onClick={() => selectTab("gelirler")}
            >
              <Plus className="size-3.5" aria-hidden />
              Tahsilatlar
            </Button>
          }
        >
          <div className="h-full w-full">
            <MonthlyBarChart months={chartMonths} />
          </div>
        </AccountingChartPanel>
        <AccountingChartPanel
          title="Gider Grafiği"
          subtitle="Aylık gider dağılımı"
          tone="expense"
          icon={TrendingDown}
          action={
            <Button
              size="sm"
              variant="secondary"
              className="border-rose-200 bg-white text-danger hover:bg-rose-50"
              onClick={() => selectTab("giderler")}
            >
              <Plus className="size-3.5" aria-hidden />
              Giderler
            </Button>
          }
        >
          <div className="h-full w-full">
            <MonthlyBarChart months={expenseChartMonths} tone="expense" />
          </div>
        </AccountingChartPanel>
      </div>

      <section className="rounded-lg border border-line bg-surface shadow-panel">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors duration-micro",
                  tab === item.id
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {bankAccountTotal === 0 ? (
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 bg-ink text-white hover:bg-slate-800"
              onClick={() => {
                openCreateWithSite(() => {
                  setBankFormError("");
                  setBankFormOpen(true);
                });
              }}
            >
              <Plus className="size-3.5" aria-hidden />
              Banka Ekle
            </Button>
          ) : (
            <Link
              href="/app/muhasebe/bankalar"
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-ink px-3 text-[13px] font-medium text-white hover:bg-slate-800"
            >
              Bankalar ({bankAccountTotal})
            </Link>
          )}
        </div>

        <div className="p-4">
          {tab === "borclar" ? (
            <>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm text-muted">
                  {debtSummaryLine.openDebtCount} açık borç · {formatMoney(debtSummaryLine.remaining)}{" "}
                  kalan
                </p>
                <div className="filter-row">
                  <SearchInput
                    className="h-9"
                    placeholder="Borç ara..."
                    value={debtSearch}
                    onChange={(event) => setDebtSearch(event.target.value)}
                  />
                  <Select
                    className="h-9 text-sm"
                    value={debtType}
                    onChange={(event) => setDebtType(event.target.value)}
                  >
                    <option value="">Borç Tipi</option>
                    <option value="DUES">Aidat</option>
                    <option value="MANUAL">Manuel</option>
                  </Select>
                  <Select
                    className="h-9 text-sm"
                    value={debtBuildingId}
                    onChange={(event) => setDebtBuildingId(event.target.value)}
                  >
                    <option value="">Tüm binalar</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDebtFiltersOpen((value) => !value)}
                  >
                    <ListFilter className="size-3.5" aria-hidden />
                    Filtre
                    {debtFilterCount > 0 ? <span className="text-brand">({debtFilterCount})</span> : null}
                  </Button>
                  <Link
                    href="/app/muhasebe/aidatlar"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-canvas"
                  >
                    Aidatlar
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => {
                      openCreateWithSite(() => {
                        setManualError("");
                        setManualOpen(true);
                      });
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Manuel Borç
                  </Button>
                </div>
              </div>

              {debtFiltersOpen ? (
                <div className="mb-3 grid grid-cols-1 gap-2 rounded-md border border-line bg-canvas/60 p-3 sm:grid-cols-3">
                  <Select
                    className="h-9 text-sm"
                    value={debtStatus}
                    onChange={(event) => setDebtStatus(event.target.value)}
                  >
                    <option value="">Tüm durumlar</option>
                    <option value="OPEN">Açık</option>
                    <option value="PAID">Ödendi</option>
                    <option value="CANCELLED">İptal</option>
                  </Select>
                  <Select
                    className="h-9 text-sm"
                    value={debtMonth}
                    onChange={(event) => setDebtMonth(event.target.value)}
                  >
                    <option value="">Tüm aylar</option>
                    {MONTH_LABELS.map((label, index) => (
                      <option key={label} value={String(index + 1)}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    className="h-9 text-sm"
                    value={debtYear}
                    onChange={(event) => setDebtYear(event.target.value)}
                  >
                    <option value="">Tüm yıllar</option>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(
                      (year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ),
                    )}
                  </Select>
                </div>
              ) : null}

              {debtError ? <p className="mb-3 text-sm text-danger">{debtError}</p> : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Bina</TH>
                        <TH>Daire</TH>
                        <TH>Kiracı</TH>
                        <TH>Mülk Sahibi</TH>
                        <TH>Borç Tipi</TH>
                        <TH>Borç</TH>
                        <TH className="text-right">Ödenen</TH>
                        <TH className="text-right">Kalan</TH>
                        <TH className="text-right">İşlemler</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {debtsLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                            <TR key={`s-${index}`} className="hover:bg-transparent">
                              <TD colSpan={9}>
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                              </TD>
                            </TR>
                          ))
                        : null}
                      {!debtsLoading && debts.length === 0 ? (
                        <TR className="hover:bg-transparent">
                          <TD colSpan={9} className="whitespace-normal p-0">
                            <EmptyState
                              icon={Wallet}
                              title="Henüz borç kaydı yok"
                              description="Seçili site için açık veya geçmiş borç kaydı bulunmuyor. Manuel borç ekleyebilir veya aidat borçlandırması yapabilirsiniz."
                              action={
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    openCreateWithSite(() => {
                                      setManualError("");
                                      setManualOpen(true);
                                    });
                                  }}
                                >
                                  <Plus className="size-3.5" aria-hidden />
                                  Manuel Borç
                                </Button>
                              }
                              className="border-0 bg-transparent"
                            />
                          </TD>
                        </TR>
                      ) : null}
                      {!debtsLoading
                        ? debts.map((debt) => (
                            <TR key={debt.id}>
                              <TD>{debt.building.name}</TD>
                              <TD className="font-medium">
                                <Link
                                  href={`/app/daireler/${debt.apartment.id}`}
                                  className="hover:text-brand"
                                >
                                  {debt.apartment.number}
                                </Link>
                              </TD>
                              <TD>{debt.primaryTenantName || "—"}</TD>
                              <TD>{debt.primaryOwnerName || "—"}</TD>
                              <TD>{DEBT_TYPE_LABELS[debt.type]}</TD>
                              <TD>
                                <Link
                                  href={`/app/muhasebe/borclar/${debt.id}`}
                                  className="hover:text-brand"
                                >
                                  {debt.title}
                                </Link>
                                {debt.dueState === "overdue" ? (
                                  <span className="ml-2 text-[11px] font-medium text-danger">
                                    Gecikmiş
                                  </span>
                                ) : null}
                              </TD>
                              <TD className="text-right">{formatMoney(paidAmount(debt))}</TD>
                              <TD className="text-right font-medium">
                                {formatMoney(debt.remainingAmount)}
                              </TD>
                              <TD className="text-right">
                                <Dropdown
                                  align="right"
                                  trigger={
                                    <button
                                      type="button"
                                      className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                                      aria-label="Borç işlemleri"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  }
                                >
                                  <DropdownItem href={`/app/muhasebe/borclar/${debt.id}`}>
                                    Detay
                                  </DropdownItem>
                                  {debt.status === "OPEN" ? (
                                    <DropdownItem danger onClick={() => setCancellingDebt(debt)}>
                                      Borcu İptal Et
                                    </DropdownItem>
                                  ) : null}
                                </Dropdown>
                              </TD>
                            </TR>
                          ))
                        : null}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
              <Pagination
                page={debtPage}
                perPage={PER_PAGE}
                total={debtTotal}
                onPageChange={setDebtPage}
              />
            </>
          ) : null}

          {tab === "gelirler" ? (
            <>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
                <div className="filter-row">
                  <SearchInput
                    className="h-9"
                    placeholder="Tahsilat ara..."
                    value={paymentSearch}
                    onChange={(event) => setPaymentSearch(event.target.value)}
                  />
                  <Select
                    className="h-9 text-sm"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    <option value="">Tüm yöntemler</option>
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      openCreateWithSite(() => {
                        setCollectError("");
                        setCollectOpen(true);
                      });
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tahsilat Ekle
                  </Button>
                </div>
              </div>

              {paymentError ? <p className="mb-3 text-sm text-danger">{paymentError}</p> : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Gelir</TH>
                        <TH>Ödeyen Kişi</TH>
                        <TH>Ödeme Yöntemi</TH>
                        <TH>Tarih</TH>
                        <TH>Bina</TH>
                        <TH>Daire</TH>
                        <TH className="text-right">Tutar</TH>
                        <TH className="text-right">İşlem</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {paymentsLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                            <TR key={`ps-${index}`} className="hover:bg-transparent">
                              <TD colSpan={8}>
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                              </TD>
                            </TR>
                          ))
                        : null}
                      {!paymentsLoading && payments.length === 0 ? (
                        <TR className="hover:bg-transparent">
                          <TD colSpan={8} className="whitespace-normal p-0">
                            <EmptyState
                              icon={Banknote}
                              title="Henüz tahsilat kaydı yok"
                              description="Seçili site için tahsilat kaydı bulunmuyor. Daire veya kişiye bağlı yeni bir ödeme kaydedebilirsiniz."
                              action={
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    openCreateWithSite(() => {
                                      setCollectError("");
                                      setCollectOpen(true);
                                    });
                                  }}
                                >
                                  <Plus className="size-3.5" aria-hidden />
                                  Tahsilat Ekle
                                </Button>
                              }
                              className="border-0 bg-transparent"
                            />
                          </TD>
                        </TR>
                      ) : null}
                      {!paymentsLoading
                        ? payments.map((payment) => (
                            <TR key={payment.id}>
                              <TD className="font-medium">
                                <Link
                                  href={`/app/muhasebe/tahsilatlar/${payment.id}`}
                                  className="hover:text-brand"
                                >
                                  {payment.title}
                                </Link>
                              </TD>
                              <TD>{payment.person?.fullName || "—"}</TD>
                              <TD>{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</TD>
                              <TD>{formatDateTr(payment.paymentDate)}</TD>
                              <TD>{payment.building.name}</TD>
                              <TD>
                                <Link
                                  href={`/app/daireler/${payment.apartment.id}`}
                                  className="hover:text-brand"
                                >
                                  {payment.apartment.number}
                                </Link>
                              </TD>
                              <TD className="text-right font-medium">
                                {formatMoney(payment.amount)}
                              </TD>
                              <TD className="text-right">
                                <Link
                                  href={`/app/muhasebe/tahsilatlar/${payment.id}`}
                                  className="inline-flex text-sm text-brand hover:underline"
                                >
                                  Detay
                                </Link>
                              </TD>
                            </TR>
                          ))
                        : null}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
              <Pagination
                page={paymentPage}
                perPage={PER_PAGE}
                total={paymentTotal}
                onPageChange={setPaymentPage}
              />
            </>
          ) : null}

          {tab === "giderler" ? (
            <>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
                <div className="filter-row">
                  <SearchInput
                    className="h-9"
                    placeholder="Gider ara..."
                    value={expenseSearch}
                    onChange={(event) => setExpenseSearch(event.target.value)}
                  />
                  <Select
                    className="h-9 text-sm"
                    value={expenseTypeId}
                    onChange={(event) => setExpenseTypeId(event.target.value)}
                  >
                    <option value="">Gider tipi</option>
                    {expenseTypesActive.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setExpenseFiltersOpen((value) => !value)}
                  >
                    <ListFilter className="size-3.5" aria-hidden />
                    Filtre
                    {expenseFilterCount > 0 ? (
                      <span className="text-brand">({expenseFilterCount})</span>
                    ) : null}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setTypesModalOpen(true)}>
                    Gider Türleri
                  </Button>
                  <Button size="sm" onClick={() => void openExpenseForm()}>
                    <Plus className="size-3.5" aria-hidden />
                    Gider Ekle
                  </Button>
                </div>
              </div>

              {expenseFiltersOpen ? (
                <div className="mb-3 space-y-2 rounded-md border border-line bg-canvas/60 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <Select
                      className="h-9 text-sm"
                      value={expenseBuildingId}
                      onChange={(event) => setExpenseBuildingId(event.target.value)}
                    >
                      <option value="">Tüm binalar</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="h-9 text-sm"
                      value={expenseSupplierId}
                      onChange={(event) => setExpenseSupplierId(event.target.value)}
                    >
                      <option value="">Tüm tedarikçiler</option>
                      {filterSuppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="h-9 text-sm"
                      value={expenseMethod}
                      onChange={(event) => setExpenseMethod(event.target.value)}
                    >
                      <option value="">Tüm yöntemler</option>
                      {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                        <option key={method} value={method}>
                          {PAYMENT_METHOD_LABELS[method]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={expenseDateFrom}
                      onChange={(event) => setExpenseDateFrom(event.target.value)}
                    />
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={expenseDateTo}
                      onChange={(event) => setExpenseDateTo(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const range = expenseDatePreset("thisMonth");
                        setExpenseDateFrom(range.from);
                        setExpenseDateTo(range.to);
                      }}
                    >
                      Bu Ay
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const range = expenseDatePreset("lastMonth");
                        setExpenseDateFrom(range.from);
                        setExpenseDateTo(range.to);
                      }}
                    >
                      Geçen Ay
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const range = expenseDatePreset("thisYear");
                        setExpenseDateFrom(range.from);
                        setExpenseDateTo(range.to);
                      }}
                    >
                      Bu Yıl
                    </Button>
                  </div>
                </div>
              ) : null}

              {expenseError ? <p className="mb-3 text-sm text-danger">{expenseError}</p> : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Gider</TH>
                        <TH>Gider Tipi</TH>
                        <TH>Tedarikçi</TH>
                        <TH>Bina</TH>
                        <TH>Tarih</TH>
                        <TH className="text-right">Tutar</TH>
                        <TH className="text-right">İşlem</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {expensesLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                            <TR key={`es-${index}`} className="hover:bg-transparent">
                              <TD colSpan={7}>
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                              </TD>
                            </TR>
                          ))
                        : null}
                      {!expensesLoading && expenses.length === 0 ? (
                        <TR className="hover:bg-transparent">
                          <TD colSpan={7} className="whitespace-normal p-0">
                            <EmptyState
                              icon={Receipt}
                              title="Henüz gider kaydı yok"
                              description="Seçili site için gider kaydı bulunmuyor. Tür, tutar ve tarih bilgisiyle yeni bir gider ekleyebilirsiniz."
                              action={
                                <Button size="sm" onClick={() => void openExpenseForm()}>
                                  <Plus className="size-3.5" aria-hidden />
                                  Gider Ekle
                                </Button>
                              }
                              className="border-0 bg-transparent"
                            />
                          </TD>
                        </TR>
                      ) : null}
                      {!expensesLoading
                        ? expenses.map((expense) => (
                            <TR key={expense.id}>
                              <TD className="font-medium">
                                <Link
                                  href={`/app/muhasebe/giderler/${expense.id}`}
                                  className="hover:text-brand"
                                >
                                  {expense.title}
                                </Link>
                              </TD>
                              <TD>{expense.expenseType.name}</TD>
                              <TD>
                                {expense.supplier ? (
                                  <Link
                                    href={`/app/tedarikciler/${expense.supplier.id}`}
                                    className="hover:text-brand"
                                  >
                                    {expense.supplier.name}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </TD>
                              <TD>{expense.building?.name || "Genel Gider"}</TD>
                              <TD>{formatDateTr(expense.expenseDate)}</TD>
                              <TD className="text-right font-medium">
                                {formatMoney(expense.amount)}
                              </TD>
                              <TD className="text-right">
                                <Link
                                  href={`/app/muhasebe/giderler/${expense.id}`}
                                  className="inline-flex text-sm text-brand hover:underline"
                                >
                                  Detay
                                </Link>
                              </TD>
                            </TR>
                          ))
                        : null}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
              <Pagination
                page={expensePage}
                perPage={PER_PAGE}
                total={expenseTotal}
                onPageChange={setExpensePage}
              />
            </>
          ) : null}

          {tab === "gecmis" ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">Geçmiş Borçlar</h2>
              <p className="py-8 text-center text-sm text-muted">
                Geçmiş borç verisi henüz bulunmuyor.
              </p>
            </div>
          ) : null}

          {tab === "ozet" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-ink">Özet Rapor</h2>
                <p className="text-sm text-muted">{reportYear}</p>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <p>
                  <span className="text-muted">Toplam Gelir: </span>
                  <span className="font-medium text-success">
                    {formatMoney(reportIncomeTotal.toFixed(2))}
                  </span>
                </p>
                <p>
                  <span className="text-muted">Toplam Gider: </span>
                  <span className="font-medium text-danger">
                    {formatMoney(reportExpenseTotal.toFixed(2))}
                  </span>
                </p>
                <p>
                  <span className="text-muted">Net Kalan: </span>
                  <span className="font-medium text-ink">
                    {formatMoney(reportNet.toFixed(2))}
                  </span>
                </p>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Ay</TH>
                        <TH className="text-right">Gelir</TH>
                        <TH className="text-right">Gider</TH>
                        <TH className="text-right">Net Kalan</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {reportMonths.map((row) => (
                        <TR key={row.month}>
                          <TD>
                            {MONTH_LABELS[row.month - 1]} {reportYear}
                          </TD>
                          <TD className="text-right">{formatMoney(row.income.toFixed(2))}</TD>
                          <TD className="text-right">{formatMoney(row.expense.toFixed(2))}</TD>
                          <TD className="text-right font-medium">
                            {formatMoney(row.net.toFixed(2))}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </TableElement>
                </Table>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Bilanço Özeti</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <p>
                    <span className="text-muted">Toplam Gelir: </span>
                    <span className="font-medium">{formatMoney(reportIncomeTotal.toFixed(2))}</span>
                  </p>
                  <p>
                    <span className="text-muted">Toplam Gider: </span>
                    <span className="font-medium">{formatMoney(reportExpenseTotal.toFixed(2))}</span>
                  </p>
                  <p>
                    <span className="text-muted">Net Kalan: </span>
                    <span className="font-medium">{formatMoney(reportNet.toFixed(2))}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <DebtFormModal
        open={manualOpen}
        title="Manuel Borç Ekle"
        initialValues={emptyDebtForm({ siteId: siteId ?? "" })}
        pending={manualPending}
        error={manualError}
        onClose={() => (manualPending ? undefined : setManualOpen(false))}
        onSubmit={handleManualSubmit}
      />

      <PaymentFormModal
        open={collectOpen}
        mode="multi"
        pending={collectPending}
        error={collectError}
        onClose={() => (collectPending ? undefined : setCollectOpen(false))}
        onSubmit={handleCollectSubmit}
      />

      <ConfirmDialog
        open={Boolean(cancellingDebt)}
        title="Borç iptal edilsin mi?"
        description="Bu borç aktif borç toplamlarından çıkarılacaktır. Finansal geçmiş kaydı korunacaktır."
        confirmLabel="Borcu İptal Et"
        cancelLabel="Vazgeç"
        danger
        pending={cancelDebtPending}
        onConfirm={() => void handleCancelDebt()}
        onClose={() => (cancelDebtPending ? undefined : setCancellingDebt(null))}
      />

      <ExpenseFormModal
        open={expenseFormOpen}
        title="Gider Ekle"
        expenseTypes={expenseTypesActive}
        initialValues={expenseFormInitial}
        pending={expenseFormPending}
        error={expenseFormError}
        auth={auth}
        applySupplier={applySupplier}
        onQuickCreateSupplier={() => {
          setSupplierQuickError("");
          setSupplierQuickOpen(true);
        }}
        onClose={() => (expenseFormPending ? undefined : setExpenseFormOpen(false))}
        onSubmit={handleExpenseSubmit}
      />

      <SupplierFormModal
        open={supplierQuickOpen}
        title="Yeni Tedarikçi"
        initialValues={emptySupplierForm()}
        pending={supplierQuickPending}
        error={supplierQuickError}
        onClose={() => (supplierQuickPending ? undefined : setSupplierQuickOpen(false))}
        onSubmit={handleQuickSupplierSubmit}
      />

      <ExpenseTypesModal
        open={typesModalOpen}
        auth={auth}
        onClose={() => setTypesModalOpen(false)}
        onChanged={() => void loadExpenseTypesActive()}
      />

      <BankAccountFormModal
        open={bankFormOpen}
        initialValues={emptyBankAccountForm({ siteId: siteId ?? "" })}
        pending={bankFormPending}
        error={bankFormError}
        onClose={() => (bankFormPending ? undefined : setBankFormOpen(false))}
        onSubmit={handleBankAccountSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <DebtReminderSendModal
        open={debtReminderOpen}
        onClose={() => setDebtReminderOpen(false)}
      />

      <DebtReminderHistoryModal
        open={debtReminderHistoryOpen}
        onClose={() => setDebtReminderHistoryOpen(false)}
      />
    </PageContainer>
  );
}
