"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { FeedbackCategoriesModal } from "@/components/feedback/FeedbackCategoriesModal";
import {
  FeedbackFormModal,
  emptyFeedbackForm,
  feedbackFormToPayload,
  feedbackToForm,
  type FeedbackFormValues,
} from "@/components/feedback/FeedbackFormModal";
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
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  createFeedbackRecord,
  deleteFeedbackRecord,
  listFeedbackCategories,
  listFeedbackRecords,
  updateFeedbackRecord,
  type FeedbackCategory,
  type FeedbackPriority,
  type FeedbackRecord,
  type FeedbackStatus,
  type FeedbackStatusGroup,
  type FeedbackType,
} from "@/lib/feedback-api";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

const tabs = [
  { id: "open" as const, label: "Açık Kayıtlar" },
  { id: "resolved" as const, label: "Çözülenler" },
  { id: "all" as const, label: "Tümü" },
];

type TabId = FeedbackStatusGroup;

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

export function FeedbackPage() {
  const router = useRouter();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [tab, setTab] = useState<TabId>("open");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ open: 0, inProgress: 0, active: 0 });
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeedbackRecord | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const [archiving, setArchiving] = useState<FeedbackRecord | null>(null);
  const [archivePending, setArchivePending] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listFeedbackCategories(auth, { status: "hepsi" });
      setCategories(result.items);
    } catch {
      setCategories([]);
    }
  }, [auth]);

  const load = useCallback(async () => {
    if (!auth || !siteId) {
      setLoading(false);
      setItems([]);
      setTotal(0);
      setSummary({ open: 0, inProgress: 0, active: 0 });
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listFeedbackRecords(
        { ...auth, siteId },
        {
          search: debouncedSearch.trim() || undefined,
          statusGroup: tab,
          type: (type as FeedbackType) || undefined,
          priority: (priority as FeedbackPriority) || undefined,
          categoryId: categoryId || undefined,
          page,
          perPage: PER_PAGE,
        },
      );
      setItems(result.items);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, siteId, debouncedSearch, tab, type, priority, categoryId, page]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadCategories();
  }, [ready, auth, loadCategories]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab, type, priority, categoryId, siteId]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(item: FeedbackRecord) {
    if (item.status === "CLOSED") {
      showToast("Kapalı kayıt düzenlenemez.", "error");
      return;
    }
    if (item.status === "RESOLVED") {
      showToast("Çözülmüş kayıt sınırlıdır; yeniden açarak düzenleyin.", "error");
      return;
    }
    setEditing(item);
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit(values: FeedbackFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      if (editing) {
        await updateFeedbackRecord(
          { ...auth, siteId: editing.siteId },
          editing.id,
          feedbackFormToPayload(values),
        );
        showToast("Kayıt güncellendi.");
      } else {
        if (!values.siteId) {
          setFormError("Site seçimi zorunludur.");
          setFormPending(false);
          return;
        }
        await createFeedbackRecord(
          { ...auth, siteId: values.siteId },
          feedbackFormToPayload(values),
        );
        showToast("Kayıt oluşturuldu.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
      await loadCategories();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !archiving || archivePending) return;
    setArchivePending(true);
    try {
      await deleteFeedbackRecord({ ...auth, siteId: archiving.siteId }, archiving.id);
      showToast("Kayıt arşivlendi.");
      setArchiving(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  const summaryText =
    summary.active > 0
      ? `${summary.open} açık · ${summary.inProgress} işlemde`
      : "Aktif kayıt yok";

  return (
    <PageContainer>
      <PageHeader
        title="Bilgi ve Öneriler"
        description={
          site?.name
            ? `${site.name} için gelen bilgi ve önerileri takip edin.`
            : "Gelen bilgi ve önerileri takip edin."
        }
        meta={summaryText}
        search={
          <SearchInput
            placeholder="Kayıt ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Kayıt ara"
          />
        }
        actions={
          <>
            <Select
              className="h-10 w-full min-w-0 text-sm sm:w-auto"
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Tür filtresi"
            >
              <option value="">Tüm türler</option>
              {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((key) => (
                <option key={key} value={key}>
                  {FEEDBACK_TYPE_LABELS[key]}
                </option>
              ))}
            </Select>
            <Select
              className="h-10 w-full min-w-0 text-sm sm:w-auto"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Öncelik filtresi"
            >
              <option value="">Tüm öncelikler</option>
              {(Object.keys(FEEDBACK_PRIORITY_LABELS) as FeedbackPriority[]).map((key) => (
                <option key={key} value={key}>
                  {FEEDBACK_PRIORITY_LABELS[key]}
                </option>
              ))}
            </Select>
            <Select
              className="h-10 w-full min-w-0 text-sm sm:w-auto"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Kategori filtresi"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setCategoriesOpen(true)}>
              Kategoriler
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Yeni Kayıt
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
              <TH>Kayıt</TH>
              <TH>Tür</TH>
              <TH>Konum</TH>
              <TH>İlgili Kişi</TH>
              <TH>Sorumlu</TH>
              <TH>Öncelik</TH>
              <TH>Durum</TH>
              <TH>Tarih</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                    <TD colSpan={9}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}

            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={9} className="py-8 text-center text-sm text-muted">
                  Bu sekmede kayıt bulunmuyor.
                </TD>
              </TR>
            ) : null}

            {!loading
              ? items.map((item) => (
                  <TR
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/app/bilgi-oneri/${item.id}`)}
                  >
                    <TD className="max-w-[260px] whitespace-normal">
                      <p className="font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {item.category?.name || "Kategorisiz"}
                      </p>
                    </TD>
                    <TD>{FEEDBACK_TYPE_LABELS[item.type]}</TD>
                    <TD>{item.locationLabel}</TD>
                    <TD>{item.person?.fullName || "—"}</TD>
                    <TD>{item.employee?.label || "—"}</TD>
                    <TD>
                      <Badge tone={priorityTone(item.priority)}>
                        {FEEDBACK_PRIORITY_LABELS[item.priority]}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(item.status)}>
                        {FEEDBACK_STATUS_LABELS[item.status]}
                      </Badge>
                    </TD>
                    <TD>{formatDateTr(item.createdAt)}</TD>
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
                        <DropdownItem href={`/app/bilgi-oneri/${item.id}`}>Detay</DropdownItem>
                        {item.status === "OPEN" || item.status === "IN_PROGRESS" ? (
                          <DropdownItem onClick={() => openEdit(item)}>Düzenle</DropdownItem>
                        ) : null}
                        {item.status === "RESOLVED" || item.status === "CLOSED" ? (
                          <DropdownItem danger onClick={() => setArchiving(item)}>
                            Arşivle
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

      <FeedbackFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        mode={editing ? "edit" : "create"}
        initialValues={editing ? feedbackToForm(editing) : emptyFeedbackForm(siteId ?? "")}
        categories={categories}
        pending={formPending}
        error={formError}
        siteLabel={editing?.site.name || site?.name}
        onClose={() => {
          if (!formPending) setFormOpen(false);
        }}
        onSubmit={handleSubmit}
        onOpenCategories={() => setCategoriesOpen(true)}
      />

      <FeedbackCategoriesModal
        open={categoriesOpen}
        auth={auth}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => {
          void loadCategories();
        }}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Kayıt arşivlensin mi?"
        description="Kayıt listeden kaldırılacaktır."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
        danger
        pending={archivePending}
        onConfirm={() => void handleArchive()}
        onClose={() => {
          if (!archivePending) setArchiving(null);
        }}
      />
    </PageContainer>
  );
}
