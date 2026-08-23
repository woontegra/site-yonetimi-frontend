"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  FeedbackFormModal,
  feedbackFormToPayload,
  feedbackToForm,
  type FeedbackFormValues,
} from "@/components/feedback/FeedbackFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  changeFeedbackStatus,
  deleteFeedbackRecord,
  getFeedbackRecord,
  listFeedbackCategories,
  listFeedbackHistory,
  updateFeedbackRecord,
  type FeedbackCategory,
  type FeedbackHistoryItem,
  type FeedbackPriority,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@/lib/feedback-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value ?? "—"}</dd>
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

function priorityTone(priority: FeedbackPriority): "neutral" | "warning" | "danger" {
  if (priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  return "neutral";
}

function statusTone(status: FeedbackStatus): "neutral" | "success" | "warning" | "brand" {
  if (status === "RESOLVED" || status === "CLOSED") return "success";
  if (status === "IN_PROGRESS") return "brand";
  return "warning";
}

export function FeedbackDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: false });
  const { site } = useActiveSite();

  const [item, setItem] = useState<FeedbackRecord | null>(null);
  const [history, setHistory] = useState<FeedbackHistoryItem[]>([]);
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"detail" | "history">("detail");

  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [statusPending, setStatusPending] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const [recordResult, historyResult, categoriesResult] = await Promise.all([
        getFeedbackRecord(auth, params.id),
        listFeedbackHistory(auth, params.id),
        listFeedbackCategories(auth, { status: "hepsi" }),
      ]);
      setItem(recordResult.record);
      setHistory(historyResult.items);
      setCategories(categoriesResult.items);
    } catch (err) {
      setItem(null);
      setError(err instanceof ApiError ? err.message : "Kayıt yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleSubmit(values: FeedbackFormValues) {
    if (!auth || !item || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateFeedbackRecord(
        { ...auth, siteId: item.siteId },
        item.id,
        feedbackFormToPayload(values),
      );
      showToast("Kayıt güncellendi.");
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function changeStatus(status: FeedbackStatus, note?: string, resolutionText?: string) {
    if (!auth || !item || statusPending) return;
    setStatusPending(true);
    try {
      await changeFeedbackStatus(
        { ...auth, siteId: item.siteId },
        item.id,
        {
          status,
          note,
          resolution: resolutionText,
        },
      );
      showToast("Durum güncellendi.");
      setResolveOpen(false);
      setResolution("");
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Durum güncellenemedi.", "error");
    } finally {
      setStatusPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !item || archivePending) return;
    setArchivePending(true);
    try {
      await deleteFeedbackRecord({ ...auth, siteId: item.siteId }, item.id);
      showToast("Kayıt arşivlendi.");
      router.push("/app/bilgi-oneri");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  const canEdit = item?.status === "OPEN" || item?.status === "IN_PROGRESS";
  const subtitle = item
    ? `${FEEDBACK_TYPE_LABELS[item.type]} · ${item.site.name || site?.name || "—"} · ${formatDateTr(item.createdAt)}`
    : "";

  return (
    <PageContainer>
      <Link
        href="/app/bilgi-oneri"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Bilgi ve Öneriler
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {item ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-tight text-ink">{item.title}</h1>
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
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
              {item.status === "OPEN" ? (
                <Button
                  disabled={statusPending}
                  onClick={() => void changeStatus("IN_PROGRESS")}
                >
                  İşleme Al
                </Button>
              ) : null}
              {item.status === "OPEN" || item.status === "IN_PROGRESS" ? (
                <Button variant="secondary" onClick={() => setResolveOpen(true)}>
                  Çözüldü Olarak İşaretle
                </Button>
              ) : null}
              {item.status === "RESOLVED" ? (
                <Button disabled={statusPending} onClick={() => void changeStatus("CLOSED")}>
                  Kapat
                </Button>
              ) : null}
              {item.status === "RESOLVED" || item.status === "CLOSED" ? (
                <Button
                  variant="secondary"
                  disabled={statusPending}
                  onClick={() => void changeStatus("OPEN", "Kayıt yeniden açıldı.")}
                >
                  Yeniden Aç
                </Button>
              ) : null}
              {item.status === "RESOLVED" || item.status === "CLOSED" ? (
                <Button variant="danger" onClick={() => setArchiveOpen(true)}>
                  Arşivle
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mb-4 flex gap-1 border-b border-line">
            {(
              [
                { id: "detail" as const, label: "Detay" },
                { id: "history" as const, label: "Geçmiş" },
              ] as const
            ).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={
                  tab === entry.id
                    ? "border-b-2 border-brand px-3 py-2 text-sm font-medium text-brand"
                    : "border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-ink"
                }
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "detail" ? (
            <>
              <InfoGroup title="Kayıt">
                <InfoItem label="Tür" value={FEEDBACK_TYPE_LABELS[item.type]} />
                <InfoItem label="Kategori" value={item.category?.name || "—"} />
                <InfoItem
                  label="Öncelik"
                  value={
                    <Badge tone={priorityTone(item.priority)}>
                      {FEEDBACK_PRIORITY_LABELS[item.priority]}
                    </Badge>
                  }
                />
                <InfoItem
                  label="Durum"
                  value={
                    <Badge tone={statusTone(item.status)}>
                      {FEEDBACK_STATUS_LABELS[item.status]}
                    </Badge>
                  }
                />
                <div className="col-span-2 md:col-span-4">
                  <InfoItem label="Açıklama" value={<p className="whitespace-pre-wrap">{item.description}</p>} />
                </div>
              </InfoGroup>

              <InfoGroup title="Kapsam">
                <InfoItem label="Site" value={item.site.name} />
                <InfoItem label="Bina" value={item.building?.name || "—"} />
                <InfoItem
                  label="Daire"
                  value={item.apartment ? `Daire ${item.apartment.number}` : "—"}
                />
                <InfoItem label="Konum" value={item.locationLabel} />
              </InfoGroup>

              <InfoGroup title="İlgililer">
                <InfoItem label="İlgili kişi" value={item.person?.fullName || "—"} />
                <InfoItem label="Sorumlu çalışan" value={item.employee?.label || "—"} />
                <InfoItem label="Oluşturma" value={formatDateTr(item.createdAt)} />
                <InfoItem
                  label="Çözüm tarihi"
                  value={item.resolvedAt ? formatDateTr(item.resolvedAt) : "—"}
                />
              </InfoGroup>

              {item.resolution ? (
                <InfoGroup title="Çözüm">
                  <div className="col-span-2 md:col-span-4">
                    <InfoItem
                      label="Çözüm açıklaması"
                      value={<p className="whitespace-pre-wrap">{item.resolution}</p>}
                    />
                  </div>
                </InfoGroup>
              ) : null}
            </>
          ) : (
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Tarih</TH>
                    <TH>Önceki Durum</TH>
                    <TH>Yeni Durum</TH>
                    <TH>Açıklama</TH>
                  </TR>
                </THead>
                <TBody>
                  {history.length === 0 ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={4} className="py-6 text-center text-sm text-muted">
                        Henüz durum geçmişi yok.
                      </TD>
                    </TR>
                  ) : null}
                  {history.map((row) => (
                    <TR key={row.id}>
                      <TD>{formatDateTr(row.createdAt)}</TD>
                      <TD>
                        {row.previousStatus
                          ? FEEDBACK_STATUS_LABELS[row.previousStatus]
                          : "—"}
                      </TD>
                      <TD>{FEEDBACK_STATUS_LABELS[row.newStatus]}</TD>
                      <TD className="max-w-[320px] whitespace-normal text-muted">
                        {row.note || "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableElement>
            </Table>
          )}

          {canEdit ? (
            <FeedbackFormModal
              open={formOpen}
              mode="edit"
              initialValues={feedbackToForm(item)}
              categories={categories}
              pending={formPending}
              error={formError}
              lockSite
              siteLabel={item.site.name}
              onClose={() => {
                if (!formPending) setFormOpen(false);
              }}
              onSubmit={handleSubmit}
            />
          ) : null}

          <Modal
            open={resolveOpen}
            title="Çözüldü olarak işaretle"
            description="Çözüm açıklaması zorunludur."
            variant="form"
            onClose={() => {
              if (!statusPending) setResolveOpen(false);
            }}
            footer={
              <>
                <Button
                  variant="secondary"
                  disabled={statusPending}
                  onClick={() => setResolveOpen(false)}
                >
                  Vazgeç
                </Button>
                <Button
                  disabled={statusPending || !resolution.trim()}
                  onClick={() => void changeStatus("RESOLVED", undefined, resolution.trim())}
                >
                  {statusPending ? "Kaydediliyor..." : "Çözüldü"}
                </Button>
              </>
            }
          >
            <Textarea
              rows={4}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Yapılan işlem / çözüm"
            />
          </Modal>

          <ConfirmDialog
            open={archiveOpen}
            title="Kayıt arşivlensin mi?"
            description="Kayıt listeden kaldırılacaktır."
            confirmLabel="Arşivle"
            cancelLabel="Vazgeç"
            danger
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => {
              if (!archivePending) setArchiveOpen(false);
            }}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
