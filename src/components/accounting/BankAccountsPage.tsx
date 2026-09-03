"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import {
  BankAccountFormModal,
  bankAccountFormToPayload,
  emptyBankAccountForm,
  type BankAccountFormValues,
} from "@/components/accounting/BankAccountFormModal";
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
  unmatchBankTransaction,
  updateBankMatchingRule,
  type BankAccount,
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
  if (status === "SUGGESTED") return "Orta/Yüksek";
  if (status === "MATCHED") return "Manuel";
  if (status === "PROCESSED") return "—";
  return "—";
}

export function BankAccountsPage() {
  const { ready } = useAuth();
  const { showToast } = useToast();
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
          matchStatus === "UNMATCHED" ||
          matchStatus === "SUGGESTED" ||
          matchStatus === "MATCHED" ||
          matchStatus === "PROCESSED"
            ? (matchStatus as BankMatchStatus)
            : undefined,
        status: "ACTIVE",
        perPage: 100,
      });
      setTransactions(result.items);
    } catch (error) {
      setTransactions([]);
      setListError(error instanceof ApiError ? error.message : "Hareketler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, direction, matchStatus]);

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
      showToast("Eşleştirme kaydedildi.");
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

  async function handleUnmatch(tx: BankTransaction) {
    if (!auth) return;
    try {
      await unmatchBankTransaction(auth, tx.id);
      showToast("Eşleştirme geri alındı.");
      await refreshAll();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Geri alma başarısız.");
    }
  }

  async function handleIgnore() {
    if (!auth || !ignoringTx) return;
    setIgnorePending(true);
    try {
      await ignoreBankTransaction(auth, ignoringTx.id);
      showToast("Hareket iptal edildi.");
      setIgnoringTx(null);
      await refreshAll();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "İşlem başarısız.");
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
        showToast("Kural eklendi.");
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Banka hesapları" value={String(summary?.accounts ?? "—")} />
        <StatCard label="Onay bekleyen hareketler" value={String(summary?.pendingMatch ?? "—")} />
        <StatCard label="Eşleşmeyen hareketler" value={String(summary?.unmatched ?? "—")} />
        <StatCard
          label="Bu ay tahsilata aktarılan"
          value={String(summary?.processedThisMonth ?? "—")}
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
            <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-36">
              <option value="">Yön</option>
              <option value="CREDIT">Gelen</option>
              <option value="DEBIT">Giden</option>
            </Select>
            <Select
              value={matchStatus}
              onChange={(e) => setMatchStatus(e.target.value)}
              className="w-44"
            >
              <option value="">Durum</option>
              <option value="UNMATCHED">Eşleşmedi</option>
              <option value="SUGGESTED">Otomatik Eşleşti</option>
              <option value="MATCHED">Manuel Eşleşti</option>
              <option value="PROCESSED">Tahsilata Aktarıldı</option>
            </Select>
          </div>

          <SurfaceCard padding="none" className="overflow-hidden">
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
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
                          <TD colSpan={9}>
                            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                          </TD>
                        </TR>
                      ))
                    : null}
                  {!loading && transactions.length === 0 ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={9} className="py-8 text-center text-sm text-muted">
                        Henüz banka hareketi yok. Ekstre içe aktararak başlayın.
                      </TD>
                    </TR>
                  ) : null}
                  {!loading
                    ? transactions.map((tx) => (
                        <TR key={tx.id}>
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
                            {tx.status === "IGNORED"
                              ? "İptal Edildi"
                              : BANK_MATCH_STATUS_LABELS[tx.matchStatus]}
                            <span className="block text-xs text-muted">
                              {BANK_DIRECTION_LABELS[tx.direction]}
                            </span>
                          </TD>
                          <TD className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {tx.direction === "CREDIT" &&
                              tx.matchStatus !== "PROCESSED" &&
                              tx.status === "ACTIVE" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void openMatch(tx)}
                                >
                                  Eşleştir
                                </Button>
                              ) : null}
                              {(tx.matchStatus === "MATCHED" || tx.matchStatus === "SUGGESTED") &&
                              !tx.payment ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void handleUnmatch(tx)}
                                >
                                  Geri Al
                                </Button>
                              ) : null}
                              {tx.matchStatus !== "PROCESSED" && tx.status === "ACTIVE" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setIgnoringTx(tx)}
                                >
                                  İptal
                                </Button>
                              ) : null}
                              <Link
                                href={`/app/muhasebe/bankalar/${tx.bankAccount.id}`}
                                className="inline-flex h-8 items-center px-2 text-xs text-accent hover:underline"
                              >
                                Hesap
                              </Link>
                            </div>
                          </TD>
                        </TR>
                      ))
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
          onDone={() => {
            showToast("Ekstre aktarıldı.");
            void refreshAll();
          }}
        />
      ) : null}

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
            showToast(error instanceof ApiError ? error.message : "Silinemedi.");
          } finally {
            setDeleteRulePending(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(ignoringTx)}
        title="Hareketi iptal et"
        description="Hareket yoksayılacak (İptal Edildi). Tahsilata aktarılmış hareketler iptal edilemez."
        confirmLabel="İptal Et"
        pending={ignorePending}
        onClose={() => setIgnoringTx(null)}
        onConfirm={() => void handleIgnore()}
      />
    </PageContainer>
  );
}
