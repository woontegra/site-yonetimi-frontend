"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import {
  VISIT_STATUS_LABELS,
  cancelVisit,
  checkOutVisit,
  dateTimeLocalToIso,
  formatTimeTr,
  formatVisitDuration,
  getVisit,
  toDateTimeLocalValue,
  updateVisit,
  type Visit,
  type VisitStatus,
} from "@/lib/visits-api";

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function statusTone(status: VisitStatus) {
  if (status === "INSIDE") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "COMPLETED") return "neutral" as const;
  return "warning" as const;
}

export function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState("");

  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [checkOutPending, setCheckOutPending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState("");
  const [checkOutAtEdit, setCheckOutAtEdit] = useState("");

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getVisit(auth, params.id);
      setVisit(result.visit);
    } catch (err) {
      setVisit(null);
      setError(err instanceof ApiError ? err.message : "Ziyaret yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleCheckOut() {
    if (!auth || !visit || checkOutPending) return;
    setCheckOutPending(true);
    try {
      await checkOutVisit(auth, visit.id);
      showToast("Çıkış kaydedildi.");
      setCheckOutOpen(false);
      await load();
    } catch (err) {
      toastError(err, "Çıkış yapılamadı.");
    } finally {
      setCheckOutPending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !visit || cancelPending) return;
    setCancelPending(true);
    try {
      await cancelVisit(auth, visit.id);
      showToast("Ziyaret iptal edildi.");
      setCancelOpen(false);
      await load();
    } catch (err) {
      toastError(err, "Ziyaret iptal edilemedi.");
    } finally {
      setCancelPending(false);
    }
  }

  function openEditCheckOut() {
    if (!visit) return;
    setEditError("");
    setCheckOutAtEdit(
      visit.checkOutAt ? toDateTimeLocalValue(visit.checkOutAt) : toDateTimeLocalValue(),
    );
    setEditOpen(true);
  }

  async function handleEditCheckOut(event: FormEvent) {
    event.preventDefault();
    if (!auth || !visit || editPending) return;
    const iso = dateTimeLocalToIso(checkOutAtEdit);
    if (!iso) {
      setEditError("Geçerli bir çıkış zamanı girin.");
      return;
    }
    const checkIn = new Date(visit.checkInAt).getTime();
    const checkOut = new Date(iso).getTime();
    if (checkOut < checkIn) {
      setEditError("Çıkış saati giriş saatinden önce olamaz.");
      return;
    }
    setEditPending(true);
    setEditError("");
    try {
      await updateVisit(auth, visit.id, { checkOutAt: iso });
      showToast("Çıkış zamanı güncellendi.");
      setEditOpen(false);
      await load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Güncelleme başarısız.");
    } finally {
      setEditPending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/misafirler"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Misafirler
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {visit ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">
                {visit.visitor.fullName}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {visit.building.name} · Daire {visit.apartment.number}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visit.status === "INSIDE" ? (
                <>
                  <Button onClick={() => setCheckOutOpen(true)}>Çıkış Yap</Button>
                  <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                    İptal Et
                  </Button>
                </>
              ) : null}
              {visit.status === "INSIDE" || visit.status === "COMPLETED" ? (
                <Button variant="secondary" onClick={openEditCheckOut}>
                  Çıkış Zamanı
                </Button>
              ) : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
            <InfoItem
              label="Misafir"
              value={
                <Link href={`/app/misafirler/${visit.visitor.id}`} className="hover:text-brand">
                  {visit.visitor.fullName}
                </Link>
              }
            />
            <InfoItem label="Telefon" value={visit.visitor.phone || "—"} />
            <InfoItem
              label="Durum"
              value={
                <Badge tone={statusTone(visit.status)}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
              }
            />
            <InfoItem label="Bina" value={visit.building.name} />
            <InfoItem
              label="Daire"
              value={
                <Link href={`/app/daireler/${visit.apartment.id}`} className="hover:text-brand">
                  {visit.apartment.number}
                </Link>
              }
            />
            <InfoItem label="Ziyaret Edilen" value={visit.hostPerson?.fullName || "—"} />
            <InfoItem
              label="Giriş"
              value={`${formatDateTr(visit.checkInAt)} ${formatTimeTr(visit.checkInAt)}`}
            />
            <InfoItem
              label="Çıkış"
              value={
                visit.checkOutAt
                  ? `${formatDateTr(visit.checkOutAt)} ${formatTimeTr(visit.checkOutAt)}`
                  : "—"
              }
            />
            <InfoItem
              label="Süre"
              value={formatVisitDuration(visit.checkInAt, visit.checkOutAt)}
            />
            <InfoItem label="Amaç" value={visit.purpose || "—"} />
            <InfoItem label="Plaka" value={visit.vehiclePlate || "—"} />
            <InfoItem label="Not" value={visit.note || "—"} />
          </dl>

          <ConfirmDialog
            open={checkOutOpen}
            title="Çıkış yapılsın mı?"
            description={`${visit.visitor.fullName} için çıkış kaydedilecek.`}
            confirmLabel="Çıkış Yap"
            cancelLabel="Vazgeç"
            pending={checkOutPending}
            onConfirm={() => void handleCheckOut()}
            onClose={() => (checkOutPending ? undefined : setCheckOutOpen(false))}
          />

          <ConfirmDialog
            open={cancelOpen}
            title="Ziyaret iptal edilsin mi?"
            description={`${visit.visitor.fullName} ziyareti iptal edilecek.`}
            confirmLabel="İptal Et"
            cancelLabel="Vazgeç"
            danger
            pending={cancelPending}
            onConfirm={() => void handleCancel()}
            onClose={() => (cancelPending ? undefined : setCancelOpen(false))}
          />

          <Modal
            open={editOpen}
            title="Çıkış zamanını düzenle"
            onClose={editPending ? () => undefined : () => setEditOpen(false)}
            footer={
              <>
                <Button variant="ghost" disabled={editPending} onClick={() => setEditOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" form="visit-checkout-edit" disabled={editPending}>
                  {editPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </>
            }
          >
            <form id="visit-checkout-edit" onSubmit={(event) => void handleEditCheckOut(event)}>
              <p className="mb-3 text-sm text-muted">
                Giriş: {formatDateTr(visit.checkInAt)} {formatTimeTr(visit.checkInAt)}. Çıkış
                girişten önce olamaz; kayıt içerideyse tamamlandıya alınır.
              </p>
              <FormField label="Çıkış Zamanı" htmlFor="visit-edit-checkout" required>
                <Input
                  id="visit-edit-checkout"
                  type="datetime-local"
                  value={checkOutAtEdit}
                  onChange={(event) => setCheckOutAtEdit(event.target.value)}
                />
              </FormField>
              {editError ? <p className="mt-2 text-[13px] text-danger">{editError}</p> : null}
            </form>
          </Modal>
        </>
      ) : null}
    </PageContainer>
  );
}
