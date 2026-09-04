"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  BuildingFormModal,
  buildingToForm,
  emptyBuildingForm,
  formToPayload,
  type BuildingFormValues,
} from "@/components/buildings/BuildingFormModal";
import { BuildingsTable } from "@/components/buildings/BuildingsTable";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  createBuilding,
  deleteBuilding,
  listBuildings,
  updateBuilding,
  type Building,
} from "@/lib/buildings-api";

const PER_PAGE = 20;

export function BuildingsPage() {
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites, status } = useActiveSite();
  const { openWizard } = useSiteSetupWizard();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Building[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [deleting, setDeleting] = useState<Building | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    // Bootstrap bitmeden veya activeSite yokken istek atma / "site yok" empty state gösterme.
    if (status === "loading" || !auth || !siteId) {
      setLoading(true);
      setItems([]);
      setTotal(0);
      setListError("");
      return;
    }

    setLoading(true);
    setListError("");
    try {
      const result = await listBuildings(auth, {
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
  }, [auth, siteId, status, debouncedSearch, page]);

  useEffect(() => {
    if (!ready || status === "loading") return;
    void load();
  }, [ready, status, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, siteId]);

  function openCreate() {
    if (!hasSites || !siteId) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(building: Building) {
    setEditing(building);
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit(values: BuildingFormValues) {
    if (!auth || formPending) return;
    const targetSiteId = editing ? siteId : values.siteId;
    if (!targetSiteId) {
      setFormError("Site seçimi zorunludur.");
      return;
    }
    setFormPending(true);
    setFormError("");
    try {
      const payload = formToPayload(values, { clearInheritedAddress: Boolean(editing) });
      const authForSite = { ...auth, siteId: targetSiteId };
      if (editing) {
        await updateBuilding(authForSite, editing.id, payload);
        showToast("Bina bilgileri güncellendi.");
      } else {
        await createBuilding(authForSite, payload);
        showToast("Bina başarıyla oluşturuldu.");
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

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      await deleteBuilding(auth, deleting.id);
      showToast("Bina silindi.");
      setDeleting(null);
      await load();
    } catch (error) {
      toastError(error, "Bina silinemedi.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Binalar"
        description={
          site?.name ? `${site.name} için bina ve blokları yönetin.` : "Bina ve blokları yönetin."
        }
        search={
          <SearchInput
            placeholder="Bina ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Bina ara"
          />
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Yeni Bina
          </Button>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <BuildingsTable
        items={items}
        loading={loading}
        emptyLabel={
          hasSites
            ? "Bu site için henüz bina/blok oluşturulmamış."
            : "Henüz bina bulunmuyor."
        }
        onEdit={openEdit}
        onDelete={setDeleting}
      />

      {!loading && hasSites && items.length === 0 && !listError ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={openCreate}>Bina Oluştur</Button>
          <Button variant="secondary" onClick={() => openWizard()}>
            Site Kurulumunu Tamamla
          </Button>
        </div>
      ) : null}
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <BuildingFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Binayı Düzenle" : "Yeni Bina"}
        initialValues={
          editing
            ? buildingToForm(editing, siteId ?? "")
            : emptyBuildingForm(siteId ?? "")
        }
        pending={formPending}
        error={formError}
        siteLabel={site?.name}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Bina silinsin mi?"
        description="Bu bina pasif olarak arşivlenecek. Bu işlem bina listesinden kaydı kaldırır."
        confirmLabel="Binayı Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        pendingLabel="Siliniyor…"
        alert="Bu işlem geri alınamaz."
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />
    </PageContainer>
  );
}
