"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import {
  SiteFormModal,
  emptySiteForm,
  formToSitePayload,
  siteToForm,
  type SiteFormValues,
} from "@/components/sites/SiteFormModal";
import { SitesTable } from "@/components/sites/SitesTable";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { canManageSites } from "@/lib/permissions";
import { ApiError } from "@/lib/http";
import {
  createSite,
  deleteSite,
  listSites,
  updateSite,
  type Site,
} from "@/lib/sites-api";

const PER_PAGE = 20;

export function SitesPage() {
  const { ready, user } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: false });
  const { refreshSites, siteId, sites } = useActiveSite();
  const { openWizard } = useSiteSetupWizard();
  const canOpenWizard = canManageSites(user);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [archiving, setArchiving] = useState<Site | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  const [deleting, setDeleting] = useState<Site | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;

    if (!auth) {
      setLoading(false);
      setListError("Oturum alınamadı. Sayfayı yenileyip tekrar deneyin.");
      return;
    }

    setLoading(true);
    setListError("");
    try {
      const result = await listSites(auth, {
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
  }, [auth, ready, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function openCreate() {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(site: Site) {
    setEditing(site);
    setFormError("");
    setFormOpen(true);
  }

  function openWizardForSite(site: Site) {
    if (!canManageSites(user)) {
      showToast("Kurulum sihirbazını açma yetkiniz yok.", "error");
      return;
    }
    if (!site.isActive || !sites.some((item) => item.id === site.id)) {
      showToast("Sihirbaz yalnızca aktif siteler için açılabilir.", "error");
      return;
    }
    openWizard({ siteId: site.id });
  }

  async function handleSubmit(values: SiteFormValues) {
    if (formPending) return;
    if (!auth) {
      setFormError("Oturum yok. Sayfayı yenileyip tekrar deneyin.");
      return;
    }

    setFormPending(true);
    setFormError("");
    try {
      const payload = formToSitePayload(values);
      if (editing) {
        await updateSite(auth, editing.id, payload);
        showToast("Site güncellendi.");
        setFormOpen(false);
        setEditing(null);
        await refreshSites();
        await load();
      } else {
        const { site: created } = await createSite(auth, payload);
        showToast("Site oluşturuldu.");
        setFormOpen(false);
        setEditing(null);
        await refreshSites({
          preferSiteId: created.isActive !== false ? created.id : undefined,
        });
        await load();
        openWizard();
      }
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
      await updateSite(auth, archiving.id, {
        name: archiving.name,
        code: archiving.code,
        address: archiving.address,
        city: archiving.city,
        district: archiving.district,
        description: archiving.description,
        isActive: false,
      });
      showToast("Site arşivlendi.");
      const archivedId = archiving.id;
      setArchiving(null);
      await refreshSites({
        preferSiteId: siteId === archivedId ? undefined : siteId,
      });
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Site arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      const deletedId = deleting.id;
      await deleteSite(auth, deletedId);
      showToast("Site silindi.");
      setDeleting(null);
      await refreshSites({
        preferSiteId: siteId === deletedId ? undefined : siteId,
      });
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Site silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <PageContainer className="overflow-x-hidden">
      <PageHeader
        title="Siteler"
        description="Yönettiğiniz siteleri görüntüleyin ve düzenleyin."
        search={
          <SearchInput
            placeholder="Site ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
        actions={
          <Button type="button" className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="size-4" />
            Yeni Site
          </Button>
        }
      />

      {listError ? <p className="mb-4 text-sm text-danger">{listError}</p> : null}

      <SitesTable
        items={items}
        loading={loading}
        canOpenWizard={canOpenWizard}
        onEdit={openEdit}
        onOpenWizard={openWizardForSite}
        onArchive={(site) => setArchiving(site)}
        onDelete={(site) => setDeleting(site)}
      />

      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <SiteFormModal
        open={formOpen}
        title={editing ? "Siteyi Düzenle" : "Yeni Site"}
        initialValues={editing ? siteToForm(editing) : emptySiteForm()}
        pending={formPending}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Siteyi arşivle"
        description={
          archiving
            ? `"${archiving.name}" arşivlenecek. Site listesinde pasif görünür; bağlı kayıtlar silinmez.`
            : ""
        }
        confirmLabel="Arşivle"
        pending={archivePending}
        onConfirm={() => void handleArchive()}
        onClose={() => setArchiving(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Bu siteyi silmek istediğinize emin misiniz?"
        description={deleting ? deleting.name : ""}
        confirmLabel="Sil"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
