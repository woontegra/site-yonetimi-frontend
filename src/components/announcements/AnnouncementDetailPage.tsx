"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AnnouncementFormModal,
  announcementFormToUpdatePayload,
  announcementToForm,
  type AnnouncementFormValues,
} from "@/components/announcements/AnnouncementFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionCard } from "@/components/ui/SurfaceCard";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { canManageAnnouncements } from "@/lib/permissions";
import {
  ANNOUNCEMENT_PRIORITY_LABELS,
  ANNOUNCEMENT_STATUS_LABELS,
  archiveAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  previewAnnouncementAudience,
  publishAnnouncement,
  updateAnnouncement,
  type Announcement,
  type AnnouncementPriority,
  type AnnouncementStatus,
  type AudiencePreview,
} from "@/lib/announcements-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function audienceKindLabel(type: Announcement["audienceType"]): string {
  if (type === "ALL_SITE") return "Tüm site";
  if (type === "BUILDINGS") return "Seçili bina";
  return "Seçili kişiler";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function priorityTone(priority: AnnouncementPriority): "neutral" | "warning" | "danger" {
  if (priority === "URGENT") return "danger";
  if (priority === "IMPORTANT") return "warning";
  return "neutral";
}

function statusTone(status: AnnouncementStatus): "neutral" | "success" | "warning" | "danger" {
  if (status === "PUBLISHED") return "success";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, user } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: false });
  const { site } = useActiveSite();
  const canManage = canManageAnnouncements(user);

  const [item, setItem] = useState<Announcement | null>(null);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [publishPending, setPublishPending] = useState(false);

  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getAnnouncement(auth, params.id);
      setItem(result.announcement);
    } catch (err) {
      setItem(null);
      setError(err instanceof ApiError ? err.message : "Duyuru yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleSubmit(
    values: AnnouncementFormValues,
    _action: "draft" | "publish" | "save",
  ) {
    if (!auth || !item || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateAnnouncement(auth, item.id, announcementFormToUpdatePayload(values));
      await load();
      setFormOpen(false);
      showToast("Duyuru güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handlePublish() {
    if (!auth || !item || publishPending) return;
    setPublishPending(true);
    try {
      await publishAnnouncement(auth, item.id);
      showToast("Duyuru yayınlandı.");
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Duyuru yayınlanamadı.", "error");
    } finally {
      setPublishPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !item || archivePending) return;
    setArchivePending(true);
    try {
      await archiveAnnouncement(auth, item.id);
      showToast("Duyuru arşivlendi.");
      setArchiveOpen(false);
      router.push("/app/duyurular");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Duyuru arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  async function handleDelete() {
    if (!auth || !item || deletePending) return;
    setDeletePending(true);
    try {
      await deleteAnnouncement(auth, item.id);
      showToast("Duyuru silindi.");
      setDeleteOpen(false);
      router.push("/app/duyurular");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Duyuru silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  async function handlePreviewAudience() {
    if (!auth || !item || previewPending) return;
    setPreviewPending(true);
    setPreviewError("");
    try {
      const preview = await previewAnnouncementAudience(auth, {
        audienceType: item.audienceType,
        buildingIds: item.buildings.map((building) => building.id),
        apartmentIds: item.apartments.map((apartment) => apartment.id),
      });
      setAudiencePreview(preview);
    } catch (err) {
      setAudiencePreview(null);
      setPreviewError(err instanceof ApiError ? err.message : "Hedef kitle önizlenemedi.");
    } finally {
      setPreviewPending(false);
    }
  }

  const canMutate = item?.status === "DRAFT" || item?.status === "PUBLISHED";
  const canArchive = item?.status === "DRAFT" || item?.status === "PUBLISHED";
  const siteName = dash(item?.site.name || site?.name);

  return (
    <PageContainer>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {item ? (
        <>
          <DetailHeader
            backHref="/app/duyurular"
            backLabel="Duyurulara dön"
            title={item.title}
            description={`${siteName} · ${formatDateTr(item.createdAt)}`}
            status={
              <Badge tone={statusTone(item.status)}>{ANNOUNCEMENT_STATUS_LABELS[item.status]}</Badge>
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {item.status === "DRAFT" ? (
                  <Button disabled={publishPending} onClick={() => void handlePublish()}>
                    {publishPending ? "Yayınlanıyor..." : "Yayınla"}
                  </Button>
                ) : null}
                {canMutate ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFormError("");
                      setFormOpen(true);
                    }}
                  >
                    Düzenle
                  </Button>
                ) : null}
                {canArchive ? (
                  <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
                    Arşivle
                  </Button>
                ) : null}
                {canManage ? (
                  <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                    Sil
                  </Button>
                ) : null}
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-4">
            <SectionCard title="Duyuru İçeriği">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Başlık">{dash(item.title)}</Field>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Badge tone={priorityTone(item.priority)}>
                    {ANNOUNCEMENT_PRIORITY_LABELS[item.priority]}
                  </Badge>
                  <Badge tone={statusTone(item.status)}>
                    {ANNOUNCEMENT_STATUS_LABELS[item.status]}
                  </Badge>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Duyuru metni">
                    <p className="whitespace-pre-wrap break-words">{dash(item.content)}</p>
                  </Field>
                </div>
              </dl>
            </SectionCard>

            <SectionCard
              title="Hedef Kitle"
              action={
                <Button
                  variant="secondary"
                  disabled={previewPending}
                  onClick={() => void handlePreviewAudience()}
                >
                  {previewPending ? "Önizleniyor..." : "Hedef Kitleyi Önizle"}
                </Button>
              }
            >
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Hedef">{audienceKindLabel(item.audienceType)}</Field>
                <Field label="Hedef kitle özeti">{dash(item.targetSummary)}</Field>
                {item.audienceType === "BUILDINGS" ? (
                  <div className="sm:col-span-2">
                    <Field label="Binalar">
                      {item.buildings.length > 0
                        ? item.buildings.map((building) => building.name).join(", ")
                        : "—"}
                    </Field>
                  </div>
                ) : null}
                {item.audienceType === "APARTMENTS" ? (
                  <div className="sm:col-span-2">
                    <Field label="Daireler">
                      {item.apartments.length > 0
                        ? item.apartments
                            .map((apartment) => `${apartment.building.name} · Daire ${apartment.number}`)
                            .join(", ")
                        : "—"}
                    </Field>
                  </div>
                ) : null}
              </dl>
              {previewError ? <p className="mt-3 text-sm text-danger">{previewError}</p> : null}
              {audiencePreview ? (
                <p className="mt-3 text-sm text-muted">
                  {audiencePreview.apartmentCount} daire · {audiencePreview.recipientCount} kişi ·{" "}
                  {audiencePreview.withPhoneCount} telefonlu
                  {audiencePreview.truncated ? " (liste kısaltıldı)" : ""}
                </p>
              ) : null}
            </SectionCard>

            <SectionCard title="Yayın Bilgileri">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Yayın tarihi">{formatDateTr(item.publishedAt || item.publishAt)}</Field>
                <Field label="Son geçerlilik">{formatDateTr(item.expiresAt)}</Field>
                <Field label="Oluşturulma tarihi">{formatDateTr(item.createdAt)}</Field>
                <Field label="Son güncelleme">{formatDateTr(item.updatedAt)}</Field>
                {item.createdByUser?.fullName ? (
                  <Field label="Oluşturan kullanıcı">{item.createdByUser.fullName}</Field>
                ) : null}
              </dl>
            </SectionCard>
          </div>

          {canMutate ? (
            <AnnouncementFormModal
              open={formOpen}
              mode="edit"
              initialValues={announcementToForm(item)}
              pending={formPending}
              error={formError}
              siteLabel={item.site.name}
              onClose={() => (formPending ? undefined : setFormOpen(false))}
              onSubmit={handleSubmit}
            />
          ) : null}

          <ConfirmDialog
            open={archiveOpen}
            title="Duyuru arşivlensin mi?"
            description="Duyuru yayından kaldırılacak ve geçmiş sekmesine taşınacaktır."
            confirmLabel="Arşivle"
            cancelLabel="Vazgeç"
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => (archivePending ? undefined : setArchiveOpen(false))}
          />

          <ConfirmDialog
            open={deleteOpen}
            title="Duyuruyu silmek istediğinize emin misiniz?"
            description={`"${item.title}" kalıcı olarak silinecektir.`}
            confirmLabel="Sil"
            cancelLabel="Vazgeç"
            danger
            pending={deletePending}
            onConfirm={() => void handleDelete()}
            onClose={() => (deletePending ? undefined : setDeleteOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
