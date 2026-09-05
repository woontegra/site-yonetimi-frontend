"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Textarea } from "@/components/ui/Textarea";
import { StatCard } from "@/components/ui/SurfaceCard";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  approveAdminLicenseRequest,
  cancelAdminLicenseRequest,
  contactAdminLicenseRequest,
  getAdminLicenseRequest,
  listAdminLicenseRequests,
  rejectAdminLicenseRequest,
  type AdminLicenseRequest,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";
import { invalidateMyLicenseCache } from "@/lib/subscription-api";
import { PLAN_LABELS } from "@/components/admin/labels";

const PER_PAGE = 20;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekleyen",
  CONTACTED: "İletişime geçilen",
  APPROVED: "Onaylanan",
  REJECTED: "Reddedilen",
  CANCELLED: "İptal",
};

type ActionKind = "contact" | "approve" | "reject" | "cancel";

export function AdminLicenseRequestsPanel() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const { showToast, toastError } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "open");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminLicenseRequest[]>([]);
  const [summary, setSummary] = useState({
    pending: 0,
    contacted: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("requestId"));
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAdminLicenseRequest>> | null>(null);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminLicenseRequests(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        status: status || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Talepler yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, status]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!auth || !selectedId) {
      setDetail(null);
      return;
    }
    void getAdminLicenseRequest(auth, selectedId)
      .then(setDetail)
      .catch((err) => toastError(err, "Talep detayı alınamadı."));
  }, [auth, selectedId, toastError]);

  async function runAction() {
    if (!auth || !selectedId || !action) return;
    if ((action === "approve" || action === "reject" || action === "cancel") && reason.trim().length < 3) {
      toastError("Gerekçe en az 3 karakter olmalıdır.");
      return;
    }
    setPending(true);
    try {
      if (action === "contact") {
        await contactAdminLicenseRequest(auth, selectedId, { adminNote: reason.trim() || undefined });
        showToast("İletişim durumu güncellendi.");
      } else if (action === "approve") {
        const result = await approveAdminLicenseRequest(auth, selectedId, { reason: reason.trim() });
        invalidateMyLicenseCache(result.request.tenantId);
        showToast("Yıllık lisans etkinleştirildi.");
      } else if (action === "reject") {
        await rejectAdminLicenseRequest(auth, selectedId, reason.trim());
        showToast("Talep reddedildi.");
      } else {
        await cancelAdminLicenseRequest(auth, selectedId, reason.trim());
        showToast("Talep iptal edildi.");
      }
      setAction(null);
      setReason("");
      const refreshed = await getAdminLicenseRequest(auth, selectedId);
      setDetail(refreshed);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setPending(false);
    }
  }

  const open = detail?.request;
  const canAct = open && (open.status === "PENDING" || open.status === "CONTACTED");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Bekleyen" value={String(summary.pending)} />
        <StatCard label="İletişime geçilen" value={String(summary.contacted)} />
        <StatCard label="Onaylanan" value={String(summary.approved)} />
        <StatCard label="Reddedilen" value={String(summary.rejected)} />
        <StatCard label="İptal" value={String(summary.cancelled)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Organizasyon veya yetkili ara"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-[180px]"
        >
          <option value="open">Açık talepler</option>
          <option value="">Tümü</option>
          <option value="PENDING">Bekleyen</option>
          <option value="CONTACTED">İletişime geçilen</option>
          <option value="APPROVED">Onaylanan</option>
          <option value="REJECTED">Reddedilen</option>
          <option value="CANCELLED">İptal</option>
        </Select>
      </div>

      {error ? <p className="text-[12px] text-rose-700">{error}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Tarih</TH>
              <TH>Organizasyon</TH>
              <TH>Yetkili</TH>
              <TH>Mevcut lisans</TH>
              <TH>Fiyat</TH>
              <TH>Durum</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {!loading && items.length === 0 ? (
              <TR>
                <TD colSpan={7} className="p-0">
                  <TableEmptyState title="Talep yok" description="Filtreye uygun yıllık lisans talebi bulunamadı." />
                </TD>
              </TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD className="whitespace-nowrap text-[12px]">{formatDateTr(item.createdAt)}</TD>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.tenantId}`} className="text-[12px] font-medium text-accent hover:underline">
                      {item.organizationName}
                    </Link>
                  </TD>
                  <TD>
                    <div className="text-[12px] text-ink">{item.requesterName}</div>
                    <div className="text-[11px] text-muted">{item.requesterEmail}</div>
                  </TD>
                  <TD className="text-[12px]">
                    {item.currentPlan ? PLAN_LABELS[item.currentPlan as "DEMO" | "ANNUAL"] ?? item.currentPlan : "—"}
                    {item.currentEndsAt ? (
                      <div className="text-[11px] text-muted">Bitiş {formatDateTr(item.currentEndsAt)}</div>
                    ) : null}
                  </TD>
                  <TD className="text-[12px]">{formatMoney(item.grossPrice)}</TD>
                  <TD>
                    <Badge
                      tone={
                        item.status === "APPROVED"
                          ? "success"
                          : item.status === "PENDING" || item.status === "CONTACTED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </TD>
                  <TD>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedId(item.id)}>
                      Detay
                    </Button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>

      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <Modal
        open={Boolean(selectedId)}
        onClose={() => {
          if (pending) return;
          setSelectedId(null);
          setAction(null);
          setReason("");
        }}
        title="Lisans talebi"
        description={open ? `No: ${open.id}` : undefined}
        size="lg"
        footer={
          canAct ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAction("contact")}>
                İletişime geçildi
              </Button>
              <Button size="sm" disabled={pending} onClick={() => setAction("approve")}>
                Yıllık lisansı etkinleştir
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAction("reject")}>
                Reddet
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAction("cancel")}>
                İptal
              </Button>
            </div>
          ) : undefined
        }
      >
        {open ? (
          <div className="space-y-3 text-[12px]">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Organizasyon</dt>
                <dd className="font-medium text-ink">{open.organizationName}</dd>
              </div>
              <div>
                <dt className="text-muted">Yetkili</dt>
                <dd className="font-medium text-ink">
                  {open.requesterName}
                  <div className="font-normal text-muted">{open.requesterEmail}</div>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Talep edilen</dt>
                <dd className="font-medium text-ink">Yıllık Lisans</dd>
              </div>
              <div>
                <dt className="text-muted">Fiyat</dt>
                <dd className="font-medium text-ink">
                  {formatMoney(open.netPrice)} + KDV = {formatMoney(open.grossPrice)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Durum</dt>
                <dd className="font-medium text-ink">{STATUS_LABELS[open.status]}</dd>
              </div>
              <div>
                <dt className="text-muted">Mevcut bitiş</dt>
                <dd className="font-medium text-ink">
                  {open.currentEndsAt ? formatDateTr(open.currentEndsAt) : "—"}
                </dd>
              </div>
            </dl>
            {open.note ? (
              <p className="rounded-md border border-line bg-canvas/60 px-3 py-2 text-ink">
                <span className="text-muted">Not: </span>
                {open.note}
              </p>
            ) : null}
            {detail?.conversionPreview ? (
              <div className="rounded-md border border-teal-200/70 bg-teal-50/40 px-3 py-2">
                <p className="font-medium text-ink">Dönüşüm önizlemesi</p>
                <p className="mt-1 text-muted">
                  Yeni bitiş: {formatDateTr(detail.conversionPreview.projectedEndsAt)}
                  {detail.conversionPreview.remainingDemoDaysPreserved
                    ? " · Kalan demo günleri korunur"
                    : ""}
                </p>
                <p className="mt-1 text-muted">
                  Snapshot: {formatMoney(detail.conversionPreview.price.netPrice)} + KDV ={" "}
                  {formatMoney(detail.conversionPreview.price.grossPrice)}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] text-muted">Yükleniyor…</p>
        )}
      </Modal>

      <Modal
        open={Boolean(action)}
        onClose={() => (!pending ? setAction(null) : undefined)}
        title={
          action === "approve"
            ? "Yıllık lisansı etkinleştir"
            : action === "contact"
              ? "İletişime geçildi"
              : action === "reject"
                ? "Talebi reddet"
                : "Talebi iptal et"
        }
        description={
          action === "approve"
            ? "Mevcut lisans servisi ile yıllık lisansa dönüştürülür. Talep otomatik APPROVED olur."
            : undefined
        }
        variant="confirm"
        footer={
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAction(null)}>
              Vazgeç
            </Button>
            <Button size="sm" disabled={pending} onClick={() => void runAction()}>
              {pending ? "İşleniyor…" : "Onayla"}
            </Button>
          </div>
        }
      >
        <FormField
          label={action === "contact" ? "Not (isteğe bağlı)" : "Gerekçe"}
          required={action !== "contact"}
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} data-modal-autofocus />
        </FormField>
      </Modal>
    </div>
  );
}
