"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
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
  const { ready, token, tenantId } = useAuth();
  const { showToast } = useToast();
  const auth = useMemo(
    () => (token && tenantId ? { token, tenantId } : null),
    [token, tenantId],
  );

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

  const [deleting, setDeleting] = useState<Building | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      setListError("Sunucuya bağlanılamadı.");
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
  }, [auth, debouncedSearch, page]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function openCreate() {
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
    setFormPending(true);
    setFormError("");
    try {
      const payload = formToPayload(values);
      if (editing) {
        await updateBuilding(auth, editing.id, payload);
        showToast("Bina güncellendi.");
      } else {
        await createBuilding(auth, payload);
        showToast("Bina oluşturuldu.");
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
      showToast(error instanceof ApiError ? error.message : "Bina silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Binalar"
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

      <BuildingsTable items={items} loading={loading} onEdit={openEdit} onDelete={setDeleting} />
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <BuildingFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Binayı Düzenle" : "Yeni Bina"}
        initialValues={editing ? buildingToForm(editing) : emptyBuildingForm()}
        pending={formPending}
        error={formError}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Bina silinsin mi?"
        description="Bu bina pasif olarak arşivlenecek. Bu işlem bina listesinden kaydı kaldırır."
        confirmLabel="Binayı Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />
    </PageContainer>
  );
}
