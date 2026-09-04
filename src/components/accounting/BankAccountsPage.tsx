"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, Plus, Upload } from "lucide-react";
import {
  BankAccountFormModal,
  bankAccountFormToPayload,
  emptyBankAccountForm,
  type BankAccountFormValues,
} from "@/components/accounting/BankAccountFormModal";
import { BankBulkProcessModal } from "@/components/accounting/BankBulkProcessModal";
import { BankDebitClassifyModal } from "@/components/accounting/BankDebitClassifyModal";
import {
  BankMatchingRuleFormModal,
  bankMatchingRuleFormToPayload,
  bankMatchingRuleToForm,
  emptyBankMatchingRuleForm,
  type BankMatchingRuleFormValues,
} from "@/components/accounting/BankMatchingRuleFormModal";
import { BankMatchModal, type RelatedPerson } from "@/components/accounting/BankMatchModal";
import { BankStatementImportWizard } from "@/components/accounting/BankStatementImportWizard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  classifyBankDebit,
  confirmBankTransactionMatch,
  createBankAccount,
  createBankMatchingRule,
  deleteBankMatchingRule,
  getBankHubSummary,
  ignoreBankTransaction,
  listBankAccounts,
  listBankMatchingRules,
  listBankTransactions,
  matchBankTransaction,
  processBankTransaction,
  processBankTransactionAuto,
  unmatchBankTransaction,
  updateBankMatchingRule,
  type BankAccount,
  type BankDebitClass,
  type BankDirection,
  type BankHubSummary,
  type BankMatchPayload,
  type BankMatchStatus,
  type BankMatchingRule,
  type BankProcessPayload,
  type BankTransaction,
} from "@/lib/banks-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";
import { listApartmentDebts, type ApartmentDebt } from "@/lib/debts-api";
import { ApiError } from "@/lib/http";
import {
  BANK_DEBIT_CLASS_LABELS,
  BANK_DIRECTION_LABELS,
  BANK_MATCH_STATUS_LABELS,
  formatDateTr,
  formatMoney,
} from "@/lib/money";
import { RELATION_TYPE_LABELS } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import { listRelations } from "@/lib/relations-api";

type HubTab = "hareketler" | "ekstre" | "kurallar" | "hesaplar";

function confidenceLabel(status: BankMatchStatus): string {
  if (status === "SUGGESTED") return "Öneri";
  if (status === "MATCHED") return "Onaylı";
  if (status === "PROCESSED") return "—";
  return "—";
}

function primaryRowAction(tx: BankTransaction): "match" | "review" | "process" | "payment" | "classify" | "expense" | null {
  if (tx.status === "IGNORED") return null;
  if (tx.direction === "DEBIT") {
    if (tx.expense) return "expense";
    if (tx.debitClass === "EXCLUDED") return null;
    return "classify";
  }
  if (tx.matchStatus === "PROCESSED" && tx.payment) return "payment";
  if (tx.matchStatus === "UNMATCHED") return "match";
  if (tx.matchStatus === "SUGGESTED" && !tx.payment) return "review";
  if (tx.matchStatus === "MATCHED" && !tx.payment) return "process";
  return null;
}

function statusLabel(tx: BankTransaction): string {
  if (tx.direction === "DEBIT") {
    if (tx.status === "IGNORED" || tx.debitClass === "EXCLUDED") {
      return `${BANK_DEBIT_CLASS_LABELS.EXCLUDED} · Giden`;
    }
    if (tx.debitClass === "EXPENSE" || tx.expense) {
      return `${BANK_DEBIT_CLASS_LABELS.EXPENSE} · Giden`;
    }
    return `${BANK_DEBIT_CLASS_LABELS.UNCLASSIFIED} · Giden`;
  }
  if (tx.status === "IGNORED") return "Hariç Tutuldu";
  return BANK_MATCH_STATUS_LABELS[tx.matchStatus];
}

export function BankAccountsPage() {
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, hasSites } = useActiveSite();

  const [tab, setTab] = useState<HubTab>("hareketler");
  const [summary, setSummary] = useState<BankHubSummary | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [rules, setRules] = useState<BankMatchingRule[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [persons, setPersons] = useState<PersonListItem[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [direction, setDirection] = useState("");
  const [matchStatus, setMatchStatus] = useState("");
  const [debitClass, setDebitClass] = useState("");
  const [classifyingTx, setClassifyingTx] = useState<BankTransaction | null>(null);

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountFormPending, setAccountFormPending] = useState(false);
  const [accountFormError, setAccountFormError] = useState("");

  const [importOpen, setImportOpen] = useState(false);

  const [matchOpen, setMatchOpen] = useState(false);
  const [matchingTx, setMatchingTx] = useState<BankTransaction | null>(null);
  const [matchPending, setMatchPending] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [matchApartments, setMatchApartments] = useState<Apartment[]>([]);
  const [matchDebts, setMatchDebts] = useState<ApartmentDebt[]>([]);
  const [matchRelated, setMatchRelated] = useState<RelatedPerson[]>([]);

  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BankMatchingRule | null>(null);
  const [ruleFormPending, setRuleFormPending] = useState(false);
  const [ruleFormError, setRuleFormError] = useState("");
  const [ruleApartments, setRuleApartments] = useState<Apartment[]>([]);
  const [ruleInitial, setRuleInitial] = useState(emptyBankMatchingRuleForm());
  const [deletingRule, setDeletingRule] = useState<BankMatchingRule | null>(null);
  const [deleteRulePending, setDeleteRulePending] = useState(false);
  const [ignoringTx, setIgnoringTx] = useState<BankTransaction | null>(null);
  const [ignorePending, setIgnorePending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rowActionPending, setRowActionPending] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState(false);

  const pendingSelectable = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          tx.direction === "CREDIT" &&
          tx.status === "ACTIVE" &&
          !tx.payment &&
          (tx.matchStatus === "SUGGESTED" || tx.matchStatus === "MATCHED"),
      ),
    [transactions],
  );

  const selectedPendingIds = useMemo(
    () => selectedIds.filter((id) => pendingSelectable.some((tx) => tx.id === id)),
    [selectedIds, pendingSelectable],
  );

  function filterPendingMatches() {
    setTab("hareketler");
    setDirection("CREDIT");
    setMatchStatus("");
    setPendingFocus(true);
    setSelectedIds([]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllPending() {
    if (selectedPendingIds.length === pendingSelectable.length) {
      setSelectedIds((prev) => prev.filter((id) => !pendingSelectable.some((tx) => tx.id === id)));
    } else {
      setSelectedIds((prev) => [
        ...new Set([...prev, ...pendingSelectable.map((tx) => tx.id)]),
      ]);
    }
  }

  const loadSummaryAndAccounts = useCallback(async () => {
    if (!auth) return;
    const [hub, accountList] = await Promise.all([
      getBankHubSummary(auth),
      listBankAccounts(auth, { perPage: 100 }),
    ]);
    setSummary(hub.summary);
    setAccounts(accountList.items);
  }, [auth]);

  const loadTransactions = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listBankTransactions(auth, {
        search: debouncedSearch.trim() || undefined,
        direction:
          direction === "CREDIT" || direction === "DEBIT" ? (direction as BankDirection) : undefined,
        matchStatus:
          !pendingFocus &&
          direction !== "DEBIT" &&
          (matchStatus === "UNMATCHED" ||
            matchStatus === "SUGGESTED" ||
            matchStatus === "MATCHED" ||
            matchStatus === "PROCESSED")
            ? (matchStatus as BankMatchStatus)
            : undefined,
        debitClass:
          !pendingFocus &&
          (debitClass === "UNCLASSIFIED" ||
            debitClass === "EXPENSE" ||
            debitClass === "EXCLUDED")
            ? (debitClass as BankDebitClass)
            : undefined,
        status: "ACTIVE",
        perPage: 100,
      });
      const items = pendingFocus
        ? result.items.filter(
            (tx) =>
              tx.direction === "CREDIT" &&
              !tx.payment &&
              (tx.matchStatus === "SUGGESTED" || tx.matchStatus === "MATCHED"),
          )
        : result.items;
      setTransactions(items);
    } catch (error) {
      setTransactions([]);
      setListError(error instanceof ApiError ? error.message : "Hareketler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, direction, matchStatus, debitClass, pendingFocus]);

  const loadRules = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBankMatchingRules(auth);
      setRules(result.items);
    } catch {
      setRules([]);
    }
  }, [auth]);

  const refreshAll = useCallback(async () => {
    if (!auth) return;
    await loadSummaryAndAccounts();
    if (tab === "hareketler" || tab === "ekstre") await loadTransactions();
    if (tab === "kurallar") await loadRules();
  }, [auth, tab, loadSummaryAndAccounts, loadTransactions, loadRules]);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadSummaryAndAccounts();
    void listBuildings(auth, { status: "aktif", perPage: 100 })
      .then((r) => setBuildings(r.items))
      .catch(() => setBuildings([]));
    void listPersons(auth, { status: "aktif", perPage: 100 })
      .then((r) => setPersons(r.items))
      .catch(() => setPersons([]));
    void listApartments(auth, { status: "aktif", perPage: 200 })
      .then((r) => setApartments(r.items))
      .catch(() => setApartments([]));
  }, [ready, auth, loadSummaryAndAccounts]);

  useEffect(() => {
    if (!ready || !auth) return;
    if (tab === "hareketler" || tab === "ekstre") void loadTransactions();
    if (tab === "kurallar") void loadRules();
  }, [ready, auth, tab, loadTransactions, loadRules]);

  async function handleCreateAccount(values: BankAccountFormValues) {
    if (!auth || accountFormPending) return;
    if (!values.siteId) {
      setAccountFormError("Site seçimi zorunludur.");
      return;
    }
    setAccountFormPending(true);
    setAccountFormError("");
    try {
      await createBankAccount({ ...auth, siteId: values.siteId }, bankAccountFormToPayload(values));
      showToast("Banka hesabı eklendi.");
      setAccountFormOpen(false);
      await loadSummaryAndAccounts();
    } catch (error) {
      setAccountFormError(error instanceof ApiError ? error.message : "Hesap kaydedilemedi.");
    } finally {
      setAccountFormPending(false);
    }
  }

  async function openMatch(tx: BankTransaction) {
    if (!auth) return;
    setMatchingTx(tx);
    setMatchError("");
    setMatchOpen(true);
    setMatchApartments([]);
    setMatchDebts([]);
    setMatchRelated([]);
    try {
      const aptList = await listApartments(auth, { status: "aktif", perPage: 200 });
      setMatchApartments(aptList.items);
    } catch {
      setMatchApartments([]);
    }
  }

  async function onBuildingChange(buildingId: string) {
    if (!auth || !buildingId) {
      setMatchApartments([]);
      return;
    }
    const result = await listApartments(auth, { buildingId, status: "aktif", perPage: 200 });
    setMatchApartments(result.items);
  }

  async function onApartmentChange(apartmentId: string) {
    if (!auth || !apartmentId) {
      setMatchDebts([]);
      setMatchRelated([]);
      return;
    }
    const [debts, relations] = await Promise.all([
      listApartmentDebts(auth, { apartmentId, status: "OPEN", perPage: 100 }),
      listRelations(auth, { apartmentId, active: true, perPage: 50 }),
    ]);
    setMatchDebts(debts.items);
    setMatchRelated(
      relations.items.map((rel) => ({
        id: rel.person.id,
        fullName: rel.person.fullName,
        roleLabel: RELATION_TYPE_LABELS[rel.relationType] ?? rel.relationType,
      })),
    );
  }

  async function handleMatch(payload: BankMatchPayload) {
    if (!auth || !matchingTx) return;
    setMatchPending(true);
    setMatchError("");
    try {
      await matchBankTransaction(auth, matchingTx.id, payload);
      const apt = matchApartments.find((a) => a.id === payload.apartmentId);
      const person =
        matchRelated.find((p) => p.id === payload.personId)?.fullName ??
        persons.find((p) => p.id === payload.personId)?.fullName;
      showToast(
        apt
          ? `Hareket Daire ${apt.number}${person ? ` — ${person}` : ""} ile eşleştirildi.`
          : "Eşleştirme kaydedildi.",
      );
      setMatchOpen(false);
      await refreshAll();
    } catch (error) {
      setMatchError(error instanceof ApiError ? error.message : "Eşleştirme başarısız.");
    } finally {
      setMatchPending(false);
    }
  }

  async function handleProcess(matchPayload: BankMatchPayload, processPayload: BankProcessPayload) {
    if (!auth || !matchingTx) return;
    setMatchPending(true);
    setMatchError("");
    try {
      await matchBankTransaction(auth, matchingTx.id, matchPayload);
      await processBankTransaction(auth, matchingTx.id, processPayload);
      showToast("Tahsilata aktarıldı.");
      setMatchOpen(false);
      await refreshAll();
    } catch (error) {
      setMatchError(error instanceof ApiError ? error.message : "İşlem başarısız.");
    } finally {
      setMatchPending(false);
    }
  }

  async function handleConfirmSuggestion(tx: BankTransaction) {
    if (!auth || rowActionPending) return;
    setRowActionPending(tx.id);
    try {
      await confirmBankTransactionMatch(auth, tx.id);
      showToast("Eşleşme onaylandı. Tahsilata aktarmaya hazır.");
      await refreshAll();
    } catch (error) {
      toastError(error, "Eşleşme onaylanamadı.");
    } finally {
      setRowActionPending(null);
    }
  }

  async function handleProcessAuto(tx: BankTransaction) {
    if (!auth || rowActionPending) return;
    setRowActionPending(tx.id);
    try {
      if (tx.matchStatus === "SUGGESTED") {
        await confirmBankTransactionMatch(auth, tx.id);
      }
      await processBankTransactionAuto(auth, tx.id);
      showToast("Banka hareketi tahsilata aktarıldı ve daire borçlarına işlendi.");
      await refreshAll();
    } catch (error) {
      toastError(error, "Tahsilata aktarılamadı.");
    } finally {
      setRowActionPending(null);
    }
  }

  async function handleUnmatch(tx: BankTransaction) {
    if (!auth) return;
    try {
      await unmatchBankTransaction(auth, tx.id);
      showToast("Eşleşme kaldırıldı.");
      await refreshAll();
    } catch (error) {
      toastError(error, "Eşleşme kaldırılamadı.");
    }
  }

  async function handleIgnore() {
    if (!auth || !ignoringTx) return;
    setIgnorePending(true);
    try {
      await ignoreBankTransaction(auth, ignoringTx.id);
      showToast("Hareket hariç tutuldu.");
      setIgnoringTx(null);
      await refreshAll();
    } catch (error) {
      toastError(error, "İşlem başarısız.");
    } finally {
      setIgnorePending(false);
    }
  }

  async function handleRuleSubmit(values: BankMatchingRuleFormValues) {
    if (!auth || ruleFormPending) return;
    setRuleFormPending(true);
    setRuleFormError("");
    try {
      const payload = bankMatchingRuleFormToPayload(values);
      if (editingRule) {
        await updateBankMatchingRule(auth, editingRule.id, payload);
        showToast("Kural güncellendi.");
      } else {
        await createBankMatchingRule(auth, payload);
        showToast("Eşleştirme kuralı kaydedildi.");
      }
      setRuleFormOpen(false);
      await loadRules();
    } catch (error) {
      setRuleFormError(error instanceof ApiError ? error.message : "Kural kaydedilemedi.");
    } finally {
      setRuleFormPending(false);
    }
  }

  const tabs: Array<{ id: HubTab; label: string }> = [
    { id: "hareketler", label: "Banka Hareketleri" },
    { id: "ekstre", label: "Ekstre İçe Aktar" },
    { id: "kurallar", label: "Eşleştirme Kuralları" },
    { id: "hesaplar", label: "Banka Hesapları" },
  ];

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Muhasebe
      </Link>

      <PageHeader
        title="Banka"
        description={
          site?.name
            ? `${site.name} — ekstre içe aktarma, eşleştirme ve tahsilat.`
            : "Banka ekstresi ve tahsilat."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (!hasSites) {
                  setNeedSiteOpen(true);
                  return;
                }
                setAccountFormError("");
                setAccountFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Banka Hesabı
            </Button>
            <Button
              onClick={() => {
                if (!hasSites) {
                  setNeedSiteOpen(true);
                  return;
                }
                setImportOpen(true);
              }}
            >
              <Upload className="size-4" aria-hidden />
              Ekstre İçe Aktar
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard tone="cyan" label="Banka hesapları" value={String(summary?.accounts ?? "—")} />
        <StatCard
          tone="amber"
          label="Tahsilat onayı bekleyen"
          value={String(summary?.pendingMatch ?? "—")}
          hint="Eşleşmiş gelen hareketler; tahsilat onayı bekliyor."
          onClick={filterPendingMatches}
        />
        <StatCard
          tone="rose"
          label="Eşleşmeyen gelen"
          value={String(summary?.unmatchedCredit ?? summary?.unmatched ?? "—")}
          hint="Daire eşleşmesi olmayan gelen hareketler."
          onClick={() => {
            setTab("hareketler");
            setPendingFocus(false);
            setDirection("CREDIT");
            setMatchStatus("UNMATCHED");
            setDebitClass("");
          }}
        />
        <StatCard
          tone="violet"
          label="Sınıflandırılmamış giden"
          value={String(summary?.unclassifiedDebit ?? "—")}
          hint="Gider/transfer kararı verilmemiş çıkışlar."
          onClick={() => {
            setTab("hareketler");
            setPendingFocus(false);
            setDirection("DEBIT");
            setMatchStatus("");
            setDebitClass("UNCLASSIFIED");
          }}
        />
        <StatCard
          tone="green"
          label="Bu ay tahsilata / gider"
          value={`${summary?.processedThisMonth ?? "—"} / ${summary?.expensesThisMonth ?? "—"}`}
          hint="Tahsilata aktarılan gelen · giderleştirilen giden."
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-line pb-px">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {listError && (tab === "hareketler" || tab === "ekstre") ? (
        <p className="mb-3 text-sm text-danger">{listError}</p>
      ) : null}

      {tab === "ekstre" ? (
        <SurfaceCard className="mb-5 max-w-xl">
          <EmptyState
            className="py-8"
            title="Banka ekstresi içe aktarın"
            description="Hesap yoksa sihirbaz içinde tanımlayabilirsiniz. Banka bağlantısı kurulmaz; hesap yalnızca ekstreleri düzenlemek ve mükerrer hareketleri önlemek içindir."
            icon={Upload}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setImportOpen(true)}>Ekstre İçe Aktar</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAccountFormError("");
                    setAccountFormOpen(true);
                  }}
                >
                  Manuel Banka Hesabı Ekle
                </Button>
              </div>
            }
          />
        </SurfaceCard>
      ) : null}

      {!loading && transactions.length === 0 && accounts.length === 0 && tab === "hareketler" ? (
        <SurfaceCard className="mb-5 max-w-xl">
          <EmptyState
            className="py-8"
            title="Henüz banka hareketi yok"
            description="Ekstre içe aktararak başlayın. Hesap kaydı sihirbaz içinde de oluşturulabilir."
            icon={Upload}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setImportOpen(true)}>Ekstre İçe Aktar</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAccountFormError("");
                    setAccountFormOpen(true);
                  }}
                >
                  Manuel Banka Hesabı Ekle
                </Button>
              </div>
            }
          />
        </SurfaceCard>
      ) : null}

      {(tab === "hareketler" || tab === "ekstre") &&
      !(tab === "hareketler" && !loading && transactions.length === 0 && accounts.length === 0) ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Açıklama veya referans ara…"
              className="min-w-[220px] flex-1"
            />
            <Select
              value={direction}
              onChange={(e) => {
                setPendingFocus(false);
                setDirection(e.target.value);
                setMatchStatus("");
                setDebitClass("");
              }}
              className="w-36"
            >
              <option value="">Tümü</option>
              <option value="CREDIT">Gelen</option>
              <option value="DEBIT">Giden</option>
            </Select>
            {direction !== "DEBIT" ? (
              <Select
                value={matchStatus}
                onChange={(e) => {
                  setPendingFocus(false);
                  setMatchStatus(e.target.value);
                }}
                className="w-56"
              >
                <option value="">Durum (gelen)</option>
                <option value="UNMATCHED">Eşleşmedi</option>
                <option value="SUGGESTED">Öneri bulundu / onay bekliyor</option>
                <option value="MATCHED">Eşleşme onaylandı</option>
                <option value="PROCESSED">Tahsilata aktarıldı</option>
              </Select>
            ) : (
              <Select
                value={debitClass}
                onChange={(e) => {
                  setPendingFocus(false);
                  setDebitClass(e.target.value);
                }}
                className="w-56"
              >
                <option value="">Durum (giden)</option>
                <option value="UNCLASSIFIED">Sınıflandırılmadı</option>
                <option value="EXPENSE">Giderle eşleşti</option>
                <option value="EXCLUDED">Hariç tutuldu</option>
              </Select>
            )}
          </div>

          {pendingSelectable.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--tone-amber-border)] bg-[color:var(--tone-amber-bg)] px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={
                    pendingSelectable.length > 0 &&
                    selectedPendingIds.length === pendingSelectable.length
                  }
                  onChange={toggleSelectAllPending}
                />
                {pendingSelectable.length} onay bekleyen seç
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedPendingIds.length === 0}
                onClick={() => {
                  const first = transactions.find((t) => t.id === selectedPendingIds[0]);
                  if (first) void openMatch(first);
                }}
              >
                {selectedPendingIds.length || pendingSelectable.length} Eşleşmeyi Kontrol Et
              </Button>
              <Button
                size="sm"
                disabled={selectedPendingIds.length === 0}
                onClick={() => setBulkOpen(true)}
              >
                {selectedPendingIds.length} Hareketi Tahsilata Aktar
              </Button>
            </div>
          ) : null}

          <SurfaceCard padding="none" className="overflow-hidden">
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-10">
                      <span className="sr-only">Seç</span>
                    </TH>
                    <TH>İşlem tarihi</TH>
                    <TH>Banka hesabı</TH>
                    <TH>Açıklama</TH>
                    <TH className="text-right">Gelen</TH>
                    <TH className="text-right">Giden</TH>
                    <TH>Eşleşen</TH>
                    <TH>Güven</TH>
                    <TH>Durum</TH>
                    <TH className="text-right">İşlemler</TH>
                  </TR>
                </THead>
                <TBody>
                  {loading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <TR key={`s-${index}`} className="hover:bg-transparent">
                          <TD colSpan={10}>
                            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                          </TD>
                        </TR>
                      ))
                    : null}
                  {!loading && transactions.length === 0 ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={10} className="py-8 text-center text-sm text-muted">
                        Henüz banka hareketi yok. Ekstre içe aktararak başlayın.
                      </TD>
                    </TR>
                  ) : null}
                  {!loading
                    ? transactions.map((tx) => {
                        const action = primaryRowAction(tx);
                        const pendingRow =
                          tx.direction === "CREDIT" &&
                          !tx.payment &&
                          (tx.matchStatus === "SUGGESTED" || tx.matchStatus === "MATCHED");
                        return (
                        <TR key={tx.id}>
                          <TD>
                            {pendingRow ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(tx.id)}
                                onChange={() => toggleSelect(tx.id)}
                                aria-label="Hareketi seç"
                              />
                            ) : null}
                          </TD>
                          <TD className="whitespace-nowrap text-sm">
                            {formatDateTr(tx.transactionDate)}
                          </TD>
                          <TD className="text-sm">
                            {tx.bankAccount.bankName}
                            <span className="block text-xs text-muted">
                              {tx.bankAccount.accountName}
                            </span>
                          </TD>
                          <TD className="max-w-[240px] truncate text-sm" title={tx.description}>
                            {tx.description}
                          </TD>
                          <TD className="text-right text-sm">
                            {tx.direction === "CREDIT" ? formatMoney(tx.amount) : "—"}
                          </TD>
                          <TD className="text-right text-sm">
                            {tx.direction === "DEBIT" ? formatMoney(tx.amount) : "—"}
                          </TD>
                          <TD className="text-sm">
                            {tx.matchedApartment
                              ? `${tx.matchedApartment.building.name} / ${tx.matchedApartment.number}`
                              : "—"}
                            {tx.matchedPerson ? (
                              <span className="block text-xs text-muted">
                                {tx.matchedPerson.fullName}
                              </span>
                            ) : null}
                          </TD>
                          <TD className="text-sm">{confidenceLabel(tx.matchStatus)}</TD>
                          <TD className="text-sm">
                            {statusLabel(tx)}
                            <span className="block text-xs text-muted">
                              {BANK_DIRECTION_LABELS[tx.direction]}
                            </span>
                          </TD>
                          <TD className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {action === "match" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void openMatch(tx)}
                                >
                                  Daireyle Eşleştir
                                </Button>
                              ) : null}
                              {action === "review" ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={rowActionPending === tx.id}
                                    onClick={() => void openMatch(tx)}
                                  >
                                    Kontrol Et
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={rowActionPending === tx.id}
                                    onClick={() => void handleConfirmSuggestion(tx)}
                                  >
                                    Onayla
                                  </Button>
                                </>
                              ) : null}
                              {action === "process" ? (
                                <Button
                                  size="sm"
                                  disabled={rowActionPending === tx.id}
                                  onClick={() => void handleProcessAuto(tx)}
                                >
                                  Tahsilata Aktar
                                </Button>
                              ) : null}
                              {action === "classify" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setClassifyingTx(tx)}
                                >
                                  Sınıflandır
                                </Button>
                              ) : null}
                              {action === "payment" && tx.payment ? (
                                <Link
                                  href={`/app/muhasebe/tahsilatlar/${tx.payment.id}`}
                                  className="inline-flex h-8 items-center px-2 text-xs font-medium text-accent hover:underline"
                                >
                                  Tahsilatı Gör
                                </Link>
                              ) : null}
                              {action === "expense" && tx.expense ? (
                                <Link
                                  href={`/app/muhasebe/giderler/${tx.expense.id}`}
                                  className="inline-flex h-8 items-center px-2 text-xs font-medium text-accent hover:underline"
                                >
                                  Gideri Gör
                                </Link>
                              ) : null}
                              <Dropdown
                                align="right"
                                trigger={
                                  <Button size="sm" variant="ghost" aria-label="Diğer işlemler">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                }
                              >
                                {tx.direction === "CREDIT" &&
                                tx.matchStatus !== "PROCESSED" &&
                                tx.status === "ACTIVE" ? (
                                  <DropdownItem onClick={() => void openMatch(tx)}>
                                    Eşleşmeyi Değiştir
                                  </DropdownItem>
                                ) : null}
                                {tx.direction === "CREDIT" &&
                                (tx.matchStatus === "MATCHED" || tx.matchStatus === "SUGGESTED") &&
                                !tx.payment ? (
                                  <DropdownItem onClick={() => void handleUnmatch(tx)}>
                                    Tahsilat Eşleşmesini Geri Al
                                  </DropdownItem>
                                ) : null}
                                {tx.direction === "DEBIT" &&
                                tx.debitClass &&
                                tx.debitClass !== "UNCLASSIFIED" &&
                                !tx.expense ? (
                                  <DropdownItem
                                    onClick={() =>
                                      void (async () => {
                                        if (!auth) return;
                                        try {
                                          await classifyBankDebit(auth, tx.id, { action: "RESET" });
                                          showToast("Sınıflandırma geri alındı.");
                                          await refreshAll();
                                        } catch (error) {
                                          toastError(error, "Sınıflandırma geri alınamadı.");
                                        }
                                      })()
                                    }
                                  >
                                    Sınıflandırmayı Geri Al
                                  </DropdownItem>
                                ) : null}
                                {tx.direction === "DEBIT" && !tx.expense ? (
                                  <DropdownItem onClick={() => setClassifyingTx(tx)}>
                                    Sınıflandır
                                  </DropdownItem>
                                ) : null}
                                {tx.matchStatus !== "PROCESSED" &&
                                !tx.expense &&
                                tx.status === "ACTIVE" ? (
                                  <DropdownItem danger onClick={() => setIgnoringTx(tx)}>
                                    Banka Hareketini Hariç Tut
                                  </DropdownItem>
                                ) : null}
                                <DropdownItem href={`/app/muhasebe/bankalar/${tx.bankAccount.id}`}>
                                  Hesap Detayını Gör
                                </DropdownItem>
                                {tx.payment ? (
                                  <DropdownItem href={`/app/muhasebe/tahsilatlar/${tx.payment.id}`}>
                                    Dağıtımı Gör
                                  </DropdownItem>
                                ) : null}
                                {tx.expense ? (
                                  <DropdownItem href={`/app/muhasebe/giderler/${tx.expense.id}`}>
                                    Gider Kaydını Gör
                                  </DropdownItem>
                                ) : null}
                              </Dropdown>
                            </div>
                          </TD>
                        </TR>
                        );
                      })
                    : null}
                </TBody>
              </TableElement>
            </Table>
          </SurfaceCard>
        </>
      ) : null}

      {tab === "kurallar" ? (
        <SurfaceCard padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm text-muted">
              Açıklama parçası → daire eşleştirme kuralları (tenant/site izolasyonlu).
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingRule(null);
                setRuleInitial(emptyBankMatchingRuleForm());
                setRuleFormError("");
                setRuleFormOpen(true);
              }}
            >
              Kural Ekle
            </Button>
          </div>
          <Table>
            <TableElement>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Ad</TH>
                  <TH>Anahtar</TH>
                  <TH>Daire</TH>
                  <TH>Öncelik</TH>
                  <TH>Durum</TH>
                  <TH className="text-right">İşlemler</TH>
                </TR>
              </THead>
              <TBody>
                {rules.length === 0 ? (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                      Henüz eşleştirme kuralı yok.
                    </TD>
                  </TR>
                ) : (
                  rules.map((rule) => (
                    <TR key={rule.id}>
                      <TD className="text-sm">{rule.name}</TD>
                      <TD className="text-sm">{rule.containsText}</TD>
                      <TD className="text-sm">
                        {rule.apartment
                          ? `${rule.building?.name ?? "—"} / ${rule.apartment.number}`
                          : "—"}
                      </TD>
                      <TD className="text-sm">{rule.priority}</TD>
                      <TD className="text-sm">{rule.isActive ? "Aktif" : "Pasif"}</TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingRule(rule);
                              setRuleInitial(bankMatchingRuleToForm(rule));
                              setRuleFormOpen(true);
                            }}
                          >
                            Düzenle
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingRule(rule)}
                          >
                            Sil
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </TableElement>
          </Table>
        </SurfaceCard>
      ) : null}

      {tab === "hesaplar" ? (
        <SurfaceCard padding="none" className="overflow-hidden">
          <Table>
            <TableElement>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Banka</TH>
                  <TH>Hesap</TH>
                  <TH>IBAN</TH>
                  <TH className="text-right">Kayıtlı Bakiye</TH>
                  <TH className="text-right">İşlemler</TH>
                </TR>
              </THead>
              <TBody>
                {accounts.length === 0 ? (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                      Henüz banka hesabı yok.
                    </TD>
                  </TR>
                ) : (
                  accounts.map((account) => (
                    <TR key={account.id}>
                      <TD className="text-sm">{account.bankName}</TD>
                      <TD className="text-sm">{account.accountName}</TD>
                      <TD className="text-sm">{account.iban ?? "—"}</TD>
                      <TD className="text-right text-sm">{formatMoney(account.bookBalance)}</TD>
                      <TD className="text-right">
                        <Link
                          href={`/app/muhasebe/bankalar/${account.id}`}
                          className="text-sm text-accent hover:underline"
                        >
                          Detay
                        </Link>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </TableElement>
          </Table>
        </SurfaceCard>
      ) : null}

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <BankAccountFormModal
        open={accountFormOpen}
        pending={accountFormPending}
        error={accountFormError}
        initialValues={emptyBankAccountForm()}
        onClose={() => setAccountFormOpen(false)}
        onSubmit={handleCreateAccount}
      />

      {auth ? (
        <BankStatementImportWizard
          open={importOpen}
          auth={auth}
          accounts={accounts}
          apartments={apartments}
          onClose={() => setImportOpen(false)}
          onAccountsChanged={async () => {
            await loadSummaryAndAccounts();
          }}
          onDone={(result) => {
            if (result) {
              const awaiting = result.matchedWithoutPayment ?? 0;
              const title =
                result.processedPayments > 0
                  ? `${result.createdCount} banka hareketi içe aktarıldı. ${result.processedPayments} hareket tahsilata aktarıldı.`
                  : `${result.createdCount} banka hareketi içe aktarıldı.${
                      awaiting > 0
                        ? ` ${awaiting} eşleşme tahsilata aktarılmayı bekliyor.`
                        : ""
                    }`;
              showToast({
                title,
                tone: "success",
                action:
                  awaiting > 0 || result.processedPayments === 0
                    ? {
                        label: "Tahsilatları Kontrol Et",
                        onClick: () => filterPendingMatches(),
                      }
                    : undefined,
              });
            } else {
              showToast("Ekstre başarıyla aktarıldı.");
            }
            void refreshAll();
          }}
        />
      ) : null}

      <BankBulkProcessModal
        open={bulkOpen}
        auth={auth}
        ids={selectedPendingIds}
        onClose={() => setBulkOpen(false)}
        onDone={(summary) => {
          setSelectedIds([]);
          if (summary.processed > 0 && summary.skipped === 0 && summary.failed === 0) {
            showToast(
              `${summary.processed} banka hareketi tahsilata aktarıldı ve daire borçlarına işlendi.`,
            );
          } else if (summary.processed > 0) {
            showToast({
              title: `${summary.processed} hareket tahsilata aktarıldı. ${summary.skipped + summary.failed} hareket kontrol edilmek üzere bekletildi.`,
              tone: "warning",
            });
          } else {
            showToast({
              title: "Hiçbir hareket tahsilata aktarılmadı.",
              description: "Riskli veya engellenen eşleşmeleri tek tek kontrol edin.",
              tone: "warning",
            });
          }
          void refreshAll();
        }}
      />

      <BankMatchModal
        open={matchOpen}
        transaction={matchingTx}
        siteLabel={site?.name ?? ""}
        buildings={buildings}
        apartments={matchApartments}
        debts={matchDebts}
        persons={persons}
        relatedPersons={matchRelated}
        pending={matchPending}
        error={matchError}
        onClose={() => setMatchOpen(false)}
        onBuildingChange={(id) => void onBuildingChange(id)}
        onApartmentChange={(id) => void onApartmentChange(id)}
        onMatch={handleMatch}
        onProcess={handleProcess}
      />

      <BankMatchingRuleFormModal
        open={ruleFormOpen}
        mode={editingRule ? "edit" : "create"}
        siteLabel={site?.name ?? ""}
        bankAccounts={accounts}
        showBankAccountField
        buildings={buildings}
        apartments={ruleApartments.length ? ruleApartments : apartments}
        persons={persons}
        initialValues={ruleInitial}
        pending={ruleFormPending}
        error={ruleFormError}
        onClose={() => setRuleFormOpen(false)}
        onBuildingChange={(buildingId) => {
          if (!auth || !buildingId) {
            setRuleApartments([]);
            return;
          }
          void listApartments(auth, { buildingId, status: "aktif", perPage: 200 }).then((r) =>
            setRuleApartments(r.items),
          );
        }}
        onSubmit={handleRuleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deletingRule)}
        title="Kuralı sil"
        description="Bu eşleştirme kuralı pasife alınacak / silinecek."
        confirmLabel="Sil"
        pending={deleteRulePending}
        onClose={() => setDeletingRule(null)}
        onConfirm={async () => {
          if (!auth || !deletingRule) return;
          setDeleteRulePending(true);
          try {
            await deleteBankMatchingRule(auth, deletingRule.id);
            showToast("Kural silindi.");
            setDeletingRule(null);
            await loadRules();
          } catch (error) {
            toastError(error, "Silinemedi.");
          } finally {
            setDeleteRulePending(false);
          }
        }}
      />

      <BankDebitClassifyModal
        open={Boolean(classifyingTx)}
        auth={auth}
        transaction={classifyingTx}
        onClose={() => setClassifyingTx(null)}
        onDone={(message) => {
          showToast(message);
          void refreshAll();
        }}
      />

      <ConfirmDialog
        open={Boolean(ignoringTx)}
        title="Banka hareketini hariç tut"
        description="Hareket listede hariç tutulmuş olarak kalır; bankada gerçekleşen işlem silinmez. Tahsilat veya gider bağlı hareketler hariç tutulamaz."
        confirmLabel="Hariç Tut"
        pending={ignorePending}
        onClose={() => setIgnoringTx(null)}
        onConfirm={() => void handleIgnore()}
      />
    </PageContainer>
  );
}
