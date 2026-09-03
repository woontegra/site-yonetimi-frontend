"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { DuesChargeModal } from "@/components/accounting/DuesChargeModal";
import {
  DuesFormModal,
  duesFormToMultiPeriodPayload,
  duesFormToPayload,
  duesToForm,
  emptyDuesForm,
  type DuesFormValues,
} from "@/components/accounting/DuesFormModal";
import { DuesBatchPurgeModal } from "@/components/accounting/DuesBatchPurgeModal";
import { DuesPurgeModal } from "@/components/accounting/DuesPurgeModal";
import {
  DUES_ASSESSMENT_STATUS_LABELS,
  deriveDuesAssessmentStatus,
} from "@/components/accounting/dues-status";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  cancelOpenDuesDebts,
  chargeDues,
  createMultiPeriodAssessment,
  deleteDuesDefinition,
  getAssessmentBatch,
  getChargePreview,
  getDuesPurgePreview,
  listDuesDefinitions,
  purgeAssessmentBatch,
  purgeDuesAssessment,
  updateDuesDefinition,
  type AssessmentBatchResponse,
  type ChargePreview,
  type DuesDefinition,
  type DuesPurgePreview,
} from "@/lib/dues-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney, formatPeriod, formatPeriodLong, MONTH_LABELS } from "@/lib/money";

const PER_PAGE = 20;

function statusTone(status: ReturnType<typeof deriveDuesAssessmentStatus>) {
  switch (status) {
    case "DEFINED":
      return "info" as const;
    case "CHARGED":
      return "brand" as const;
    case "PARTIAL":
      return "warning" as const;
    case "COMPLETED":
      return "success" as const;
    case "OVERDUE":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function batchGroupLabel(items: DuesDefinition[]): string {
  const sorted = [...items].sort(
    (a, b) => a.periodYear * 12 + a.periodMonth - (b.periodYear * 12 + b.periodMonth),
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const sameYear = sorted.every((item) => item.periodYear === first.periodYear);
  const months = new Set(sorted.map((item) => item.periodMonth));
  if (sameYear && sorted.length === 12 && months.size === 12) {
    return `${first.periodYear} Yılı Aidatları · 12 dönem`;
  }
  if (sorted.length === 1) return first.name;
  const start = `${MONTH_LABELS[first.periodMonth - 1]} ${first.periodYear}`;
  const end = `${MONTH_LABELS[last.periodMonth - 1]} ${last.periodYear}`;
  return `${start}–${end} · ${sorted.length} dönem`;
}

type ListEntry =
  | { kind: "single"; dues: DuesDefinition }
  | { kind: "batch"; batchId: string; items: DuesDefinition[] };

function buildListEntries(items: DuesDefinition[]): ListEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.assessmentBatchId) continue;
    counts.set(item.assessmentBatchId, (counts.get(item.assessmentBatchId) ?? 0) + 1);
  }
  const seenBatches = new Set<string>();
  const entries: ListEntry[] = [];
  for (const item of items) {
    const batchId = item.assessmentBatchId;
    if (batchId && (counts.get(batchId) ?? 0) >= 2) {
      if (seenBatches.has(batchId)) continue;
      seenBatches.add(batchId);
      entries.push({
        kind: "batch",
        batchId,
        items: items
          .filter((row) => row.assessmentBatchId === batchId)
          .sort(
            (a, b) => a.periodYear * 12 + a.periodMonth - (b.periodYear * 12 + b.periodMonth),
          ),
      });
      continue;
    }
    entries.push({ kind: "single", dues: item });
  }
  return entries;
}

export function DuesListPage() {
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DuesDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DuesDefinition | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [existingDuesId, setExistingDuesId] = useState<string | null>(null);
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [deleting, setDeleting] = useState<DuesDefinition | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [chargePreview, setChargePreview] = useState<ChargePreview | null>(null);
  const [chargePending, setChargePending] = useState(false);
  const [purging, setPurging] = useState<DuesDefinition | null>(null);
  const [purgePreview, setPurgePreview] = useState<DuesPurgePreview | null>(null);
  const [purgePending, setPurgePending] = useState(false);
  const [cancelling, setCancelling] = useState<DuesDefinition | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [batchView, setBatchView] = useState<AssessmentBatchResponse | null>(null);
  const [batchPurge, setBatchPurge] = useState<AssessmentBatchResponse | null>(null);
  const [batchPurgePending, setBatchPurgePending] = useState(false);
  const createIdempotencyKey = useRef<string>(crypto.randomUUID());

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listDuesDefinitions(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, page]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const formInitialValues = useMemo(
    () => (editing ? duesToForm(editing, siteId ?? "") : emptyDuesForm(siteId ?? "")),
    [editing, siteId],
  );

  const listEntries = useMemo(() => buildListEntries(items), [items]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    createIdempotencyKey.current = crypto.randomUUID();
    setEditing(null);
    setFormError("");
    setExistingDuesId(null);
    setFormOpen(true);
  }

  async function handleSubmit(values: DuesFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    setExistingDuesId(null);
    try {
      const payload = duesFormToPayload(values);
      if (editing) {
        await updateDuesDefinition(auth, editing.id, {
          ...(editing.financialFieldsLocked
            ? {
                name: payload.name,
                description: payload.description,
              }
            : payload),
        });
        showToast("Aidat tanımı güncellendi.");
        setFormOpen(false);
        setEditing(null);
        await load();
      } else {
        if (!values.siteId) {
          setFormError("Site seçimi zorunludur.");
          setFormPending(false);
          return;
        }
        const result = await createMultiPeriodAssessment(
          { ...auth, siteId: values.siteId },
          duesFormToMultiPeriodPayload(values, {
            assessmentBatchId: createIdempotencyKey.current,
          }),
          { idempotencyKey: createIdempotencyKey.current },
        );
        showToast(
          result.createdPeriodCount > 0
            ? `${result.createdPeriodCount} dönem ve ${result.createdDebtCount} daire borcu oluşturuldu.`
            : "Borçlandırma tamamlandı.",
        );
        setFormOpen(false);
        setEditing(null);
        createIdempotencyKey.current = crypto.randomUUID();
        await load();
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "DUES_PERIOD_EXISTS") {
        const details = error.details as { existingDuesId?: string } | undefined;
        setExistingDuesId(details?.existingDuesId ?? null);
        setFormError(error.message);
      } else {
        setFormError(error instanceof ApiError ? error.message : "Kayıt kaydedilemedi.");
      }
    } finally {
      setFormPending(false);
    }
  }

  async function openBatchView(batchId: string) {
    if (!auth) return;
    try {
      const batch = await getAssessmentBatch(auth, batchId);
      setBatchView(batch);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Toplu borçlandırma alınamadı.", "error");
    }
  }

  async function openBatchPurge(batchId: string) {
    if (!auth) return;
    try {
      const batch = await getAssessmentBatch(auth, batchId);
      if (!batch.canHardDelete) {
        showToast(
          batch.blockedReason ??
            "Gruptaki en az bir döneme tahsilat uygulanmış; toplu silme yapılamaz.",
          "error",
        );
        return;
      }
      setBatchPurge(batch);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Toplu silme önizlemesi alınamadı.", "error");
    }
  }

  async function handleBatchPurge(confirmName: string) {
    if (!auth || !batchPurge || batchPurgePending) return;
    setBatchPurgePending(true);
    try {
      const result = await purgeAssessmentBatch(auth, batchPurge.assessmentBatchId, confirmName);
      showToast(
        `${result.deletedPeriodCount} dönem ve ${result.deletedDebtCount} borç kalıcı silindi.`,
      );
      setBatchPurge(null);
      setBatchView(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Toplu silme başarısız.", "error");
    } finally {
      setBatchPurgePending(false);
    }
  }

  async function openCharge(dues: DuesDefinition) {
    if (!auth) return;
    try {
      const preview = await getChargePreview(auth, dues.id);
      setChargePreview(preview);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Önizleme alınamadı.", "error");
    }
  }

  async function handleCharge() {
    if (!auth || !chargePreview || chargePending) return;
    setChargePending(true);
    try {
      const result = await chargeDues(auth, chargePreview.dues.id);
      const period = formatPeriodLong(result.dues.periodYear, result.dues.periodMonth);
      showToast(`${period} için ${result.createdCount} daire borçlandırıldı.`);
      setChargePreview(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Borçlandırma başarısız.", "error");
    } finally {
      setChargePending(false);
    }
  }

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      await deleteDuesDefinition(auth, deleting.id);
      showToast("Aidat tanımı arşivlendi. Oluşmuş daire borçları silinmedi.");
      setDeleting(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Aidat arşivlenemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  async function openPurge(dues: DuesDefinition) {
    if (!auth) return;
    try {
      const preview = await getDuesPurgePreview(auth, dues.id);
      if (!preview.canHardDelete) {
        showToast(
          preview.blockedReason ??
            "Bu aidata tahsilat işlendiği için doğrudan silinemez.",
          "error",
        );
        return;
      }
      setPurgePreview(preview);
      setPurging(dues);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Silme önizlemesi alınamadı.", "error");
    }
  }

  async function handlePurge(confirmName: string) {
    if (!auth || !purging || purgePending) return;
    setPurgePending(true);
    try {
      const result = await purgeDuesAssessment(auth, purging.id, confirmName);
      showToast(`Aidat ve ${result.deletedDebtCount} borç kalıcı silindi.`);
      setPurging(null);
      setPurgePreview(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Silme başarısız.", "error");
    } finally {
      setPurgePending(false);
    }
  }

  async function handleCancelAssessment() {
    if (!auth || !cancelling || cancelPending) return;
    setCancelPending(true);
    try {
      const result = await cancelOpenDuesDebts(auth, cancelling.id);
      showToast(`${result.cancelledCount} açık borç iptal edildi.`);
      setCancelling(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "İptal başarısız.", "error");
    } finally {
      setCancelPending(false);
    }
  }

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
        title="Aidatlar"
        description={
          site?.name
            ? `${site.name} için aidat tanımlarını ve borçlandırmaları yönetin.`
            : "Aidat tanımlarını ve borçlandırmaları yönetin."
        }
        search={
          <SearchInput
            placeholder="Aidat ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Yeni Aidat Borçlandırması
          </Button>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Aidat</TH>
              <TH>Kapsam</TH>
              <TH>Dönem</TH>
              <TH className="text-right">Daire başına</TH>
              <TH className="text-right">Borçlandırılan</TH>
              <TH className="text-right">Tahakkuk</TH>
              <TH className="text-right">Kalan</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TR key={`s-${index}`} className="hover:bg-transparent">
                    <TD colSpan={9}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}
            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={9} className="py-8 text-center text-sm text-muted">
                  Henüz aidat tanımı bulunmuyor.
                </TD>
              </TR>
            ) : null}
            {!loading
              ? listEntries.map((entry) => {
                  if (entry.kind === "batch") {
                    const expanded = expandedBatches[entry.batchId] ?? false;
                    const totalOriginal = entry.items.reduce(
                      (sum, item) => sum + Number(item.totalOriginalAmount ?? 0),
                      0,
                    );
                    const totalRemaining = entry.items.reduce(
                      (sum, item) => sum + Number(item.totalRemainingAmount ?? 0),
                      0,
                    );
                    const charged = entry.items.reduce(
                      (sum, item) => sum + (item.chargedApartmentCount ?? 0),
                      0,
                    );
                    return (
                      <BatchGroupRows
                        key={`batch-${entry.batchId}`}
                        batchId={entry.batchId}
                        items={entry.items}
                        expanded={expanded}
                        totalOriginal={totalOriginal}
                        totalRemaining={totalRemaining}
                        charged={charged}
                        onToggle={() =>
                          setExpandedBatches((current) => ({
                            ...current,
                            [entry.batchId]: !expanded,
                          }))
                        }
                        onViewBatch={() => void openBatchView(entry.batchId)}
                        onPurgeBatch={() => void openBatchPurge(entry.batchId)}
                        onEdit={(dues) => {
                          setEditing(dues);
                          setFormError("");
                          setFormOpen(true);
                        }}
                        onCharge={(dues) => void openCharge(dues)}
                        onPurge={(dues) => void openPurge(dues)}
                        onCancel={(dues) => setCancelling(dues)}
                        onArchive={(dues) => setDeleting(dues)}
                        onCollectionsBlocked={() =>
                          showToast(
                            "Bu aidata tahsilat işlendiği için doğrudan silinemez. Önce bağlı tahsilatları inceleyin veya borçlandırmayı güvenli iptal akışıyla geri alın.",
                            "error",
                          )
                        }
                      />
                    );
                  }
                  return (
                    <DuesListRow
                      key={entry.dues.id}
                      dues={entry.dues}
                      onEdit={() => {
                        setEditing(entry.dues);
                        setFormError("");
                        setFormOpen(true);
                      }}
                      onCharge={() => void openCharge(entry.dues)}
                      onPurge={() => void openPurge(entry.dues)}
                      onCancel={() => setCancelling(entry.dues)}
                      onArchive={() => setDeleting(entry.dues)}
                      onCollectionsBlocked={() =>
                        showToast(
                          "Bu aidata tahsilat işlendiği için doğrudan silinemez. Önce bağlı tahsilatları inceleyin veya borçlandırmayı güvenli iptal akışıyla geri alın.",
                          "error",
                        )
                      }
                      onViewBatch={
                        entry.dues.assessmentBatchId
                          ? () => void openBatchView(entry.dues.assessmentBatchId!)
                          : undefined
                      }
                    />
                  );
                })
              : null}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <DuesFormModal
        key={editing?.id ?? "create-dues"}
        open={formOpen}
        title={editing ? "Aidatı Düzenle" : "Aidat Borçlandırması Oluştur"}
        initialValues={formInitialValues}
        pending={formPending}
        error={formError}
        financialFieldsLocked={Boolean(editing?.financialFieldsLocked)}
        existingDuesId={existingDuesId}
        assessmentBatchId={editing ? null : createIdempotencyKey.current}
        onClose={() => {
          if (!formPending) setFormOpen(false);
        }}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Aidat tanımı arşivlensin mi?"
        description="Arşivlemek mevcut daire borçlarını silmez. Kalan tutar ve tahsilatlar korunur; kayıt yalnızca aktif listeden kaldırılır."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Borçlandırma iptal edilsin mi?"
        description={
          cancelling?.hasCollections
            ? "Bu aidata tahsilat işlendiği için doğrudan silinemez. Yalnızca ödemesiz açık borçlar iptal edilir; tahsilatlı borçlar korunur."
            : "Ödemesiz açık daire borçları iptal edilecek. Aidat tanımı arşivlenmez."
        }
        confirmLabel="Borçlandırmayı İptal Et"
        cancelLabel="Vazgeç"
        danger
        pending={cancelPending}
        onConfirm={() => void handleCancelAssessment()}
        onClose={() => (cancelPending ? undefined : setCancelling(null))}
      />

      <DuesPurgeModal
        open={Boolean(purging)}
        dues={purging}
        preview={purgePreview}
        pending={purgePending}
        onClose={() => {
          if (purgePending) return;
          setPurging(null);
          setPurgePreview(null);
        }}
        onConfirm={(name) => void handlePurge(name)}
      />

      <DuesBatchPurgeModal
        open={Boolean(batchPurge)}
        batch={batchPurge}
        pending={batchPurgePending}
        onClose={() => {
          if (!batchPurgePending) setBatchPurge(null);
        }}
        onConfirm={(name) => void handleBatchPurge(name)}
      />

      <ConfirmDialog
        open={Boolean(batchView)}
        title="Toplu borçlandırma"
        description={
          batchView
            ? `${batchGroupLabel(batchView.items)}. ${batchView.periodCount} dönem · ${
                batchView.canHardDelete
                  ? "Tahsilatsız; toplu silinebilir."
                  : batchView.blockedReason ?? "Toplu silme engelli."
              }`
            : ""
        }
        confirmLabel={batchView?.canHardDelete ? "Toplu Sil…" : "Kapat"}
        cancelLabel="Kapat"
        danger={Boolean(batchView?.canHardDelete)}
        pending={false}
        onConfirm={() => {
          if (batchView?.canHardDelete) {
            setBatchPurge(batchView);
            setBatchView(null);
          } else {
            setBatchView(null);
          }
        }}
        onClose={() => setBatchView(null)}
      />

      <DuesChargeModal
        preview={chargePreview}
        pending={chargePending}
        onClose={() => setChargePreview(null)}
        onConfirm={() => void handleCharge()}
      />
    </PageContainer>
  );
}

function BatchGroupRows({
  batchId,
  items,
  expanded,
  totalOriginal,
  totalRemaining,
  charged,
  onToggle,
  onViewBatch,
  onPurgeBatch,
  onEdit,
  onCharge,
  onPurge,
  onCancel,
  onArchive,
  onCollectionsBlocked,
}: {
  batchId: string;
  items: DuesDefinition[];
  expanded: boolean;
  totalOriginal: number;
  totalRemaining: number;
  charged: number;
  onToggle: () => void;
  onViewBatch: () => void;
  onPurgeBatch: () => void;
  onEdit: (dues: DuesDefinition) => void;
  onCharge: (dues: DuesDefinition) => void;
  onPurge: (dues: DuesDefinition) => void;
  onCancel: (dues: DuesDefinition) => void;
  onArchive: (dues: DuesDefinition) => void;
  onCollectionsBlocked: () => void;
}) {
  return (
    <>
      <TR className="bg-canvas/60">
        <TD className="font-medium" colSpan={3}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-left hover:text-accent"
            onClick={onToggle}
          >
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            )}
            <span>{batchGroupLabel(items)}</span>
          </button>
          <p className="mt-0.5 pl-5 text-xs text-muted">
            Toplu borçlandırma · {items[0]?.building.name}
          </p>
        </TD>
        <TD className="text-right">{formatMoney(items[0]?.amount ?? "0")}</TD>
        <TD className="text-right">{charged} borç</TD>
        <TD className="text-right">{formatMoney(totalOriginal)}</TD>
        <TD className="text-right">{formatMoney(totalRemaining)}</TD>
        <TD>
          <Badge tone="brand">{items.length} dönem</Badge>
        </TD>
        <TD className="text-right">
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                aria-label="Toplu borçlandırma işlemleri"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          >
            <DropdownItem onClick={onViewBatch}>Toplu Borçlandırmayı Gör</DropdownItem>
            <DropdownItem danger onClick={onPurgeBatch}>
              Toplu Borçlandırmayı Sil
            </DropdownItem>
          </Dropdown>
        </TD>
      </TR>
      {expanded
        ? items.map((dues) => (
            <DuesListRow
              key={`${batchId}-${dues.id}`}
              dues={dues}
              nested
              onEdit={() => onEdit(dues)}
              onCharge={() => onCharge(dues)}
              onPurge={() => onPurge(dues)}
              onCancel={() => onCancel(dues)}
              onArchive={() => onArchive(dues)}
              onCollectionsBlocked={onCollectionsBlocked}
            />
          ))
        : null}
    </>
  );
}

function DuesListRow({
  dues,
  nested,
  onEdit,
  onCharge,
  onPurge,
  onCancel,
  onArchive,
  onCollectionsBlocked,
  onViewBatch,
}: {
  dues: DuesDefinition;
  nested?: boolean;
  onEdit: () => void;
  onCharge: () => void;
  onPurge: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onCollectionsBlocked: () => void;
  onViewBatch?: () => void;
}) {
  const status = deriveDuesAssessmentStatus(dues);
  const collected =
    Number(dues.totalOriginalAmount ?? 0) - Number(dues.totalRemainingAmount ?? 0);
  return (
    <TR className={nested ? "bg-surface/40" : undefined}>
      <TD className={`font-medium ${nested ? "pl-8" : ""}`}>
        <Link href={`/app/muhasebe/aidatlar/${dues.id}`} className="hover:text-accent">
          {dues.name}
        </Link>
        <p className="text-xs text-muted">Son ödeme {formatDateTr(dues.dueDate)}</p>
      </TD>
      <TD>{dues.building.name}</TD>
      <TD>{formatPeriod(dues.periodYear, dues.periodMonth)}</TD>
      <TD className="text-right">{formatMoney(dues.amount)}</TD>
      <TD className="text-right">{dues.chargedApartmentCount} daire</TD>
      <TD className="text-right">{formatMoney(dues.totalOriginalAmount ?? "0")}</TD>
      <TD className="text-right">
        {dues.chargedApartmentCount > 0 ? formatMoney(dues.totalRemainingAmount ?? "0") : "—"}
        {dues.chargedApartmentCount > 0 && collected > 0 ? (
          <p className="text-xs text-muted">Tahsil {formatMoney(collected)}</p>
        ) : null}
      </TD>
      <TD>
        <Badge tone={statusTone(status)}>{DUES_ASSESSMENT_STATUS_LABELS[status]}</Badge>
      </TD>
      <TD className="text-right">
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
              aria-label="Aidat işlemleri"
            >
              <MoreHorizontal className="size-4" />
            </button>
          }
        >
          <DropdownItem href={`/app/muhasebe/aidatlar/${dues.id}`}>Detayı Gör</DropdownItem>
          <DropdownItem href="/app/muhasebe/borclar">Borçları Gör</DropdownItem>
          {onViewBatch ? (
            <DropdownItem onClick={onViewBatch}>Toplu Borçlandırmayı Gör</DropdownItem>
          ) : null}
          <DropdownItem onClick={onEdit}>Düzenle</DropdownItem>
          {dues.canChargeMore ? (
            <DropdownItem onClick={onCharge}>Dairelere Borçlandır</DropdownItem>
          ) : (dues.chargedApartmentCount ?? 0) > 0 ? (
            <DropdownItem disabled>Zaten borçlandırıldı</DropdownItem>
          ) : null}
          {dues.canHardDelete !== false ? (
            <DropdownItem danger onClick={onPurge}>
              Aidat Borçlandırmasını Sil
            </DropdownItem>
          ) : dues.canSafeCancel ? (
            <DropdownItem danger onClick={onCancel}>
              Borçlandırmayı İptal Et
            </DropdownItem>
          ) : dues.hasCollections ? (
            <DropdownItem danger onClick={onCollectionsBlocked}>
              Borçlandırmayı İptal Et
            </DropdownItem>
          ) : null}
          <DropdownItem danger onClick={onArchive}>
            Arşivle
          </DropdownItem>
        </Dropdown>
      </TD>
    </TR>
  );
}
