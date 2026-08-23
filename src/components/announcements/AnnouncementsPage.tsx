"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  AnnouncementFormModal,
  announcementFormToCreatePayload,
  announcementFormToUpdatePayload,
  announcementToForm,
  emptyAnnouncementForm,
  type AnnouncementFormValues,
} from "@/components/announcements/AnnouncementFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  ANNOUNCEMENT_PRIORITY_LABELS,
  ANNOUNCEMENT_STATUS_LABELS,
  archiveAnnouncement,
  cancelAnnouncement,
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
  type Announcement,
  type AnnouncementPriority,
  type AnnouncementStatus,
} from "@/lib/announcements-api";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

const tabs = [
  { id: "PUBLISHED" as const, label: "Yayındaki" },
  { id: "DRAFT" as const, label: "Taslaklar" },
  { id: "ARCHIVED" as const, label: "Geçmiş" },
  { id: "CANCELLED" as const, label: "İptal" },
];

type TabId = (typeof tabs)[number]["id"];

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

function contentPreview(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 90) return compact;
  return `${compact.slice(0, 90)}…`;
}

function publishDate(item: Announcement) {
  return formatDateTr(item.publishedAt || item.publishAt);
}

export function AnnouncementsPage() {
  const router = useRouter();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [tab, setTab] = useState<TabId>("PUBLISHED");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [archiving, setArchiving] = useState<Announcement | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  const [cancelling, setCancelling] = useState<Announcement | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      setListError("Sunucuya bağlanılamadı.");
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listAnnouncements(auth, {
        search: debouncedSearch.trim() || undefined,
        status: tab,
        priority: (priority as AnnouncementPriority) || undefined,
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
  }, [auth, debouncedSearch, page, priority, tab]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, priority, tab]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  async function openEdit(item: Announcement) {
    if (!auth) return;
    setFormError("");
    try {
      const result = await getAnnouncement(auth, item.id);
      setEditing(result.announcement);
      setFormOpen(true);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Duyuru yüklenemedi.", "error");
    }
  }

  async function handleSubmit(
    values: AnnouncementFormValues,
    action: "draft" | "publish" | "save",
  ) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      if (editing) {
        await updateAnnouncement(auth, editing.id, announcementFormToUpdatePayload(values));
        showToast("Duyuru güncellendi.");
      } else {
        if (!values.siteId) {
          setFormError("Site seçimi zorunludur.");
          setFormPending(false);
          return;
        }
        await createAnnouncement(
          { ...auth, siteId: values.siteId },
          announcementFormToCreatePayload(values, action === "publish"),
        );
        showToast(action === "publish" ? "Duyuru yayınlandı." : "Taslak kaydedildi.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handlePublish(item: Announcement) {
    if (!auth) return;
    try {
      await publishAnnouncement(auth, item.id);
      showToast("Duyuru yayınlandı.");
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Duyuru yayınlanamadı.", "error");
    }
  }

  async function handleArchive() {
    if (!auth || !archiving || archivePending) return;
    setArchivePending(true);
    try {
      await archiveAnnouncement(auth, archiving.id);
      showToast("Duyuru arşivlendi.");
      setArchiving(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Duyuru arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !cancelling || cancelPending) return;
    setCancelPending(true);
    try {
      await cancelAnnouncement(auth, cancelling.id);
      showToast("Duyuru iptal edildi.");
      setCancelling(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Duyuru iptal edilemedi.", "error");
    } finally {
      setCancelPending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Duyurular"
        description={
          site?.name ? `${site.name} için duyuruları yayınlayın.` : "Site duyurularını yönetin."
        }
        search={
          <SearchInput
            placeholder="Duyuru ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Duyuru ara"
          />
        }
        actions={
          <>
            <Select
              className="h-10 w-full min-w-0 text-sm sm:w-auto"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Öncelik filtresi"
            >
              <option value="">Tüm öncelikler</option>
              {(Object.keys(ANNOUNCEMENT_PRIORITY_LABELS) as AnnouncementPriority[]).map((key) => (
                <option key={key} value={key}>
                  {ANNOUNCEMENT_PRIORITY_LABELS[key]}
                </option>
              ))}
            </Select>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Yeni Duyuru
            </Button>
          </>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm transition-colors duration-micro",
              tab === item.id
                ? "border-brand font-medium text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Duyuru</TH>
              <TH>Hedef</TH>
              <TH>Öncelik</TH>
              <TH>Yayın Tarihi</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                    <TD colSpan={6}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}

            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                  Bu sekmede duyuru bulunmuyor.
                </TD>
              </TR>
            ) : null}

            {!loading
              ? items.map((item) => (
                  <TR
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/duyurular/${item.id}`)}
                  >
                    <TD className="max-w-[320px] whitespace-normal">
                      <p className="font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                        {contentPreview(item.content)}
                      </p>
                    </TD>
                    <TD>{item.targetSummary || "—"}</TD>
                    <TD>
                      <Badge tone={priorityTone(item.priority)}>
                        {ANNOUNCEMENT_PRIORITY_LABELS[item.priority]}
                      </Badge>
                    </TD>
                    <TD>{publishDate(item)}</TD>
                    <TD>
                      <Badge tone={statusTone(item.status)}>
                        {ANNOUNCEMENT_STATUS_LABELS[item.status]}
                      </Badge>
                    </TD>
                    <TD className="text-right" onClick={(event) => event.stopPropagation()}>
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label={`${item.title} işlemleri`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/duyurular/${item.id}`}>Detay</DropdownItem>
                        {item.status === "DRAFT" || item.status === "PUBLISHED" ? (
                          <DropdownItem onClick={() => void openEdit(item)}>Düzenle</DropdownItem>
                        ) : null}
                        {item.status === "DRAFT" ? (
                          <DropdownItem onClick={() => void handlePublish(item)}>
                            Yayınla
                          </DropdownItem>
                        ) : null}
                        {item.status === "PUBLISHED" ? (
                          <DropdownItem danger onClick={() => setArchiving(item)}>
                            Arşivle
                          </DropdownItem>
                        ) : null}
                        {item.status === "DRAFT" || item.status === "PUBLISHED" ? (
                          <DropdownItem danger onClick={() => setCancelling(item)}>
                            İptal et
                          </DropdownItem>
                        ) : null}
                      </Dropdown>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>

      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <AnnouncementFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        mode={editing ? "edit" : "create"}
        initialValues={
          editing ? announcementToForm(editing) : emptyAnnouncementForm(siteId ?? "")
        }
        pending={formPending}
        error={formError}
        siteLabel={editing?.site.name || site?.name}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Duyuru arşivlensin mi?"
        description="Duyuru yayından kaldırılacak ve geçmiş sekmesine taşınacaktır."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
        danger
        pending={archivePending}
        onConfirm={() => void handleArchive()}
        onClose={() => (archivePending ? undefined : setArchiving(null))}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Duyuru iptal edilsin mi?"
        description="Duyuru iptal edilecek ve İptal sekmesine taşınacaktır. Bu işlem geri alınamaz."
        confirmLabel="İptal et"
        cancelLabel="Vazgeç"
        danger
        pending={cancelPending}
        onConfirm={() => void handleCancel()}
        onClose={() => (cancelPending ? undefined : setCancelling(null))}
      />
    </PageContainer>
  );
}
