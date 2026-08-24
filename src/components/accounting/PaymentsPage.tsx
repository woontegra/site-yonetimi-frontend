"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CreditCard,
  Landmark,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Wallet,
} from "lucide-react";
import { DebtReminderHistoryModal } from "@/components/accounting/DebtReminderHistoryModal";
import { DebtReminderSendModal } from "@/components/accounting/DebtReminderSendModal";
import { FinanceMetricCard } from "@/components/accounting/FinanceMetricCard";
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
import { SectionCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { listApartmentDebts } from "@/lib/debts-api";
import { ApiError } from "@/lib/http";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTr,
  formatMoney,
} from "@/lib/money";
import {
  cancelPayment,
  createPayment,
  getMonthlyPaymentSummary,
  listPayments,
  type Payment,
  type PaymentMethod,
  type PaymentPayload,
  type PaymentStatus,
} from "@/lib/payments-api";
import { hasPermission } from "@/lib/permissions";
import { getWhatsAppIntegration } from "@/lib/whatsapp-api";

const PER_PAGE = 20;

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthRange() {
  const now = new Date();
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function can(user: ReturnType<typeof useAuth>["user"], code: string) {
  if (!user) return false;
  if (!user.permissions?.length) return true;
  return hasPermission(user, code);
}

function methodTone(method: PaymentMethod): BadgeTone {
  if (method === "CASH") return "success";
  if (method === "BANK_TRANSFER") return "brand";
  if (method === "CREDIT_CARD") return "info";
  return "neutral";
}

function statusTone(status: PaymentStatus): BadgeTone {
  return status === "COMPLETED" ? "success" : "neutral";
}

function relatedLabel(payment: Payment) {
  const first = payment.allocations[0]?.debt;
  if (first?.title) return first.title;
  return payment.description?.trim() || payment.title;
}

export function PaymentsPage() {
  const { ready, user } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { hasSites } = useActiveSite();

  const canCreate = can(user, "payments.create");
  const canCancel = can(user, "payments.cancel");
  const canSendMessage = can(user, "messages.send");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [monthTotal, setMonthTotal] = useState("0.00");
  const [monthCount, setMonthCount] = useState(0);
  const [cashTotal, setCashTotal] = useState("0.00");
  const [transferTotal, setTransferTotal] = useState("0.00");
  const [cardTotal, setCardTotal] = useState("0.00");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [method, setMethod] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [collectOpen, setCollectOpen] = useState(false);
  const [collectPending, setCollectPending] = useState(false);
  const [collectError, setCollectError] = useState("");
  const [cancelling, setCancelling] = useState<Payment | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

  const [indebtedApartments, setIndebtedApartments] = useState(0);
  const [openDebtTotal, setOpenDebtTotal] = useState("0.00");
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadBuildings = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBuildings(auth, { status: "aktif", perPage: 100 });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    }
  }, [auth]);

  const loadMetrics = useCallback(async () => {
    if (!auth) return;
    const range = currentMonthRange();
    try {
      const [summary, countResult, cash, transfer, card] = await Promise.all([
        getMonthlyPaymentSummary(auth),
        listPayments(auth, { dateFrom: range.from, dateTo: range.to, perPage: 1 }),
        listPayments(auth, {
          dateFrom: range.from,
          dateTo: range.to,
          paymentMethod: "CASH",
          perPage: 1,
        }),
        listPayments(auth, {
          dateFrom: range.from,
          dateTo: range.to,
          paymentMethod: "BANK_TRANSFER",
          perPage: 1,
        }),
        listPayments(auth, {
          dateFrom: range.from,
          dateTo: range.to,
          paymentMethod: "CREDIT_CARD",
          perPage: 1,
        }),
      ]);
      setMonthTotal(summary.currentMonthTotal);
      setMonthCount(countResult.total);
      setCashTotal(cash.summary.totalAmount);
      setTransferTotal(transfer.summary.totalAmount);
      setCardTotal(card.summary.totalAmount);
    } catch {
      setMonthTotal("0.00");
      setMonthCount(0);
      setCashTotal("0.00");
      setTransferTotal("0.00");
      setCardTotal("0.00");
    }
  }, [auth]);

  const loadDebtReminder = useCallback(async () => {
    if (!auth) {
      setIndebtedApartments(0);
      setOpenDebtTotal("0.00");
      setWhatsappConnected(false);
      return;
    }
    try {
      const [debts, whatsapp] = await Promise.all([
        listApartmentDebts(auth, { status: "OPEN", perPage: 1 }),
        getWhatsAppIntegration(auth),
      ]);
      setIndebtedApartments(debts.summary.indebtedApartmentCount);
      setOpenDebtTotal(debts.summary.totalRemainingAmount);
      setWhatsappConnected(whatsapp.integration?.connectionStatus === "CONNECTED");
    } catch {
      setIndebtedApartments(0);
      setOpenDebtTotal("0.00");
      setWhatsappConnected(false);
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
      const result = await listPayments(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
        buildingId: buildingId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        paymentMethod:
          method === "CASH" ||
          method === "BANK_TRANSFER" ||
          method === "CREDIT_CARD" ||
          method === "OTHER"
            ? method
            : undefined,
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
  }, [auth, debouncedSearch, page, buildingId, dateFrom, dateTo, method]);

  useEffect(() => {
    if (!ready) return;
    void loadBuildings();
    void loadMetrics();
    void loadDebtReminder();
  }, [ready, loadBuildings, loadMetrics, loadDebtReminder]);

  useEffect(() => {
    if (!ready) return;
    void loadList();
  }, [ready, loadList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, method, buildingId, dateFrom, dateTo]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setCollectError("");
    setCollectOpen(true);
  }

  async function handleCollectSubmit(payload: PaymentPayload, siteId: string) {
    if (!auth || collectPending) return;
    setCollectPending(true);
    setCollectError("");
    try {
      await createPayment({ ...auth, siteId }, payload, crypto.randomUUID());
      showToast("Tahsilat kaydedildi.");
      setCollectOpen(false);
      await Promise.all([loadList(), loadMetrics(), loadDebtReminder()]);
    } catch (err) {
      setCollectError(err instanceof ApiError ? err.message : "Tahsilat kaydedilemedi.");
    } finally {
      setCollectPending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !cancelling || cancelPending) return;
    setCancelPending(true);
    try {
      await cancelPayment(auth, cancelling.id);
      showToast("Tahsilat iptal edildi.");
      setCancelling(null);
      await Promise.all([loadList(), loadMetrics(), loadDebtReminder()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Tahsilat iptal edilemedi.", "error");
    } finally {
      setCancelPending(false);
    }
  }

  const empty = !loading && items.length === 0 && !error;
  const filtersIdle = !debouncedSearch && !method && !buildingId && !dateFrom && !dateTo;
  const methodOptions = useMemo(
    () => Object.entries(PAYMENT_METHOD_LABELS) as Array<[PaymentMethod, string]>,
    [],
  );
  const hasOpenDebt = indebtedApartments > 0;
  const canOpenReminder = canSendMessage && whatsappConnected && hasOpenDebt;

  return (
    <PageContainer>
      <PageHeader
        title="Tahsilatlar"
        description="Site sakinlerinden alınan ödemeleri görüntüleyin ve yeni tahsilat kaydedin."
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Tahsilat Kaydet
            </Button>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FinanceMetricCard
          label="Bu Ay Tahsil Edilen"
          value={formatMoney(monthTotal)}
          icon={Wallet}
          tone="success"
        />
        <FinanceMetricCard
          label="Tahsilat Sayısı"
          value={String(monthCount)}
          icon={Banknote}
          tone="brand"
        />
        <FinanceMetricCard
          label="Nakit Tahsilat"
          value={formatMoney(cashTotal)}
          icon={Banknote}
          tone="success"
        />
        <FinanceMetricCard
          label="Havale / EFT Tahsilatı"
          value={formatMoney(transferTotal)}
          icon={Landmark}
          tone="brand"
        />
        <FinanceMetricCard
          label="Kredi Kartı Tahsilatı"
          value={formatMoney(cardTotal)}
          icon={CreditCard}
          tone="neutral"
        />
      </div>

      <SurfaceCard className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <MessageCircle className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-section text-ink">Borç Hatırlatma</h2>
              <p className="mt-1 text-sm text-muted">
                {hasOpenDebt
                  ? `${indebtedApartments} açık borçlu daire · Toplam ${formatMoney(openDebtTotal)}`
                  : "Hatırlatma gönderilecek borç bulunmuyor."}
              </p>
              {canSendMessage && !whatsappConnected ? (
                <p className="mt-2 text-sm text-ink">
                  WhatsApp bağlantınızı yapın.{" "}
                  <Link href="/app/entegrasyonlar" className="font-medium text-brand hover:underline">
                    Entegrasyonlar
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
          {canSendMessage ? (
            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setHistoryOpen(true)}>
                Geçmiş
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={!canOpenReminder}
                onClick={() => setReminderOpen(true)}
              >
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp ile Toplu Hatırlat
              </Button>
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      <SectionCard title="Tahsilat Hareketleri">
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          <SearchInput
            placeholder="Kişi, daire veya açıklama ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">Tüm ödeme yöntemleri</option>
            {methodOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">Tüm binalar</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="Başlangıç tarihi"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="Bitiş tarihi"
            />
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        {empty ? (
          <EmptyState
            icon={Banknote}
            title="Henüz tahsilat kaydı bulunmuyor."
            description={
              filtersIdle
                ? "İlk ödemenizi kaydederek tahsilat hareketlerini takip etmeye başlayabilirsiniz."
                : "Filtrelere uygun tahsilat kaydı yok."
            }
            action={
              canCreate && filtersIdle ? (
                <Button onClick={openCreate}>Tahsilat Kaydet</Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Tarih</TH>
                    <TH>Ödeyen kişi</TH>
                    <TH>Bina / daire</TH>
                    <TH>Ödeme yöntemi</TH>
                    <TH>İlgili borç / açıklama</TH>
                    <TH className="text-right">Tutar</TH>
                    <TH>Durum</TH>
                    <TH className="text-right">İşlemler</TH>
                  </TR>
                </THead>
                <TBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <TR key={`ps-${index}`} className="hover:bg-transparent">
                          <TD colSpan={8}>
                            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                          </TD>
                        </TR>
                      ))
                    : items.map((payment) => (
                        <TR key={payment.id}>
                          <TD className="whitespace-nowrap">{formatDateTr(payment.paymentDate)}</TD>
                          <TD className="max-w-[160px] truncate">
                            {payment.person?.fullName || "—"}
                          </TD>
                          <TD>
                            <span className="block max-w-[180px] truncate">{payment.building.name}</span>
                            <span className="text-caption text-muted">
                              Daire {payment.apartment.number}
                            </span>
                          </TD>
                          <TD>
                            <Badge tone={methodTone(payment.paymentMethod)}>
                              {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                            </Badge>
                          </TD>
                          <TD className="max-w-[220px] truncate">{relatedLabel(payment)}</TD>
                          <TD className="whitespace-nowrap text-right font-medium">
                            {formatMoney(payment.amount)}
                          </TD>
                          <TD>
                            <Badge tone={statusTone(payment.status)}>
                              {PAYMENT_STATUS_LABELS[payment.status]}
                            </Badge>
                          </TD>
                          <TD className="text-right">
                            <Dropdown
                              align="right"
                              trigger={
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                                  aria-label="Tahsilat işlemleri"
                                >
                                  <MoreHorizontal className="size-4" />
                                </button>
                              }
                            >
                              <DropdownItem href={`/app/muhasebe/tahsilatlar/${payment.id}`}>
                                Tahsilatı Görüntüle
                              </DropdownItem>
                              {canCancel && payment.status === "COMPLETED" ? (
                                <DropdownItem danger onClick={() => setCancelling(payment)}>
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

      <PaymentFormModal
        open={collectOpen}
        mode="multi"
        pending={collectPending}
        error={collectError}
        onClose={() => (collectPending ? undefined : setCollectOpen(false))}
        onSubmit={handleCollectSubmit}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Tahsilat iptal edilsin mi?"
        description="Bu tahsilat iptal edildiğinde borçlara dağıtılan tutarlar geri alınacaktır."
        confirmLabel="Tahsilatı İptal Et"
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
