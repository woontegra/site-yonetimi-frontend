"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminLicenseRequestsPanel } from "@/components/admin/AdminLicenseRequestsPanel";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { StatCard } from "@/components/ui/SurfaceCard";
import { useToast } from "@/components/ui/Toast";
import { PLAN_LABELS, SUB_STATUS_LABELS, remainingLabel, subscriptionTone } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  cancelAdminSubscription,
  convertAdminAnnual,
  extendAdminDemo,
  getAdminSubscriptionSummary,
  listAdminSubscriptions,
  reactivateAdminSubscription,
  renewAdminAnnual,
  suspendAdminSubscription,
  type AdminSubscriptionListItem,
  type AdminSubscriptionSummary,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";
import { invalidateMyLicenseCache } from "@/lib/subscription-api";
import {
  previewAddCalendarDaysEndOfDay,
  previewExtendBaseIso,
  previewRemainingCalendarDays,
} from "@/lib/license-dates";
import { cn } from "@/lib/cn";

const PER_PAGE = 20;
const ANNUAL_NET = 4000;
const ANNUAL_VAT_RATE = 20;

type FilterKey =
  | ""
  | "demo"
  | "annual"
  | "active"
  | "expiring"
  | "expired"
  | "suspended"
  | "cancelled"
  | "none";

type PendingAction =
  | { type: "extend"; tenantId: string; days: number; endsAt: string; orgName: string; remainingDays: number }
  | { type: "extendCustom"; tenantId: string; endsAt: string; orgName: string; remainingDays: number }
  | { type: "convert"; tenantId: string; orgName: string }
  | { type: "renew"; tenantId: string; orgName: string }
  | { type: "suspend"; tenantId: string; orgName: string }
  | { type: "reactivate"; tenantId: string; orgName: string }
  | { type: "cancel"; tenantId: string; orgName: string };

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "", label: "Tümü" },
  { key: "demo", label: "Demo" },
  { key: "annual", label: "Yıllık" },
  { key: "active", label: "Aktif" },
  { key: "expiring", label: "Yaklaşan" },
  { key: "expired", label: "Süresi dolmuş" },
  { key: "suspended", label: "Askıda" },
  { key: "cancelled", label: "İptal" },
  { key: "none", label: "Lisanssız" },
];

function filterParams(filter: FilterKey): { status?: string; plan?: string; filter?: string } {
  if (filter === "demo") return { plan: "DEMO" };
  if (filter === "annual") return { plan: "ANNUAL" };
  if (filter === "active") return { status: "ACTIVE" };
  if (filter === "expired") return { status: "EXPIRED" };
  if (filter === "suspended") return { status: "SUSPENDED" };
  if (filter === "cancelled") return { status: "CANCELLED" };
  if (filter === "expiring") return { filter: "expiring" };
  if (filter === "none") return { filter: "none" };
  return {};
}

export function AdminSubscriptionsPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const { showToast, toastError } = useToast();
  const initialTab = searchParams.get("tab") === "requests" ? "requests" : "licenses";
  const [tab, setTab] = useState<"licenses" | "requests">(initialTab);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>((searchParams.get("filter") as FilterKey) || "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminSubscriptionListItem[]>([]);
  const [summary, setSummary] = useState<AdminSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [customDays, setCustomDays] = useState("14");
  const [paymentNote, setPaymentNote] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const loadSummary = useCallback(async () => {
    if (!auth) return;
    try {
      setSummary(await getAdminSubscriptionSummary(auth));
    } catch {
      setSummary(null);
    }
  }, [auth]);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminSubscriptions(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        ...filterParams(filter),
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Abonelikler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, filter]);

  useEffect(() => setPage(1), [debouncedSearch, filter]);
  useEffect(() => {
    if (!ready) return;
    void load();
    void loadSummary();
  }, [ready, load, loadSummary]);

  function openAction(next: PendingAction) {
    setAction(next);
    setReason("");
    setPaymentNote("");
    if (next.type === "extendCustom") setCustomDays("14");
  }

  async function confirmAction() {
    if (!auth || !action) return;
    if (reason.trim().length < 5) {
      showToast("Gerekçe en az 5 karakter olmalıdır.", "error");
      return;
    }
    setPending(true);
    try {
      const r = reason.trim();
      if (action.type === "extend") {
        await extendAdminDemo(auth, action.tenantId, { days: action.days, reason: r });
        const base = previewExtendBaseIso(action.endsAt);
        const nextEnds = previewAddCalendarDaysEndOfDay(base, action.days);
        showToast(
          `Demo süresine ${action.days} gün eklendi. Yeni bitiş tarihi: ${formatDateTr(nextEnds.toISOString())}.`,
        );
      } else if (action.type === "extendCustom") {
        const days = Number(customDays);
        if (!Number.isInteger(days) || days < 1) {
          showToast("Geçerli bir gün sayısı girin.", "error");
          setPending(false);
          return;
        }
        await extendAdminDemo(auth, action.tenantId, { days, reason: r });
        const base = previewExtendBaseIso(action.endsAt);
        const nextEnds = previewAddCalendarDaysEndOfDay(base, days);
        showToast(`Demo süresine ${days} gün eklendi. Yeni bitiş tarihi: ${formatDateTr(nextEnds.toISOString())}.`);
      } else if (action.type === "convert") {
        await convertAdminAnnual(auth, action.tenantId, {
          reason: r,
          netPrice: ANNUAL_NET,
          paymentNote: paymentNote.trim() || undefined,
        });
        showToast("Yıllık lisansa dönüştürüldü.");
      } else if (action.type === "renew") {
        await renewAdminAnnual(auth, action.tenantId, {
          reason: r,
          paymentNote: paymentNote.trim() || undefined,
        });
        showToast("Yıllık lisans 365 gün yenilendi.");
      } else if (action.type === "suspend") {
        await suspendAdminSubscription(auth, action.tenantId, r);
        showToast("Abonelik askıya alındı.");
      } else if (action.type === "reactivate") {
        await reactivateAdminSubscription(auth, action.tenantId, r);
        showToast("Abonelik yeniden etkinleştirildi.");
      } else {
        await cancelAdminSubscription(auth, action.tenantId, r);
        showToast("Abonelik iptal edildi.");
      }
      invalidateMyLicenseCache(action.tenantId);
      setAction(null);
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      toastError(err, "Lisans güncellenemedi.");
    } finally {
      setPending(false);
    }
  }

  const actionTitle =
    action?.type === "extend"
      ? `+${action.days} gün uzat`
      : action?.type === "extendCustom"
        ? "Özel gün uzat"
        : action?.type === "convert"
          ? "Yıllığa dönüştür"
          : action?.type === "renew"
            ? "365 gün yenile"
            : action?.type === "suspend"
              ? "Askıya al"
              : action?.type === "reactivate"
                ? "Yeniden etkinleştir"
                : action?.type === "cancel"
                  ? "İptal et"
                  : "";

  const grossPreview = ANNUAL_NET * (1 + ANNUAL_VAT_RATE / 100);

  return (
    <PageContainer>
      <PageHeader
        title="Lisans Yönetimi"
        description="Organizasyon düzeyinde Demo ve Yıllık lisans işlemleri."
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-line pb-px">
        <button
          type="button"
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
            tab === "licenses"
              ? "border-accent text-ink"
              : "border-transparent text-muted hover:text-ink",
          )}
          onClick={() => setTab("licenses")}
        >
          Lisanslar
        </button>
        <button
          type="button"
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
            tab === "requests"
              ? "border-accent text-ink"
              : "border-transparent text-muted hover:text-ink",
          )}
          onClick={() => setTab("requests")}
        >
          Lisans Talepleri
        </button>
      </div>

      {tab === "requests" ? <AdminLicenseRequestsPanel /> : null}

      {tab === "licenses" ? (
        <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Organizasyon adı" className="max-w-xs" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} className="w-44">
          {FILTERS.map((item) => (
            <option key={item.key || "all"} value={item.key}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Demo" value={String(summary?.demo ?? summary?.demoActive ?? "—")} />
        <StatCard label="Yıllık" value={String(summary?.annual ?? summary?.annualActive ?? "—")} />
        <StatCard label="Aktif" value={String(summary?.active ?? "—")} />
        <StatCard label="Yaklaşan" value={String(summary?.expiring ?? "—")} />
        <StatCard label="Süresi dolmuş" value={String(summary?.expired ?? "—")} />
        <StatCard label="Askıda" value={String(summary?.suspended ?? "—")} />
        <StatCard label="İptal" value={String(summary?.cancelled ?? "—")} />
        <StatCard label="Lisanssız" value={String(summary?.none ?? "—")} />
      </div>

      {error ? <p className="mb-3 text-[12px] text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Organizasyon</TH>
              <TH>Plan</TH>
              <TH>Durum</TH>
              <TH>Başlangıç</TH>
              <TH>Bitiş</TH>
              <TH>Kalan</TH>
              <TH>Fiyat</TH>
              <TH>İşlem</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={8} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={8} className="p-0"><TableEmptyState title="Abonelik bulunamadı." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="font-medium hover:text-accent">
                      {item.tenant.name}
                    </Link>
                    {item.readOnly ? <p className="text-caption text-muted">Salt okunur</p> : null}
                  </TD>
                  <TD>{PLAN_LABELS[item.plan] ?? item.plan}</TD>
                  <TD>
                    <StatusBadge
                      label={SUB_STATUS_LABELS[item.status] ?? item.status}
                      tone={subscriptionTone(item.status, item.plan)}
                    />
                    {remainingLabel(item) ? <p className="mt-1 text-caption text-muted">{remainingLabel(item)}</p> : null}
                  </TD>
                  <TD>{formatDateTr(item.startsAt)}</TD>
                  <TD>{formatDateTr(item.endsAt)}</TD>
                  <TD>{item.remainingDays}</TD>
                  <TD>
                    {item.plan === "ANNUAL" && item.grossPrice != null
                      ? formatMoney(item.grossPrice)
                      : item.plan === "ANNUAL" && item.netPrice != null
                        ? formatMoney(item.netPrice)
                        : "—"}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          openAction({
                            type: "extend",
                            tenantId: item.tenant.id,
                            days: 3,
                            endsAt: item.endsAt,
                            orgName: item.tenant.name,
                            remainingDays: item.remainingDays,
                          })
                        }
                      >
                        +3
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          openAction({
                            type: "extend",
                            tenantId: item.tenant.id,
                            days: 7,
                            endsAt: item.endsAt,
                            orgName: item.tenant.name,
                            remainingDays: item.remainingDays,
                          })
                        }
                      >
                        +7
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          openAction({
                            type: "extendCustom",
                            tenantId: item.tenant.id,
                            endsAt: item.endsAt,
                            orgName: item.tenant.name,
                            remainingDays: item.remainingDays,
                          })
                        }
                      >
                        Özel
                      </Button>
                      {item.plan !== "ANNUAL" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            openAction({ type: "convert", tenantId: item.tenant.id, orgName: item.tenant.name })
                          }
                        >
                          Yıllık
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            openAction({ type: "renew", tenantId: item.tenant.id, orgName: item.tenant.name })
                          }
                        >
                          Yenile
                        </Button>
                      )}
                      {item.status === "SUSPENDED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            openAction({ type: "reactivate", tenantId: item.tenant.id, orgName: item.tenant.name })
                          }
                        >
                          Aktif et
                        </Button>
                      ) : item.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            openAction({ type: "suspend", tenantId: item.tenant.id, orgName: item.tenant.name })
                          }
                        >
                          Askıya al
                        </Button>
                      ) : null}
                      {item.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            openAction({ type: "cancel", tenantId: item.tenant.id, orgName: item.tenant.name })
                          }
                        >
                          İptal
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <Modal
        open={Boolean(action)}
        title={actionTitle}
        description="Değişiklik denetim kaydına yazılır. Gerekçe zorunludur."
        onClose={() => (pending ? undefined : setAction(null))}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setAction(null)}>Vazgeç</Button>
            <Button disabled={pending} onClick={() => void confirmAction()}>
              {pending ? "Kaydediliyor…" : "Onayla"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {action && "orgName" in action ? (
            <p className="rounded-md border border-line bg-canvas/50 px-3 py-2 text-[12px] text-ink">
              <span className="font-medium">{action.orgName}</span>
              {action.type === "extend" || action.type === "extendCustom" ? (
                <>
                  <br />
                  Mevcut bitiş: {formatDateTr(action.endsAt)} · Kalan: {Math.max(0, action.remainingDays)} gün
                  <br />
                  Eklenecek:{" "}
                  {action.type === "extend"
                    ? `${action.days} gün`
                    : `${Number(customDays) || "—"} gün`}
                  {(action.type === "extend" ||
                    (action.type === "extendCustom" && Number.isFinite(Number(customDays)) && Number(customDays) > 0)) && (
                    <>
                      <br />
                      Yeni bitiş:{" "}
                      {formatDateTr(
                        previewAddCalendarDaysEndOfDay(
                          previewExtendBaseIso(action.endsAt),
                          action.type === "extend" ? action.days : Number(customDays),
                        ).toISOString(),
                      )}{" "}
                      · Yeni kalan:{" "}
                      {Math.max(
                        0,
                        previewRemainingCalendarDays(
                          previewAddCalendarDaysEndOfDay(
                            previewExtendBaseIso(action.endsAt),
                            action.type === "extend" ? action.days : Number(customDays),
                          ),
                        ),
                      )}{" "}
                      gün
                    </>
                  )}
                </>
              ) : null}
            </p>
          ) : null}
          {action?.type === "extendCustom" ? (
            <FormField label="Gün sayısı" required>
              <Input type="number" min={1} max={365} value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
            </FormField>
          ) : null}
          {action?.type === "convert" ? (
            <p className="rounded-md border border-line bg-canvas/50 px-3 py-2 text-[12px] text-muted">
              Varsayılan fiyat: {formatMoney(ANNUAL_NET)} net + %{ANNUAL_VAT_RATE} KDV = {formatMoney(grossPreview)}
            </p>
          ) : null}
          {action?.type === "convert" || action?.type === "renew" ? (
            <FormField label="Ödeme notu" hint="İsteğe bağlı">
              <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Havale ref / fatura no" />
            </FormField>
          ) : null}
          <FormField label="Gerekçe" required hint="Örn. Müşteri talebiyle demo 7 gün uzatıldı.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} data-modal-autofocus />
          </FormField>
        </div>
      </Modal>
        </>
      ) : null}
    </PageContainer>
  );
}
