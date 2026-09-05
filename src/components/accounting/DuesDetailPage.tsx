"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  CircleDollarSign,
  DoorOpen,
  Receipt,
  Wallet,
} from "lucide-react";
import { DuesChargeModal } from "@/components/accounting/DuesChargeModal";
import {
  DuesFormModal,
  duesFormToPayload,
  duesToForm,
  type DuesFormValues,
} from "@/components/accounting/DuesFormModal";
import {
  DUES_ASSESSMENT_STATUS_LABELS,
  deriveDuesAssessmentStatus,
} from "@/components/accounting/dues-status";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import {
  listApartmentDebts,
  type ApartmentDebt,
  type DebtStatus,
} from "@/lib/debts-api";
import {
  cancelOpenDuesDebts,
  chargeDues,
  getChargePreview,
  getDuesDefinition,
  updateDuesDefinition,
  type ChargePreview,
  type DuesDefinition,
} from "@/lib/dues-api";
import { ApiError } from "@/lib/http";
import {
  DEBT_STATUS_LABELS,
  formatDateTr,
  formatMoney,
  formatPeriodLong,
} from "@/lib/money";

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

export function DuesDetailPage() {
  const params = useParams<{ id: string }>();
  const duesId = String(params.id);
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();

  const [dues, setDues] = useState<DuesDefinition | null>(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [chargePreview, setChargePreview] = useState<ChargePreview | null>(null);
  const [chargePending, setChargePending] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkCancelPending, setBulkCancelPending] = useState(false);

  const [debts, setDebts] = useState<ApartmentDebt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtSearch, setDebtSearch] = useState("");
  const debouncedDebtSearch = useDebouncedValue(debtSearch, 300);
  const [debtStatus, setDebtStatus] = useState<"hepsi" | DebtStatus>("hepsi");

  const load = useCallback(async () => {
    if (!auth || !duesId) return;
    setError("");
    try {
      const result = await getDuesDefinition(auth, duesId);
      setDues(result.dues);
    } catch (err) {
      setDues(null);
      setError(err instanceof ApiError ? err.message : "Aidat yüklenemedi.");
    }
  }, [auth, duesId]);

  const loadDebts = useCallback(async () => {
    if (!auth || !duesId) return;
    setDebtsLoading(true);
    try {
      const result = await listApartmentDebts(auth, {
        duesDefinitionId: duesId,
        search: debouncedDebtSearch.trim() || undefined,
        status: debtStatus === "hepsi" ? undefined : debtStatus,
        perPage: 100,
      });
      setDebts(result.items);
    } catch {
      setDebts([]);
    } finally {
      setDebtsLoading(false);
    }
  }, [auth, duesId, debouncedDebtSearch, debtStatus]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !dues) return;
    void loadDebts();
  }, [ready, dues, loadDebts]);

  async function handleSubmit(values: DuesFormValues) {
    if (!auth || !dues || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const result = await updateDuesDefinition(auth, dues.id, duesFormToPayload(values));
      setDues(result.dues);
      setFormOpen(false);
      showToast("Aidat tanımı güncellendi.");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function openCharge() {
    if (!auth || !dues) return;
    try {
      const preview = await getChargePreview(auth, dues.id);
      setChargePreview(preview);
    } catch (err) {
      toastError(err, "Önizleme alınamadı.");
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
      await Promise.all([load(), loadDebts()]);
    } catch (err) {
      toastError(err, "Borçlandırma başarısız.");
    } finally {
      setChargePending(false);
    }
  }

  async function handleBulkCancel() {
    if (!auth || !dues || bulkCancelPending) return;
    setBulkCancelPending(true);
    try {
      const result = await cancelOpenDuesDebts(auth, dues.id);
      showToast(`${result.cancelledCount} açık borç iptal edildi.`);
      setBulkCancelOpen(false);
      await Promise.all([load(), loadDebts()]);
    } catch (err) {
      toastError(err, "Toplu iptal başarısız.");
    } finally {
      setBulkCancelPending(false);
    }
  }

  if (error) {
    return (
      <PageContainer>
        <p className="text-sm text-danger">{error}</p>
        <Link href="/app/muhasebe/aidatlar" className="mt-4 inline-flex text-sm text-muted hover:text-ink">
          ← Aidatlar
        </Link>
      </PageContainer>
    );
  }

  if (!dues) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Yükleniyor…</p>
      </PageContainer>
    );
  }

  const status = deriveDuesAssessmentStatus(dues);
  const charged = dues.chargedApartmentCount ?? 0;
  const original = Number(dues.totalOriginalAmount ?? 0);
  const remaining = Number(dues.totalRemainingAmount ?? 0);
  const collected = Math.max(0, original - remaining);

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/muhasebe/aidatlar"
        backLabel="Aidatlar"
        title={dues.name}
        description={`${dues.building.name} · ${formatPeriodLong(dues.periodYear, dues.periodMonth)}`}
        status={<Badge tone={statusTone(status)}>{DUES_ASSESSMENT_STATUS_LABELS[status]}</Badge>}
        actions={
          <>
            {(dues.chargedOpenCount ?? 0) > 0 && dues.canSafeCancel !== false ? (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setBulkCancelOpen(true)}>
                Açık Borçları İptal Et
              </Button>
            ) : null}
            {dues.canChargeMore !== false ? (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void openCharge()}>
                Dairelere Borçlandır
              </Button>
            ) : (
              <Button variant="secondary" className="w-full sm:w-auto" disabled>
                Zaten borçlandırıldı
              </Button>
            )}
            <Button className="w-full sm:w-auto" onClick={() => setFormOpen(true)}>
              Düzenle
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DoorOpen} label="Borçlandırılan daire" value={String(charged)} />
        <StatCard icon={Receipt} label="Toplam tahakkuk" value={formatMoney(dues.totalOriginalAmount ?? "0")} />
        <StatCard icon={Wallet} label="Tahsil edilen" value={formatMoney(collected)} />
        <StatCard icon={CircleDollarSign} label="Kalan" value={formatMoney(dues.totalRemainingAmount ?? "0")} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Aidat Tanımı">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info label="Aidat açıklaması" value={dues.name} />
            <Info label="Dönem" value={formatPeriodLong(dues.periodYear, dues.periodMonth)} />
            <Info label="Kapsam" value={dues.building.name} />
            <Info label="Daire başına tutar" value={formatMoney(dues.amount)} />
            <Info label="Son ödeme tarihi" value={formatDateTr(dues.dueDate)} />
            <Info label="Durum" value={DUES_ASSESSMENT_STATUS_LABELS[status]} />
            <div className="sm:col-span-2">
              <Info label="Açıklama" value={dues.description || "—"} />
            </div>
          </dl>
          {charged === 0 ? (
            <p className="mt-4 rounded-md border border-accent/25 bg-accent-subtle px-3 py-2 text-sm text-ink">
              Bu kayıt henüz bir aidat tanımıdır. Daire borçları “Dairelere Borçlandır” ile
              oluşturulur; borçlar daireye bağlıdır, kişiye değil.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Hızlı Bilgi" description="Borçlandırma kapsamı">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2">
              <Building2 className="size-4 text-accent" aria-hidden />
              <span>{dues.building.name}</span>
            </li>
            <li className="rounded-md border border-line bg-canvas px-3 py-2">
              Aktif daire kapasitesi: {dues.activeApartmentCount ?? "—"}
            </li>
            <li className="rounded-md border border-line bg-canvas px-3 py-2">
              Açık borç: {dues.chargedOpenCount ?? 0}
            </li>
          </ul>
        </SectionCard>
      </div>

      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-section text-ink">Oluşturulan daire borçları</h2>
            <p className="mt-0.5 text-sm text-muted">
              Borçlar daireye bağlıdır. Malik/kiracı bilgisi yalnızca görüntüleme amaçlıdır.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-48">
              <SearchInput
                placeholder="Daire ara..."
                value={debtSearch}
                onChange={(event) => setDebtSearch(event.target.value)}
                aria-label="Borç ara"
              />
            </div>
            <Select
              className="w-full sm:w-40"
              value={debtStatus}
              onChange={(event) => setDebtStatus(event.target.value as "hepsi" | DebtStatus)}
              aria-label="Borç durumu"
            >
              <option value="hepsi">Tüm durumlar</option>
              <option value="OPEN">Açık</option>
              <option value="PAID">Ödendi</option>
              <option value="CANCELLED">İptal</option>
            </Select>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {!debtsLoading && debts.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Henüz daire borcu yok"
              description="Aidat tanımı oluşturulmuş olabilir; borçlandırma yapılmadıysa burada kayıt görünmez."
              action={
                <Button type="button" onClick={() => void openCharge()}>
                  Dairelere Borçlandır
                </Button>
              }
            />
          ) : (
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Daire</TH>
                    <TH>Malik / Kiracı</TH>
                    <TH className="text-right">Borç</TH>
                    <TH className="text-right">Ödenen</TH>
                    <TH className="text-right">Kalan</TH>
                    <TH>Durum</TH>
                    <TH>Son ödeme</TH>
                  </TR>
                </THead>
                <TBody>
                  {debtsLoading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <TR key={`d-${index}`} className="hover:bg-transparent">
                          <TD colSpan={7}>
                            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                          </TD>
                        </TR>
                      ))
                    : null}
                  {!debtsLoading
                    ? debts.map((debt) => {
                        const paid =
                          Number(debt.originalAmount) - Number(debt.remainingAmount);
                        return (
                          <TR key={debt.id}>
                            <TD className="font-medium">
                              <Link
                                href={`/app/muhasebe/borclar/${debt.id}`}
                                className="hover:text-accent"
                              >
                                Daire {debt.apartment.number}
                              </Link>
                            </TD>
                            <TD>
                              <p className="text-sm">{debt.primaryOwnerName || "—"}</p>
                              {debt.primaryTenantName ? (
                                <p className="text-xs text-muted">Kiracı: {debt.primaryTenantName}</p>
                              ) : null}
                            </TD>
                            <TD className="text-right">{formatMoney(debt.originalAmount)}</TD>
                            <TD className="text-right">{formatMoney(Math.max(0, paid))}</TD>
                            <TD className="text-right">{formatMoney(debt.remainingAmount)}</TD>
                            <TD>{DEBT_STATUS_LABELS[debt.status]}</TD>
                            <TD>{formatDateTr(debt.dueDate)}</TD>
                          </TR>
                        );
                      })
                    : null}
                </TBody>
              </TableElement>
            </Table>
          )}
        </div>
      </SurfaceCard>

      <DuesFormModal
        open={formOpen}
        title="Aidatı Düzenle"
        initialValues={duesToForm(dues, auth?.siteId ?? "")}
        pending={formPending}
        error={formError}
        financialFieldsLocked={Boolean(dues.financialFieldsLocked)}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <DuesChargeModal
        preview={chargePreview}
        pending={chargePending}
        onClose={() => setChargePreview(null)}
        onConfirm={() => void handleCharge()}
      />

      <ConfirmDialog
        open={bulkCancelOpen}
        title="Açık borçlar iptal edilsin mi?"
        description="Bu aidattan oluşmuş tüm açık borçlar iptal edilecektir. Tahsil edilmiş ödemeler korunur; finansal geçmiş bozulmaz."
        confirmLabel="Açık Borçları İptal Et"
        cancelLabel="Vazgeç"
        danger
        pending={bulkCancelPending}
        onConfirm={() => void handleBulkCancel()}
        onClose={() => (bulkCancelPending ? undefined : setBulkCancelOpen(false))}
      />
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
