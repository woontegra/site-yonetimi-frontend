"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  DuesFormModal,
  duesFormToPayload,
  duesToForm,
  type DuesFormValues,
} from "@/components/accounting/DuesFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
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
import { formatDateTr, formatMoney, formatPeriodLong } from "@/lib/money";

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function DuesDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth();

  const [dues, setDues] = useState<DuesDefinition | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [chargePreview, setChargePreview] = useState<ChargePreview | null>(null);
  const [chargePending, setChargePending] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkCancelPending, setBulkCancelPending] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const [result, buildingList] = await Promise.all([
        getDuesDefinition(auth, params.id),
        listBuildings(auth, { status: "aktif", perPage: 100 }),
      ]);
      setDues(result.dues);
      setBuildings(buildingList.items);
    } catch (err) {
      setDues(null);
      setError(err instanceof ApiError ? err.message : "Aidat yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleSubmit(values: DuesFormValues) {
    if (!auth || !dues || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const result = await updateDuesDefinition(auth, dues.id, duesFormToPayload(values));
      setDues(result.dues);
      setFormOpen(false);
      showToast("Aidat güncellendi.");
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
      showToast(err instanceof ApiError ? err.message : "Önizleme alınamadı.", "error");
    }
  }

  async function handleCharge() {
    if (!auth || !chargePreview || chargePending) return;
    setChargePending(true);
    try {
      const result = await chargeDues(auth, chargePreview.dues.id);
      showToast(`${result.createdCount} daire borçlandırıldı.`);
      setChargePreview(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Borçlandırma başarısız.", "error");
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
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Toplu iptal başarısız.", "error");
    } finally {
      setBulkCancelPending(false);
    }
  }

  const charged = dues?.chargedApartmentCount ?? 0;
  const active = dues?.activeApartmentCount ?? 0;

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe/aidatlar"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Aidatlar
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {dues ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-[24px] font-semibold leading-none text-ink">{dues.name}</h1>
            <div className="flex flex-wrap gap-2">
              {(dues.chargedOpenCount ?? 0) > 0 ? (
                <Button variant="secondary" onClick={() => setBulkCancelOpen(true)}>
                  Açık Borçları Toplu İptal Et
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => void openCharge()}>
                Dairelere Borçlandır
              </Button>
              <Button onClick={() => setFormOpen(true)}>Düzenle</Button>
            </div>
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-line pb-5 md:grid-cols-4">
            <InfoItem label="Bina" value={dues.building.name} />
            <InfoItem label="Dönem" value={formatPeriodLong(dues.periodYear, dues.periodMonth)} />
            <InfoItem label="Tutar" value={formatMoney(dues.amount)} />
            <InfoItem label="Son ödeme tarihi" value={formatDateTr(dues.dueDate)} />
            <div>
              <dt className="text-xs text-muted">Durum</dt>
              <dd className="mt-0.5">
                <StatusBadge active={dues.isActive} />
              </dd>
            </div>
            <div className="col-span-2 md:col-span-3">
              <InfoItem label="Açıklama" value={dues.description || "—"} />
            </div>
          </dl>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">Borçlandırma Durumu</h2>
            <p className="text-sm text-ink">
              {charged} / {active} daire borçlandırıldı
            </p>
            <p className="mt-1 text-sm text-muted">
              Toplam: {formatMoney(dues.totalOriginalAmount ?? "0")}
            </p>
          </div>

          <DuesFormModal
            open={formOpen}
            title="Aidatı Düzenle"
            initialValues={duesToForm(dues, auth?.siteId ?? "")}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <Modal
            open={Boolean(chargePreview)}
            title="Aidatı dairelere uygula"
            description="Bu işlem aktif dairelerin her biri için ayrı bir borç kaydı oluşturacaktır."
            variant="confirm"
            onClose={chargePending ? () => undefined : () => setChargePreview(null)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setChargePreview(null)} disabled={chargePending}>
                  Vazgeç
                </Button>
                <Button
                  onClick={() => void handleCharge()}
                  disabled={chargePending || !chargePreview?.pendingChargeCount}
                >
                  {chargePending
                    ? "Borçlandırılıyor..."
                    : `${chargePreview?.pendingChargeCount ?? 0} Daireyi Borçlandır`}
                </Button>
              </>
            }
          >
            {chargePreview ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Bina</dt>
                  <dd className="font-medium">{chargePreview.dues.building.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Dönem</dt>
                  <dd className="font-medium">
                    {formatPeriodLong(chargePreview.dues.periodYear, chargePreview.dues.periodMonth)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Tutar</dt>
                  <dd className="font-medium">{formatMoney(chargePreview.dues.amount)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Aktif daire</dt>
                  <dd className="font-medium">{chargePreview.activeApartmentCount}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-2">
                  <dt className="text-muted">Toplam oluşturulacak borç</dt>
                  <dd className="font-semibold">{formatMoney(chargePreview.totalChargeAmount)}</dd>
                </div>
              </dl>
            ) : null}
          </Modal>

          <ConfirmDialog
            open={bulkCancelOpen}
            title="Açık borçlar iptal edilsin mi?"
            description="Bu aidattan oluşmuş tüm açık borçlar iptal edilecektir. Finansal geçmiş korunur."
            confirmLabel="Açık Borçları İptal Et"
            cancelLabel="Vazgeç"
            danger
            pending={bulkCancelPending}
            onConfirm={() => void handleBulkCancel()}
            onClose={() => (bulkCancelPending ? undefined : setBulkCancelOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
