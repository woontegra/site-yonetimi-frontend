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
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  ANNOUNCEMENT_PRIORITY_LABELS,
  ANNOUNCEMENT_STATUS_LABELS,
  archiveAnnouncement,
  cancelAnnouncement,
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

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">{children}</dl>
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
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: false });
  const { site } = useActiveSite();

  const [item, setItem] = useState<Announcement | null>(null);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
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

  async function handleCancel() {
    if (!auth || !item || cancelPending) return;
    setCancelPending(true);
    try {
      await cancelAnnouncement(auth, item.id);
      showToast("Duyuru iptal edildi.");
      setCancelOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Duyuru iptal edilemedi.", "error");
    } finally {
      setCancelPending(false);
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
  const siteName = item?.site.name || site?.name || "—";
  const subtitleDate = formatDateTr(item?.publishedAt || item?.publishAt || item?.createdAt);

  return (
    <PageContainer>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {item ? (
        <>
          <DetailHeader
            backHref="/app/duyurular"
            backLabel="Duyurular"
            title={item.title}
            description={`${siteName} · ${subtitleDate}`}
            status={
              <Badge tone={statusTone(item.status)}>{ANNOUNCEMENT_STATUS_LABELS[item.status]}</Badge>
            }
            actions={
              canMutate ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFormError("");
                      setFormOpen(true);
                    }}
                  >
                    Düzenle
                  </Button>
                  {item.status === "DRAFT" ? (
                    <Button disabled={publishPending} onClick={() => void handlePublish()}>
                      {publishPending ? "Yayınlanıyor..." : "Yayınla"}
                    </Button>
                  ) : null}
                  {item.status === "PUBLISHED" ? (
                    <Button variant="danger" onClick={() => setArchiveOpen(true)}>
                      Arşivle
                    </Button>
                  ) : null}
                  <Button variant="danger" onClick={() => setCancelOpen(true)}>
                    İptal et
                  </Button>
                </div>
              ) : undefined
            }
          />

          <InfoGroup title="Duyuru">
            <div className="col-span-2 md:col-span-4">
              <InfoItem
                label="İçerik"
                value={<p className="whitespace-pre-wrap">{item.content}</p>}
              />
            </div>
            <InfoItem
              label="Öncelik"
              value={
                <Badge tone={priorityTone(item.priority)}>
                  {ANNOUNCEMENT_PRIORITY_LABELS[item.priority]}
                </Badge>
              }
            />
            <InfoItem
              label="Durum"
              value={
                <Badge tone={statusTone(item.status)}>
                  {ANNOUNCEMENT_STATUS_LABELS[item.status]}
                </Badge>
              }
            />
            {item.createdByUser?.fullName ? (
              <InfoItem label="Oluşturan" value={item.createdByUser.fullName} />
            ) : null}
          </InfoGroup>

          <InfoGroup title="Hedef">
            <InfoItem label="Hedef Kitle" value={item.audienceLabel} />
            <InfoItem label="Özet" value={item.targetSummary || "—"} />
            {item.audienceType === "BUILDINGS" ? (
              <div className="col-span-2 md:col-span-4">
                <InfoItem
                  label="Binalar"
                  value={
                    item.buildings.length > 0
                      ? item.buildings.map((building) => building.name).join(", ")
                      : "—"
                  }
                />
              </div>
            ) : null}
            {item.audienceType === "APARTMENTS" ? (
              <div className="col-span-2 md:col-span-4">
                <InfoItem
                  label="Daireler"
                  value={
                    item.apartments.length > 0
                      ? item.apartments
                          .map(
                            (apartment) =>
                              `${apartment.building.name} · Daire ${apartment.number}`,
                          )
                          .join(", ")
                      : "—"
                  }
                />
              </div>
            ) : null}
            <div className="col-span-2 md:col-span-4">
              <Button
                variant="secondary"
                disabled={previewPending}
                onClick={() => void handlePreviewAudience()}
              >
                {previewPending ? "Önizleniyor..." : "Hedef kitleyi önizle"}
              </Button>
              {previewError ? <p className="mt-2 text-sm text-danger">{previewError}</p> : null}
              {audiencePreview ? (
                <p className="mt-2 text-sm text-muted">
                  {audiencePreview.apartmentCount} daire · {audiencePreview.recipientCount} kişi ·{" "}
                  {audiencePreview.withPhoneCount} telefonlu
                  {audiencePreview.truncated ? " (liste kısaltıldı)" : ""}
                </p>
              ) : null}
            </div>
          </InfoGroup>

          <InfoGroup title="Yayın">
            <InfoItem label="Yayın Tarihi" value={formatDateTr(item.publishedAt || item.publishAt)} />
            <InfoItem label="Son Geçerlilik" value={formatDateTr(item.expiresAt)} />
            <InfoItem label="Oluşturma" value={formatDateTr(item.createdAt)} />
            <InfoItem label="Güncelleme" value={formatDateTr(item.updatedAt)} />
          </InfoGroup>

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
            danger
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => (archivePending ? undefined : setArchiveOpen(false))}
          />

          <ConfirmDialog
            open={cancelOpen}
            title="Duyuru iptal edilsin mi?"
            description="Duyuru iptal edilecek. Bu işlem geri alınamaz."
            confirmLabel="İptal et"
            cancelLabel="Vazgeç"
            danger
            pending={cancelPending}
            onConfirm={() => void handleCancel()}
            onClose={() => (cancelPending ? undefined : setCancelOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
