"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListFilter, Plus } from "lucide-react";
import {
  ApartmentFormModal,
  apartmentFormToPayload,
  apartmentToForm,
  emptyApartmentForm,
  type ApartmentFormValues,
} from "@/components/apartments/ApartmentFormModal";
import { ApartmentsTable } from "@/components/apartments/ApartmentsTable";
import { DuesExemptionModal } from "@/components/apartments/DuesExemptionModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { BulkApartmentModal } from "@/components/setup/BulkApartmentModal";
import { SiteImportModal } from "@/components/setup/SiteImportModal";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilterChip } from "@/components/ui/FilterChip";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  createApartment,
  deleteApartment,
  listApartments,
  updateApartment,
  type Apartment,
} from "@/lib/apartments-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { hasPermission } from "@/lib/permissions";
import { ROOM_TYPES } from "@/lib/room-types";
import { useRouter } from "next/navigation";

const PER_PAGE = 20;

export function ApartmentsPage() {
  const { ready, user } = useAuth();
  const { showToast, toastError } = useToast();
  const router = useRouter();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites, status: siteStatus } = useActiveSite();
  const { openWizard } = useSiteSetupWizard();
  const canManageDues = hasPermission(user, "dues.manage") || !(user?.permissions?.length);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [buildingId, setBuildingId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [floor, setFloor] = useState("");
  const [roomType, setRoomType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Apartment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Apartment | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Apartment | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkBuildingId, setBulkBuildingId] = useState("");
  const [exemptionApartment, setExemptionApartment] = useState<Apartment | null>(null);
  const [exemptionMode, setExemptionMode] = useState<"create" | "edit">("create");

  const loadBuildings = useCallback(async () => {
    if (siteStatus !== "ready" || !auth || !siteId) {
      setBuildings([]);
      return;
    }
    try {
      const result = await listBuildings(auth, { status: "aktif", perPage: 100 });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    }
  }, [auth, siteId, siteStatus]);

  const load = useCallback(async () => {
    if (siteStatus === "loading" || !auth || !siteId) {
      setLoading(true);
      setItems([]);
      setTotal(0);
      setListError("");
      return;
    }

    setLoading(true);
    setListError("");
    try {
      const result = await listApartments(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
        buildingId: buildingId || undefined,
        floor: floor.trim() || undefined,
        roomType: roomType || undefined,
        status: status === "aktif" || status === "pasif" ? status : undefined,
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
  }, [auth, siteId, siteStatus, debouncedSearch, page, buildingId, floor, roomType, status]);

  useEffect(() => {
    if (!ready || siteStatus === "loading") return;
    void loadBuildings();
  }, [ready, siteStatus, loadBuildings]);

  useEffect(() => {
    if (!ready || siteStatus === "loading") return;
    void load();
  }, [ready, siteStatus, load]);

  useEffect(() => {
    setPage(1);
    setBuildingId("");
  }, [siteId, debouncedSearch, floor, roomType, status]);

  function openCreate() {
    if (!hasSites || !siteId) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(apartment: Apartment) {
    setEditing(apartment);
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit(values: ApartmentFormValues) {
    if (!auth || formPending) return;
    const targetSiteId = editing ? siteId : values.siteId;
    if (!targetSiteId) {
      setFormError("Site seçimi zorunludur.");
      return;
    }
    setFormPending(true);
    setFormError("");
    try {
      const payload = apartmentFormToPayload(values);
      const authForSite = { ...auth, siteId: targetSiteId };
      if (editing) {
        await updateApartment(authForSite, editing.id, payload);
        showToast("Daire güncellendi.");
      } else {
        await createApartment(authForSite, payload);
        showToast("Daire oluşturuldu.");
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
      await deleteApartment(auth, deleting.id);
      showToast("Daire silindi.");
      setDeleting(null);
      await load();
    } catch (error) {
      toastError(error, "Daire silinemedi.");
    } finally {
      setDeletePending(false);
    }
  }

  const filterCount = [floor, roomType, status].filter(Boolean).length;
  const showBuildingColumn = buildings.length > 1 && !buildingId;

  return (
    <PageContainer>
      <PageHeader
        title="Daireler"
        description={
          site?.name
            ? `${site.name} için bağımsız bölümleri yönetin.`
            : "Bağımsız bölümleri yönetin."
        }
        meta={`${total} daire`}
        chips={
          buildingId ? (
            <FilterChip
              label={`Bina: ${buildings.find((item) => item.id === buildingId)?.name ?? "Seçili"}`}
              onRemove={() => setBuildingId("")}
            />
          ) : null
        }
        search={
          <SearchInput
            placeholder="Daire ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Daire ara"
          />
        }
        actions={
          <>
            <Select
              className="w-full min-w-0 text-sm sm:w-auto"
              value={buildingId}
              onChange={(event) => setBuildingId(event.target.value)}
              aria-label="Bina filtresi"
            >
              <option value="">Tüm binalar</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}>
              <ListFilter className="size-4" aria-hidden />
              Filtre
              {filterCount > 0 ? <span className="text-brand">({filterCount})</span> : null}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Yeni Daire
            </Button>
            <Button
              variant="secondary"
              disabled={buildings.length === 0}
              onClick={() => {
                setBulkBuildingId(buildingId || buildings[0]?.id || "");
                setBulkOpen(true);
              }}
            >
              Toplu Daire Oluştur
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Excel / CSV İçe Aktar
            </Button>
          </>
        }
      />

      {filtersOpen ? (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-line bg-white p-3 sm:grid-cols-3">
          <Input
            
            placeholder="Kat"
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
            aria-label="Kat filtresi"
          />
          <Select className="text-sm" value={roomType} onChange={(event) => setRoomType(event.target.value)}>
            <option value="">Tüm oda tipleri</option>
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Select className="text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </Select>
        </div>
      ) : null}

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <ApartmentsTable
        items={items}
        loading={loading}
        showBuilding={showBuildingColumn}
        emptyLabel={
          buildings.length === 0
            ? "Önce bir bina oluşturun."
            : "Bu site için henüz daire oluşturulmamış."
        }
        canManageDues={canManageDues}
        onEdit={openEdit}
        onDelete={setDeleting}
        onManageResidents={(apartment) => router.push(`/app/daireler/${apartment.id}?tab=kisiler`)}
        onDefineExemption={(apartment) => {
          setExemptionMode("create");
          setExemptionApartment(apartment);
        }}
        onEditExemption={(apartment) => {
          setExemptionMode("edit");
          setExemptionApartment(apartment);
        }}
      />
      {!loading && !listError && buildings.length === 0 ? (
        <p className="mt-2 text-center text-sm">
          <Link href="/app/binalar" className="font-medium text-brand hover:underline">
            Binalar sayfasına git
          </Link>
        </p>
      ) : null}
      {!loading && buildings.length > 0 && items.length === 0 && !listError ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={openCreate}>Daire Oluştur</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setBulkBuildingId(buildingId || buildings[0]?.id || "");
              setBulkOpen(true);
            }}
          >
            Toplu Daire Oluştur
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Excel / CSV İçe Aktar
          </Button>
        </div>
      ) : null}
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <ApartmentFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Daireyi Düzenle" : "Yeni Daire"}
        initialValues={
          editing
            ? apartmentToForm(editing, siteId ?? "")
            : emptyApartmentForm(buildingId, siteId ?? "")
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
        title="Daire silinsin mi?"
        description="Bu daire arşivlenecek ve aktif listelerden kaldırılacak."
        confirmLabel="Daireyi Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />

      {bulkOpen && bulkBuildingId ? (
        <BulkApartmentModal
          open={bulkOpen}
          buildingId={bulkBuildingId}
          buildings={buildings.map((b) => ({ id: b.id, name: b.name }))}
          buildingName={buildings.find((b) => b.id === bulkBuildingId)?.name}
          onClose={() => setBulkOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}

      <SiteImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void loadBuildings();
          void load();
        }}
      />

      <DuesExemptionModal
        open={Boolean(exemptionApartment)}
        mode={exemptionMode}
        apartment={exemptionApartment}
        siteName={site?.name}
        auth={auth}
        onClose={() => setExemptionApartment(null)}
        onSaved={() => {
          showToast(exemptionMode === "edit" ? "Muafiyet güncellendi." : "Muafiyet tanımlandı.");
          void load();
        }}
      />
    </PageContainer>
  );
}
