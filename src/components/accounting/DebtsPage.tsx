"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, MessageCircle, MoreHorizontal, Plus, Wallet } from "lucide-react";
import { FinanceMetricCard } from "@/components/accounting/FinanceMetricCard";
import {
  DebtFormModal,
  debtFormToPayload,
  emptyDebtForm,
  type DebtFormValues,
} from "@/components/accounting/DebtFormModal";
import { DebtReminderHistoryModal } from "@/components/accounting/DebtReminderHistoryModal";
import { DebtReminderSendModal } from "@/components/accounting/DebtReminderSendModal";
import { PaymentFormModal } from "@/components/accounting/PaymentFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { SectionCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
import {
  cancelApartmentDebt,
  createApartmentDebt,
  listApartmentDebts,
  type ApartmentDebt,
} from "@/lib/debts-api";
import { ApiError } from "@/lib/http";
import {
  DEBT_STATUS_LABELS,
  DEBT_TYPE_LABELS,
  MONTH_LABELS,
  formatDateTr,
  formatMoney,
  formatPeriod,
} from "@/lib/money";
import { RELATION_TYPE_LABELS } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import { createPayment, type PaymentPayload } from "@/lib/payments-api";
import { hasPermission } from "@/lib/permissions";
import { listRelations } from "@/lib/relations-api";
import { getWhatsAppIntegration } from "@/lib/whatsapp-api";

const PER_PAGE = 20;

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function can(user: ReturnType<typeof useAuth>["user"], code: string) {
  if (!user) return false;
  if (!user.permissions?.length) return true;
  return hasPermission(user, code);
}

function paidAmount(debt: ApartmentDebt) {
  return (Number(debt.originalAmount) - Number(debt.remainingAmount)).toFixed(2);
}

function debtStatusTone(debt: ApartmentDebt): BadgeTone {
  if (debt.status === "CANCELLED") return "neutral";
  if (debt.status === "PAID") return "success";
  if (debt.dueState === "overdue") return "danger";
  return "warning";
}

function debtStatusLabel(debt: ApartmentDebt) {
  if (debt.status === "OPEN" && debt.dueState === "overdue") return "Gecikmiş";
  return DEBT_STATUS_LABELS[debt.status];
}

export function DebtsPage() {
  const { ready, user } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { hasSites, siteId } = useActiveSite();

  const canCreateDebt = can(user, "debts.create");
  const canCancelDebt = can(user, "debts.cancel");
  const canCreatePayment = can(user, "payments.create");
  const canSendMessage = can(user, "messages.send");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [whatsappReady, setWhatsappReady] = useState(false);

  const [openRemaining, setOpenRemaining] = useState("0.00");
  const [overdueRemaining, setOverdueRemaining] = useState("0.00");
  const [indebtedApartments, setIndebtedApartments] = useState(0);
  const [monthCreated, setMonthCreated] = useState("0.00");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [buildingId, setBuildingId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ApartmentDebt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualPending, setManualPending] = useState(false);
  const [manualError, setManualError] = useState("");
  const [cancelling, setCancelling] = useState<ApartmentDebt | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

  const [collectOpen, setCollectOpen] = useState(false);
  const [collectPending, setCollectPending] = useState(false);
  const [collectError, setCollectError] = useState("");
  const [collectDebt, setCollectDebt] = useState<ApartmentDebt | null>(null);
  const [collectPersons, setCollectPersons] = useState<PersonListItem[]>([]);
  const [collectRelated, setCollectRelated] = useState<
    Array<{ id: string; fullName: string; roleLabel: string }>
  >([]);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const showWhatsAppAction = canSendMessage && whatsappReady;

  const loadBuildings = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBuildings(auth, { status: "aktif", perPage: 100 });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    }
  }, [auth]);

  const loadWhatsapp = useCallback(async () => {
    if (!auth) {
      setWhatsappReady(false);
      return;
    }
    try {
      const result = await getWhatsAppIntegration(auth);
      setWhatsappReady(result.integration?.connectionStatus === "CONNECTED");
    } catch {
      setWhatsappReady(false);
    }
  }, [auth]);

  const loadMetrics = useCallback(async () => {
    if (!auth) return;
    const now = new Date();
    const yesterday = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    try {
      const [openResult, overdueResult, monthResult] = await Promise.all([
        listApartmentDebts(auth, { status: "OPEN", perPage: 1 }),
        listApartmentDebts(auth, { status: "OPEN", dueTo: yesterday, perPage: 1 }),
        listApartmentDebts(auth, {
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
          perPage: 1,
        }),
      ]);
      setOpenRemaining(openResult.summary.totalRemainingAmount);
      setIndebtedApartments(openResult.summary.indebtedApartmentCount);
      setOverdueRemaining(overdueResult.summary.totalRemainingAmount);
      setMonthCreated(monthResult.summary.totalOriginalAmount);
    } catch {
      setOpenRemaining("0.00");
      setIndebtedApartments(0);
      setOverdueRemaining("0.00");
      setMonthCreated("0.00");
    }
  }, [auth]);

  const loadList = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await listApartmentDebts(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
        buildingId: buildingId || undefined,
        status: status === "OPEN" || status === "PAID" || status === "CANCELLED" ? status : undefined,
        type: type === "DUES" || type === "MANUAL" || type === "INTEREST" ? type : undefined,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof ApiError ? err.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, page, buildingId, status, type, dueFrom, dueTo]);

  useEffect(() => {
    if (!ready) return;
    void loadBuildings();
    void loadMetrics();
    void loadWhatsapp();
  }, [ready, loadBuildings, loadMetrics, loadWhatsapp]);

  useEffect(() => {
    if (!ready) return;
    void loadList();
  }, [ready, loadList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, buildingId, status, type, dueFrom, dueTo]);

  function requireSite(open: () => void) {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    open();
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
      await Promise.all([loadList(), loadMetrics()]);
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : "Borç kaydedilemedi.");
    } finally {
      setManualPending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !cancelling || cancelPending) return;
    setCancelPending(true);
    try {
      await cancelApartmentDebt(auth, cancelling.id);
      showToast("Borç iptal edildi.");
      setCancelling(null);
      await Promise.all([loadList(), loadMetrics()]);
    } catch (err) {
      toastError(err, "Borç iptal edilemedi.");
    } finally {
      setCancelPending(false);
    }
  }

  async function openCollect(debt: ApartmentDebt) {
    if (!auth) return;
    setCollectError("");
    try {
      const [personResult, relationResult] = await Promise.all([
        listPersons(auth, { status: "aktif", perPage: 100 }),
        listRelations(auth, { apartmentId: debt.apartment.id, active: true, perPage: 50 }),
      ]);
      setCollectPersons(personResult.items);
      setCollectRelated(
        relationResult.items.map((item) => ({
          id: item.person.id,
          fullName: item.person.fullName,
          roleLabel: RELATION_TYPE_LABELS[item.relationType],
        })),
      );
      setCollectDebt(debt);
      setCollectOpen(true);
    } catch (err) {
      toastError(err, "Tahsilat formu açılamadı.");
    }
  }

  async function handleCollectSubmit(payload: PaymentPayload, submitSiteId: string) {
    if (!auth || collectPending) return;
    setCollectPending(true);
    setCollectError("");
    try {
      await createPayment({ ...auth, siteId: submitSiteId }, payload, crypto.randomUUID());
      showToast("Tahsilat kaydedildi.");
      setCollectOpen(false);
      setCollectDebt(null);
      await Promise.all([loadList(), loadMetrics()]);
    } catch (err) {
      setCollectError(err instanceof ApiError ? err.message : "Tahsilat kaydedilemedi.");
    } finally {
      setCollectPending(false);
    }
  }

  const empty = !loading && items.length === 0 && !error;
  const filtersIdle = !debouncedSearch && !buildingId && status === "OPEN" && !type && !dueFrom && !dueTo;

  return (
    <PageContainer>
      <PageHeader
        title="Borçlar"
        description="Dairelerin aidat ve diğer borçlarını takip edin."
        actions={
          <>
            {showWhatsAppAction && indebtedApartments > 0 ? (
              <Button variant="secondary" onClick={() => setReminderOpen(true)}>
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp ile Hatırlat
              </Button>
            ) : null}
            {canCreateDebt ? (
              <Button onClick={() => requireSite(() => { setManualError(""); setManualOpen(true); })}>
                <Plus className="size-4" aria-hidden />
                Borç Ekle
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard
          label="Toplam Açık Borç"
          value={formatMoney(openRemaining)}
          icon={Wallet}
          tone="warning"
        />
        <FinanceMetricCard
          label="Gecikmiş Borç"
          value={formatMoney(overdueRemaining)}
          icon={AlertTriangle}
          tone="danger"
        />
        <FinanceMetricCard
          label="Borçlu Daire Sayısı"
          value={String(indebtedApartments)}
          icon={Building2}
          tone="brand"
        />
        <FinanceMetricCard
          label="Bu Ay Oluşan Borç"
          value={formatMoney(monthCreated)}
          icon={Wallet}
          tone="neutral"
        />
      </div>

      {indebtedApartments > 0 ? (
        <SectionCard className="mb-5" tone="rose" title="Borç hatırlatması">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              {indebtedApartments} dairenin ödenmemiş aidat borcu bulunuyor.
            </p>
            {showWhatsAppAction ? (
              <Button size="sm" onClick={() => setReminderOpen(true)}>
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp ile Hatırlat
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                Geçmiş
              </Button>
            )}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Daire Borçları">
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          <SearchInput
            placeholder="Kişi veya daire ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">Tüm binalar</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Tüm borç tipleri</option>
            <option value="DUES">Aidat</option>
            <option value="MANUAL">Manuel</option>
            <option value="INTEREST">Gecikme Faizi</option>
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="OPEN">Açık</option>
            <option value="PAID">Ödendi</option>
            <option value="CANCELLED">İptal</option>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dueFrom}
              onChange={(event) => setDueFrom(event.target.value)}
              aria-label="Vade başlangıcı"
            />
            <Input
              type="date"
              value={dueTo}
              onChange={(event) => setDueTo(event.target.value)}
              aria-label="Vade bitişi"
            />
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        {empty ? (
          <EmptyState
            icon={Wallet}
            title="Ödenmemiş borç bulunmuyor."
            description={
              filtersIdle
                ? "Aidat veya manuel borç oluşturulduğunda burada listelenecektir."
                : "Filtrelere uygun borç kaydı yok."
            }
            action={
              canCreateDebt && filtersIdle ? (
                <Button onClick={() => requireSite(() => { setManualError(""); setManualOpen(true); })}>
                  Borç Ekle
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Bina / daire</TH>
                    <TH>Mülk sahibi</TH>
                    <TH>Kiracı</TH>
                    <TH>Borç tipi</TH>
                    <TH>Dönem / açıklama</TH>
                    <TH>Son ödeme tarihi</TH>
                    <TH className="text-right">Borç tutarı</TH>
                    <TH className="text-right">Ödenen</TH>
                    <TH className="text-right">Kalan</TH>
                    <TH>Durum</TH>
                    <TH className="text-right">İşlemler</TH>
                  </TR>
                </THead>
                <TBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <TR key={`ds-${index}`} className="hover:bg-transparent">
                          <TD colSpan={11}>
                            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                          </TD>
                        </TR>
                      ))
                    : items.map((debt) => (
                        <TR key={debt.id}>
                          <TD>
                            <span className="block max-w-[160px] truncate">{debt.building.name}</span>
                            <span className="text-caption text-muted">Daire {debt.apartment.number}</span>
                          </TD>
                          <TD className="max-w-[140px] truncate">{debt.primaryOwnerName || "—"}</TD>
                          <TD className="max-w-[140px] truncate">{debt.primaryTenantName || "—"}</TD>
                          <TD>{DEBT_TYPE_LABELS[debt.type]}</TD>
                          <TD className="max-w-[180px] truncate">
                            {formatPeriod(debt.periodYear, debt.periodMonth) !== "—"
                              ? formatPeriod(debt.periodYear, debt.periodMonth)
                              : debt.title}
                          </TD>
                          <TD className="whitespace-nowrap">{formatDateTr(debt.dueDate)}</TD>
                          <TD className="whitespace-nowrap text-right">{formatMoney(debt.originalAmount)}</TD>
                          <TD className="whitespace-nowrap text-right">{formatMoney(paidAmount(debt))}</TD>
                          <TD className="whitespace-nowrap text-right font-medium">
                            {formatMoney(debt.remainingAmount)}
                          </TD>
                          <TD>
                            <Badge tone={debtStatusTone(debt)}>{debtStatusLabel(debt)}</Badge>
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
                                Borcu Görüntüle
                              </DropdownItem>
                              {canCreatePayment && debt.status === "OPEN" && Number(debt.remainingAmount) > 0 ? (
                                <DropdownItem onClick={() => void openCollect(debt)}>Tahsilat Al</DropdownItem>
                              ) : null}
                              {showWhatsAppAction && debt.status === "OPEN" ? (
                                <DropdownItem onClick={() => setReminderOpen(true)}>
                                  WhatsApp Hatırlatması
                                </DropdownItem>
                              ) : null}
                              {canCancelDebt && debt.status === "OPEN" ? (
                                <DropdownItem danger onClick={() => setCancelling(debt)}>
                                  İptal Et
                                </DropdownItem>
                              ) : null}
                            </Dropdown>
                          </TD>
                        </TR>
                      ))}
                </TBody>
              </TableElement>
            </Table>
            <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
          </>
        )}
      </SectionCard>

      <DebtFormModal
        open={manualOpen}
        title="Borç Ekle"
        initialValues={emptyDebtForm({ siteId: siteId ?? "" })}
        pending={manualPending}
        error={manualError}
        onClose={() => (manualPending ? undefined : setManualOpen(false))}
        onSubmit={handleManualSubmit}
      />

      <PaymentFormModal
        open={collectOpen}
        mode="single"
        debts={collectDebt ? [collectDebt] : []}
        persons={collectPersons}
        relatedPersons={collectRelated}
        apartmentContext={
          collectDebt
            ? {
                siteId: siteId ?? "",
                label: `${collectDebt.building.name} · Daire ${collectDebt.apartment.number}`,
              }
            : null
        }
        pending={collectPending}
        error={collectError}
        onClose={() => {
          if (collectPending) return;
          setCollectOpen(false);
          setCollectDebt(null);
        }}
        onSubmit={handleCollectSubmit}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Borç iptal edilsin mi?"
        description="Bu borç aktif borç toplamlarından çıkarılacaktır. Finansal geçmiş kaydı korunacaktır."
        confirmLabel="Borcu İptal Et"
        cancelLabel="Vazgeç"
        danger
        pending={cancelPending}
        onConfirm={() => void handleCancel()}
        onClose={() => (cancelPending ? undefined : setCancelling(null))}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <DebtReminderSendModal open={reminderOpen} onClose={() => setReminderOpen(false)} />
      <DebtReminderHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </PageContainer>
  );
}
