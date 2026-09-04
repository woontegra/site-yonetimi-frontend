"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import {
  BankMatchModal,
  type RelatedPerson,
} from "@/components/accounting/BankMatchModal";
import {
  BankMatchingRuleFormModal,
  bankMatchingRuleFormToPayload,
  bankMatchingRuleToForm,
  emptyBankMatchingRuleForm,
  type BankMatchingRuleFormValues,
} from "@/components/accounting/BankMatchingRuleFormModal";
import {
  BankTransactionFormModal,
  bankTransactionFormToPayload,
  type BankTransactionFormValues,
} from "@/components/accounting/BankTransactionFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  createBankMatchingRule,
  createBankTransaction,
  deleteBankMatchingRule,
  getBankAccount,
  ignoreBankTransaction,
  listBankMatchingRules,
  listBankTransactions,
  matchBankTransaction,
  processBankTransaction,
  updateBankMatchingRule,
  type BankAccount,
  type BankDirection,
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

type DetailTab = "hareketler" | "kurallar";

export function BankAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();
  const { site } = useActiveSite();

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [accountError, setAccountError] = useState("");
  const [tab, setTab] = useState<DetailTab>("hareketler");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [direction, setDirection] = useState("");
  const [matchStatus, setMatchStatus] = useState("");
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState("");

  const [rules, setRules] = useState<BankMatchingRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [persons, setPersons] = useState<PersonListItem[]>([]);

  const [txFormOpen, setTxFormOpen] = useState(false);
  const [txFormPending, setTxFormPending] = useState(false);
  const [txFormError, setTxFormError] = useState("");

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

  const [ignoringTx, setIgnoringTx] = useState<BankTransaction | null>(null);
  const [ignorePending, setIgnorePending] = useState(false);
  const [deletingRule, setDeletingRule] = useState<BankMatchingRule | null>(null);
  const [deleteRulePending, setDeleteRulePending] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!auth || !accountId) return;
    try {
      const result = await getBankAccount(auth, accountId);
      setAccount(result.bankAccount);
      setAccountError("");
    } catch (error) {
      setAccount(null);
      setAccountError(error instanceof ApiError ? error.message : "Hesap yüklenemedi.");
    }
  }, [auth, accountId]);

  const loadTransactions = useCallback(async () => {
    if (!auth || !accountId) {
      setTxLoading(false);
      return;
    }
    setTxLoading(true);
    setTxError("");
    try {
      const result = await listBankTransactions(auth, {
        bankAccountId: accountId,
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
      setTxError(error instanceof ApiError ? error.message : "Hareketler yüklenemedi.");
    } finally {
      setTxLoading(false);
    }
  }, [auth, accountId, debouncedSearch, direction, matchStatus]);

  const loadRules = useCallback(async () => {
    if (!auth || !accountId) {
      setRulesLoading(false);
      return;
    }
    setRulesLoading(true);
    setRulesError("");
    try {
      const result = await listBankMatchingRules(auth, { bankAccountId: accountId });
      setRules(result.items);
    } catch (error) {
      setRules([]);
      setRulesError(error instanceof ApiError ? error.message : "Kurallar yüklenemedi.");
    } finally {
      setRulesLoading(false);
    }
  }, [auth, accountId]);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadAccount();
    void listBuildings(auth, { status: "aktif", perPage: 100 })
      .then((result) => setBuildings(result.items))
      .catch(() => setBuildings([]));
    void listPersons(auth, { status: "aktif", perPage: 100 })
      .then((result) => setPersons(result.items))
      .catch(() => setPersons([]));
  }, [ready, auth, loadAccount]);

  useEffect(() => {
    if (!ready || tab !== "hareketler") return;
    void loadTransactions();
  }, [ready, tab, loadTransactions]);

  useEffect(() => {
    if (!ready || tab !== "kurallar") return;
    void loadRules();
  }, [ready, tab, loadRules]);

  async function loadMatchApartments(buildingId: string) {
    if (!auth || !buildingId) {
      setMatchApartments([]);
      return;
    }
    try {
      const result = await listApartments(auth, { buildingId, status: "aktif", perPage: 100 });
      setMatchApartments(result.items);
    } catch {
      setMatchApartments([]);
    }
  }

  async function loadMatchApartmentContext(apartmentId: string) {
    if (!auth || !apartmentId) {
      setMatchDebts([]);
      setMatchRelated([]);
      return;
    }
    try {
      const [debtList, relationList] = await Promise.all([
        listApartmentDebts(auth, { apartmentId, status: "OPEN", perPage: 100 }),
        listRelations(auth, { apartmentId, active: true, perPage: 50 }),
      ]);
      setMatchDebts(debtList.items.filter((item) => Number(item.remainingAmount) > 0));
      setMatchRelated(
        relationList.items.map((item) => ({
          id: item.person.id,
          fullName: item.person.fullName,
          roleLabel: RELATION_TYPE_LABELS[item.relationType],
        })),
      );
    } catch {
      setMatchDebts([]);
      setMatchRelated([]);
    }
  }

  async function loadRuleApartments(buildingId: string) {
    if (!auth || !buildingId) {
      setRuleApartments([]);
      return;
    }
    try {
      const result = await listApartments(auth, { buildingId, status: "aktif", perPage: 100 });
      setRuleApartments(result.items);
    } catch {
      setRuleApartments([]);
    }
  }

  async function handleTxSubmit(values: BankTransactionFormValues) {
    if (!auth || !accountId || txFormPending) return;
    setTxFormPending(true);
    setTxFormError("");
    try {
      await createBankTransaction(auth, bankTransactionFormToPayload(accountId, values));
      showToast("Hareket eklendi.");
      setTxFormOpen(false);
      await Promise.all([loadTransactions(), loadAccount()]);
    } catch (error) {
      setTxFormError(error instanceof ApiError ? error.message : "Hareket kaydedilemedi.");
    } finally {
      setTxFormPending(false);
    }
  }

  async function handleMatch(payload: BankMatchPayload) {
    if (!auth || !matchingTx || matchPending) return;
    setMatchPending(true);
    setMatchError("");
    try {
      await matchBankTransaction(auth, matchingTx.id, payload);
      showToast("Hareket eşleştirildi.");
      setMatchOpen(false);
      setMatchingTx(null);
      await Promise.all([loadTransactions(), loadRules()]);
    } catch (error) {
      setMatchError(error instanceof ApiError ? error.message : "Eşleştirme başarısız.");
    } finally {
      setMatchPending(false);
    }
  }

  async function handleProcess(matchPayload: BankMatchPayload, processPayload: BankProcessPayload) {
    if (!auth || !matchingTx || matchPending) return;
    setMatchPending(true);
    setMatchError("");
    try {
      const needsMatch =
        matchingTx.matchStatus !== "MATCHED" ||
        matchingTx.matchedApartment?.id !== matchPayload.apartmentId ||
        (matchPayload.personId ?? null) !== (matchingTx.matchedPerson?.id ?? null) ||
        matchPayload.createRule;

      if (needsMatch) {
        await matchBankTransaction(auth, matchingTx.id, matchPayload);
      }
      await processBankTransaction(auth, matchingTx.id, processPayload);
      showToast("Hareket tahsilata dönüştürüldü.");
      setMatchOpen(false);
      setMatchingTx(null);
      await Promise.all([loadTransactions(), loadAccount(), loadRules()]);
    } catch (error) {
      setMatchError(error instanceof ApiError ? error.message : "İşlem başarısız.");
    } finally {
      setMatchPending(false);
    }
  }

  async function handleIgnore() {
    if (!auth || !ignoringTx || ignorePending) return;
    setIgnorePending(true);
    try {
      await ignoreBankTransaction(auth, ignoringTx.id);
      showToast("Hareket yoksayıldı.");
      setIgnoringTx(null);
      await Promise.all([loadTransactions(), loadAccount()]);
    } catch (error) {
      toastError(error, "Yoksayma başarısız.");
    } finally {
      setIgnorePending(false);
    }
  }

  async function handleRuleSubmit(values: BankMatchingRuleFormValues) {
    if (!auth || !accountId || ruleFormPending) return;
    setRuleFormPending(true);
    setRuleFormError("");
    try {
      const payload = bankMatchingRuleFormToPayload(values, accountId);
      if (editingRule) {
        await updateBankMatchingRule(auth, editingRule.id, {
          name: payload.name,
          containsText: payload.containsText,
          buildingId: values.buildingId || null,
          apartmentId: values.apartmentId || null,
          personId: values.personId || null,
          priority: payload.priority,
        });
        showToast("Kural güncellendi.");
      } else {
        await createBankMatchingRule(auth, payload);
        showToast("Kural oluşturuldu.");
      }
      setRuleFormOpen(false);
      setEditingRule(null);
      await loadRules();
    } catch (error) {
      setRuleFormError(error instanceof ApiError ? error.message : "Kural kaydedilemedi.");
    } finally {
      setRuleFormPending(false);
    }
  }

  async function handleDeleteRule() {
    if (!auth || !deletingRule || deleteRulePending) return;
    setDeleteRulePending(true);
    try {
      await deleteBankMatchingRule(auth, deletingRule.id);
      showToast("Kural silindi.");
      setDeletingRule(null);
      await loadRules();
    } catch (error) {
      toastError(error, "Kural silinemedi.");
    } finally {
      setDeleteRulePending(false);
    }
  }

  if (accountError) {
    return (
      <PageContainer>
        <Link
          href="/app/muhasebe/bankalar"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Banka Hesapları
        </Link>
        <p className="text-sm text-danger">{accountError}</p>
      </PageContainer>
    );
  }

  if (!account) {
    return (
      <PageContainer>
        <div className="h-6 w-64 animate-pulse rounded bg-slate-100" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe/bankalar"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Banka Hesapları
      </Link>

      <h1 className="mb-3 text-[22px] font-semibold leading-none text-ink">
        {account.bankName} · {account.accountName}
      </h1>

      <div className="mb-4 grid grid-cols-1 gap-2 rounded-[10px] border border-line bg-white p-4 text-sm shadow-panel sm:grid-cols-2 lg:grid-cols-3">
        <p>
          <span className="text-muted">IBAN: </span>
          <span className="font-mono text-ink">{account.ibanFull ?? account.iban ?? "—"}</span>
        </p>
        <p>
          <span className="text-muted">Hesap No: </span>
          <span className="text-ink">{account.accountNumber || "—"}</span>
        </p>
        <p>
          <span className="text-muted">Kayıtlı Bakiye: </span>
          <span className="font-medium text-ink">{formatMoney(account.bookBalance)}</span>
        </p>
        <p>
          <span className="text-muted">Bağlantı: </span>
          <span className="text-ink">Manuel</span>
        </p>
        <p>
          <span className="text-muted">Son Senkronizasyon: </span>
          <span className="text-ink">—</span>
        </p>
      </div>

      <section className="rounded-[10px] border border-line bg-white shadow-panel">
        <div className="flex gap-1 border-b border-line px-4">
          {(
            [
              { id: "hareketler", label: "Hareketler" },
              { id: "kurallar", label: "Eşleştirme Kuralları" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm transition-colors duration-micro",
                tab === item.id
                  ? "border-brand font-medium text-brand"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "hareketler" ? (
            <>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
                <div className="filter-row">
                  <SearchInput
                    className="h-9"
                    placeholder="Hareket ara..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Select
                    className="h-9 min-w-0 text-sm"
                    value={direction}
                    onChange={(event) => setDirection(event.target.value)}
                  >
                    <option value="">Tüm yönler</option>
                    <option value="CREDIT">Gelen</option>
                    <option value="DEBIT">Giden</option>
                  </Select>
                  <Select
                    className="h-9 min-w-0 text-sm"
                    value={matchStatus}
                    onChange={(event) => setMatchStatus(event.target.value)}
                  >
                    <option value="">Tüm durumlar</option>
                    {(Object.keys(BANK_MATCH_STATUS_LABELS) as BankMatchStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {BANK_MATCH_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      setTxFormError("");
                      setTxFormOpen(true);
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Manuel Hareket Ekle
                  </Button>
                </div>
              </div>

              {txError ? <p className="mb-3 text-sm text-danger">{txError}</p> : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Tarih</TH>
                        <TH>Açıklama</TH>
                        <TH>Gönderen</TH>
                        <TH className="text-right">Tutar</TH>
                        <TH>Yön</TH>
                        <TH>Eşleşme</TH>
                        <TH className="text-right">İşlemler</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {txLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                            <TR key={`ts-${index}`} className="hover:bg-transparent">
                              <TD colSpan={7}>
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                              </TD>
                            </TR>
                          ))
                        : null}
                      {!txLoading && transactions.length === 0 ? (
                        <TR className="hover:bg-transparent">
                          <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                            Henüz hareket bulunmuyor.
                          </TD>
                        </TR>
                      ) : null}
                      {!txLoading
                        ? transactions.map((tx) => (
                            <TR key={tx.id}>
                              <TD>{formatDateTr(tx.transactionDate)}</TD>
                              <TD className="max-w-[240px] truncate font-medium">{tx.description}</TD>
                              <TD>{tx.senderName || "—"}</TD>
                              <TD
                                className={cn(
                                  "text-right font-medium",
                                  tx.direction === "CREDIT" ? "text-success" : "text-danger",
                                )}
                              >
                                {tx.direction === "CREDIT"
                                  ? `+${formatMoney(tx.amount)}`
                                  : `-${formatMoney(tx.amount)}`}
                              </TD>
                              <TD>{BANK_DIRECTION_LABELS[tx.direction]}</TD>
                              <TD>
                                {tx.direction === "DEBIT"
                                  ? tx.debitClass === "EXPENSE" || tx.expense
                                    ? "Giderle Eşleşti"
                                    : tx.debitClass === "EXCLUDED" || tx.status === "IGNORED"
                                      ? "Hariç Tutuldu"
                                      : "Sınıflandırılmadı"
                                  : BANK_MATCH_STATUS_LABELS[tx.matchStatus]}
                              </TD>
                              <TD className="text-right">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {tx.direction === "CREDIT" && tx.matchStatus !== "PROCESSED" ? (
                                    <>
                                      <button
                                        type="button"
                                        className="text-sm text-brand hover:underline"
                                        onClick={() => {
                                          setMatchingTx(tx);
                                          setMatchError("");
                                          setMatchApartments([]);
                                          setMatchDebts([]);
                                          setMatchRelated([]);
                                          setMatchOpen(true);
                                        }}
                                      >
                                        Eşleştir
                                      </button>
                                      <button
                                        type="button"
                                        className="text-sm text-muted hover:text-danger"
                                        onClick={() => setIgnoringTx(tx)}
                                      >
                                        Hariç Tut
                                      </button>
                                    </>
                                  ) : null}
                                  {tx.direction === "DEBIT" &&
                                  !tx.expense &&
                                  tx.debitClass !== "EXCLUDED" &&
                                  tx.status === "ACTIVE" ? (
                                    <button
                                      type="button"
                                      className="text-sm text-muted hover:text-danger"
                                      onClick={() => setIgnoringTx(tx)}
                                    >
                                      Hariç Tut
                                    </button>
                                  ) : null}
                                  {tx.payment?.id ? (
                                    <Link
                                      href={`/app/muhasebe/tahsilatlar/${tx.payment.id}`}
                                      className="text-sm text-brand hover:underline"
                                    >
                                      Detay
                                    </Link>
                                  ) : null}
                                  {tx.expense?.id ? (
                                    <Link
                                      href={`/app/muhasebe/giderler/${tx.expense.id}`}
                                      className="text-sm text-brand hover:underline"
                                    >
                                      Gider
                                    </Link>
                                  ) : null}
                                </div>
                              </TD>
                            </TR>
                          ))
                        : null}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
            </>
          ) : null}

          {tab === "kurallar" ? (
            <>
              <div className="mb-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRule(null);
                    setRuleInitial(emptyBankMatchingRuleForm());
                    setRuleApartments([]);
                    setRuleFormError("");
                    setRuleFormOpen(true);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Yeni Kural
                </Button>
              </div>

              {rulesError ? <p className="mb-3 text-sm text-danger">{rulesError}</p> : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Ad</TH>
                        <TH>İçeren Metin</TH>
                        <TH>Bina</TH>
                        <TH>Daire</TH>
                        <TH>Kişi</TH>
                        <TH className="text-right">Öncelik</TH>
                        <TH className="text-right">İşlemler</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {rulesLoading
                        ? Array.from({ length: 3 }).map((_, index) => (
                            <TR key={`rs-${index}`} className="hover:bg-transparent">
                              <TD colSpan={7}>
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                              </TD>
                            </TR>
                          ))
                        : null}
                      {!rulesLoading && rules.length === 0 ? (
                        <TR className="hover:bg-transparent">
                          <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                            Henüz eşleştirme kuralı bulunmuyor.
                          </TD>
                        </TR>
                      ) : null}
                      {!rulesLoading
                        ? rules.map((rule) => (
                            <TR key={rule.id}>
                              <TD className="font-medium">{rule.name}</TD>
                              <TD>{rule.containsText}</TD>
                              <TD>{rule.building?.name || "—"}</TD>
                              <TD>{rule.apartment?.number || "—"}</TD>
                              <TD>{rule.person?.fullName || "—"}</TD>
                              <TD className="text-right">{rule.priority}</TD>
                              <TD className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    className="text-sm text-brand hover:underline"
                                    onClick={() => {
                                      setEditingRule(rule);
                                      setRuleInitial(bankMatchingRuleToForm(rule));
                                      setRuleFormError("");
                                      setRuleFormOpen(true);
                                    }}
                                  >
                                    Düzenle
                                  </button>
                                  <button
                                    type="button"
                                    className="text-sm text-muted hover:text-danger"
                                    onClick={() => setDeletingRule(rule)}
                                  >
                                    Sil
                                  </button>
                                </div>
                              </TD>
                            </TR>
                          ))
                        : null}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <BankTransactionFormModal
        open={txFormOpen}
        pending={txFormPending}
        error={txFormError}
        onClose={() => (txFormPending ? undefined : setTxFormOpen(false))}
        onSubmit={handleTxSubmit}
      />

      <BankMatchModal
        open={matchOpen}
        transaction={matchingTx}
        siteLabel={site?.name || "—"}
        buildings={buildings}
        apartments={matchApartments}
        debts={matchDebts}
        persons={persons}
        relatedPersons={matchRelated}
        pending={matchPending}
        error={matchError}
        onClose={() => (matchPending ? undefined : setMatchOpen(false))}
        onBuildingChange={(buildingId) => void loadMatchApartments(buildingId)}
        onApartmentChange={(apartmentId) => void loadMatchApartmentContext(apartmentId)}
        onMatch={handleMatch}
        onProcess={handleProcess}
      />

      <BankMatchingRuleFormModal
        open={ruleFormOpen}
        mode={editingRule ? "edit" : "create"}
        buildings={buildings}
        apartments={ruleApartments}
        persons={persons}
        initialValues={ruleInitial}
        pending={ruleFormPending}
        error={ruleFormError}
        onClose={() => (ruleFormPending ? undefined : setRuleFormOpen(false))}
        onSubmit={handleRuleSubmit}
        onBuildingChange={(buildingId) => void loadRuleApartments(buildingId)}
      />

      <ConfirmDialog
        open={Boolean(ignoringTx)}
        title="Hareket yoksayılsın mı?"
        description="Yoksayılan hareket eşleştirme ve tahsilat akışından çıkarılır."
        confirmLabel="Yoksay"
        cancelLabel="Vazgeç"
        danger
        pending={ignorePending}
        onConfirm={() => void handleIgnore()}
        onClose={() => (ignorePending ? undefined : setIgnoringTx(null))}
      />

      <ConfirmDialog
        open={Boolean(deletingRule)}
        title="Kural silinsin mi?"
        description="Bu eşleştirme kuralı pasifleştirilecektir."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deleteRulePending}
        onConfirm={() => void handleDeleteRule()}
        onClose={() => (deleteRulePending ? undefined : setDeletingRule(null))}
      />
    </PageContainer>
  );
}
