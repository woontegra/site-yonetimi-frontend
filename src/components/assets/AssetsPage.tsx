"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { AssetCategoriesModal } from "@/components/assets/AssetCategoriesModal";
import {
  AssetFormModal,
  assetFormToPayload,
  assetPayloadForCreate,
  assetToForm,
  emptyAssetForm,
  type AssetFormValues,
} from "@/components/assets/AssetFormModal";
import { AssetLocationModal } from "@/components/assets/AssetLocationModal";
import { AssetStatusModal } from "@/components/assets/AssetStatusModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { canManageAssets } from "@/lib/permissions";
import {
  archiveAsset,
  ASSET_STATUS_LABELS,
  changeAssetLocation,
  changeAssetStatus,
  createAsset,
  deleteAsset,
  getAsset,
  listAssetCategories,
  listAssets,
  updateAsset,
  type Asset,
  type AssetCategory,
  type AssetStatus,
} from "@/lib/assets-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";

const PER_PAGE = 20;
const UPCOMING_MAINTENANCE_DAYS = 30;
/** Durum filtresinde "Yaklaşan Bakım" ayrı bir seçenek olarak sunulur. */
const UPCOMING_FILTER_VALUE = "__upcoming__";

export function AssetsPage() {
  const { ready, user } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();
  const canDelete = canManageAssets(user);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [categoryId, setCategoryId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ inMaintenance: number; outOfService: number } | null>(
    null,
  );
  const [totalCurrentValue, setTotalCurrentValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Asset | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [locationTarget, setLocationTarget] = useState<Asset | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [archiving, setArchiving] = useState<Asset | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [disposing, setDisposing] = useState<Asset | null>(null);
  const [disposePending, setDisposePending] = useState(false);

  const loadMeta = useCallback(async () => {
    if (!auth) return;
    try {
      const [buildingsResult, categoriesResult] = await Promise.all([
        listBuildings(auth, { status: "aktif", perPage: 100 }),
        listAssetCategories(auth, { status: "hepsi" }),
      ]);
      setBuildings(buildingsResult.items);
      setCategories(categoriesResult.items);
    } catch {
      setBuildings([]);
      setCategories([]);
    }
  }, [auth]);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      setListError("Sunucuya bağlanılamadı.");
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const upcomingOnly = status === UPCOMING_FILTER_VALUE;
      const result = await listAssets(auth, {
        search: debouncedSearch.trim() || undefined,
        categoryId: categoryId || undefined,
        buildingId: buildingId || undefined,
        status: upcomingOnly ? undefined : (status as AssetStatus) || undefined,
        upcomingMaintenanceDays: upcomingOnly ? UPCOMING_MAINTENANCE_DAYS : undefined,
        page,
        perPage: PER_PAGE,
      });
      setItems(result.items);
      setTotal(result.total);
      setSummary(result.summary ?? null);
      setTotalCurrentValue(result.totalCurrentValue);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setSummary(null);
      setTotalCurrentValue(null);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, categoryId, buildingId, status, page]);

  useEffect(() => {
    if (!ready) return;
    void loadMeta();
  }, [ready, loadMeta]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, buildingId, status]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  async function openEdit(asset: Asset) {
    if (!auth) return;
    setFormError("");
    try {
      const result = await getAsset(auth, asset.id);
      setEditing(result.asset);
      setFormOpen(true);
    } catch (error) {
      toastError(error, "Demirbaş yüklenemedi.");
    }
  }

  async function handleSubmit(values: AssetFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const payload = assetFormToPayload(values);
      if (editing) {
        await updateAsset(auth, editing.id, payload);
        showToast("Demirbaş güncellendi.");
      } else {
        if (!values.siteId) {
          setFormError("Site seçimi zorunludur.");
          setFormPending(false);
          return;
        }
        await createAsset(
          { ...auth, siteId: values.siteId },
          assetPayloadForCreate(payload),
        );
        showToast("Demirbaş oluşturuldu.");
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

  async function handleStatusSubmit(payload: { status: AssetStatus; note?: string }) {
    if (!auth || !statusTarget || statusPending) return;
    setStatusPending(true);
    setStatusError("");
    try {
      await changeAssetStatus(auth, statusTarget.id, payload);
      showToast("Durum güncellendi.");
      setStatusTarget(null);
      await load();
    } catch (error) {
      setStatusError(error instanceof ApiError ? error.message : "Durum güncellenemedi.");
    } finally {
      setStatusPending(false);
    }
  }

  async function handleLocationSubmit(payload: {
    buildingId: string | null;
    location: string | null;
    note?: string;
  }) {
    if (!auth || !locationTarget || locationPending) return;
    setLocationPending(true);
    setLocationError("");
    try {
      await changeAssetLocation(auth, locationTarget.id, payload);
      showToast("Konum güncellendi.");
      setLocationTarget(null);
      await load();
    } catch (error) {
      setLocationError(error instanceof ApiError ? error.message : "Konum güncellenemedi.");
    } finally {
      setLocationPending(false);
    }
  }

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      await deleteAsset(auth, deleting.id);
      showToast("Demirbaş silindi.");
      setDeleting(null);
      await load();
    } catch (error) {
      toastError(error, "Demirbaş silinemedi.");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !archiving || archivePending) return;
    setArchivePending(true);
    try {
      await archiveAsset(auth, archiving.id);
      showToast("Demirbaş arşivlendi.");
      setArchiving(null);
      await load();
    } catch (error) {
      toastError(error, "Demirbaş arşivlenemedi.");
    } finally {
      setArchivePending(false);
    }
  }

  async function handleDispose() {
    if (!auth || !disposing || disposePending) return;
    setDisposePending(true);
    try {
      await changeAssetStatus(auth, disposing.id, { status: "DISPOSED" });
      showToast("Demirbaş elden çıkarıldı.");
      setDisposing(null);
      await load();
    } catch (error) {
      toastError(error, "Demirbaş elden çıkarılamadı.");
    } finally {
      setDisposePending(false);
    }
  }

  const summaryParts = [`${total} demirbaş`];
  if (summary && summary.inMaintenance > 0) {
    summaryParts.push(`${summary.inMaintenance} bakımda`);
  }
  if (summary && summary.outOfService > 0) {
    summaryParts.push(`${summary.outOfService} kullanım dışı`);
  }
  if (totalCurrentValue != null && totalCurrentValue !== "") {
    summaryParts.push(`${formatMoney(totalCurrentValue)} kayıtlı güncel değer`);
  }

  const filtersActive = Boolean(debouncedSearch.trim() || categoryId || buildingId || status);
  const showEmptyState = !loading && !listError && items.length === 0 && !filtersActive;

  return (
    <PageContainer>
      <PageHeader
        title="Demirbaşlar"
        description={
          site?.name
            ? `${site.name} için gerçek demirbaş kayıtlarını yönetin. Kategoriler yalnızca sınıflandırmadır.`
            : "Gerçek demirbaş kayıtlarını yönetin. Kategoriler yalnızca sınıflandırmadır."
        }
        meta={summaryParts.join(" · ")}
        search={
          <SearchInput
            placeholder="Demirbaş ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Demirbaş ara"
          />
        }
        actions={
          <>
            <Select
              className="w-full min-w-0 text-sm sm:w-auto"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              className="w-full min-w-0 text-sm sm:w-auto"
              value={buildingId}
              onChange={(event) => setBuildingId(event.target.value)}
            >
              <option value="">Tüm binalar</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </Select>
            <Select
              className="w-full min-w-0 text-sm sm:w-auto"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Tüm durumlar</option>
              {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((item) => (
                <option key={item} value={item}>
                  {ASSET_STATUS_LABELS[item]}
                </option>
              ))}
              <option value={UPCOMING_FILTER_VALUE}>Yaklaşan Bakım</option>
            </Select>
            <Button variant="secondary" onClick={() => setCategoriesOpen(true)}>
              Kategoriler
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Yeni Demirbaş
            </Button>
          </>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      {showEmptyState ? (
        <SurfaceCard tone="amber" className="flex flex-col items-center">
          <TableEmptyState
            title="Henüz demirbaş eklenmedi."
            description="Kategoriler hazır. İlk demirbaşınızı ekleyerek kamera, yangın tüpü, bahçe ekipmanı ve diğer site varlıklarını takip edebilirsiniz."
          />
          <Button className="mb-6" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Yeni Demirbaş Ekle
          </Button>
        </SurfaceCard>
      ) : (
      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Demirbaş</TH>
              <TH>Kategori</TH>
              <TH>Konum</TH>
              <TH>Bina</TH>
              <TH>Adet</TH>
              <TH className="text-right">Değer</TH>
              <TH>Son Bakım</TH>
              <TH>Durum</TH>
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
                  {filtersActive ? "Bu filtrelere uyan demirbaş yok." : "Henüz demirbaş bulunmuyor."}
                </TD>
              </TR>
            ) : null}

            {!loading
              ? items.map((asset) => (
                  <TR key={asset.id}>
                    <TD>
                      <Link href={`/app/demirbaslar/${asset.id}`} className="font-medium hover:text-brand">
                        {asset.name}
                      </Link>
                      {asset.code ? <p className="text-xs text-muted">{asset.code}</p> : null}
                    </TD>
                    <TD>{asset.category?.name || "—"}</TD>
                    <TD>{asset.location || "—"}</TD>
                    <TD>
                      {asset.building?.name || "Site Geneli"}
                      {asset.apartment ? (
                        <p className="text-xs text-muted">Daire {asset.apartment.number}</p>
                      ) : null}
                    </TD>
                    <TD>
                      {asset.quantity}
                      {asset.unit ? ` ${asset.unit}` : ""}
                    </TD>
                    <TD className="text-right">
                      {asset.currentValue != null ? formatMoney(asset.currentValue) : "—"}
                    </TD>
                    <TD>{formatDateTr(asset.lastMaintenanceDate)}</TD>
                    <TD>{ASSET_STATUS_LABELS[asset.status]}</TD>
                    <TD className="text-right">
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label={`${asset.name} işlemleri`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/demirbaslar/${asset.id}`}>Detay</DropdownItem>
                        <DropdownItem onClick={() => void openEdit(asset)}>Düzenle</DropdownItem>
                        <DropdownItem
                          onClick={() => {
                            setStatusError("");
                            setStatusTarget(asset);
                          }}
                        >
                          Durumu Değiştir
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => {
                            setLocationError("");
                            setLocationTarget(asset);
                          }}
                        >
                          Konumu Değiştir
                        </DropdownItem>
                        {asset.status !== "DISPOSED" ? (
                          <DropdownItem onClick={() => setDisposing(asset)}>
                            Elden Çıkar
                          </DropdownItem>
                        ) : null}
                        <DropdownItem onClick={() => setArchiving(asset)}>Arşivle</DropdownItem>
                        {canDelete ? (
                          <DropdownItem danger onClick={() => setDeleting(asset)}>
                            Sil
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
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <AssetFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Demirbaşı Düzenle" : "Yeni Demirbaş"}
        categories={categories}
        auth={auth}
        showStatus={Boolean(editing)}
        initialValues={
          editing
            ? assetToForm(editing, siteId ?? "")
            : emptyAssetForm({ siteId: siteId ?? "" })
        }
        pending={formPending}
        error={formError}
        onCategoriesChanged={() => void loadMeta()}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />
      <AssetCategoriesModal
        open={categoriesOpen}
        auth={auth}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => void loadMeta()}
      />

      <AssetStatusModal
        open={Boolean(statusTarget)}
        currentStatus={statusTarget?.status ?? "ACTIVE"}
        pending={statusPending}
        error={statusError}
        onClose={() => (statusPending ? undefined : setStatusTarget(null))}
        onSubmit={handleStatusSubmit}
      />

      <AssetLocationModal
        open={Boolean(locationTarget)}
        buildings={buildings}
        initialBuildingId={locationTarget?.buildingId ?? locationTarget?.building?.id ?? ""}
        initialLocation={locationTarget?.location ?? ""}
        pending={locationPending}
        error={locationError}
        onClose={() => (locationPending ? undefined : setLocationTarget(null))}
        onSubmit={handleLocationSubmit}
      />

      <ConfirmDialog
        open={Boolean(disposing)}
        title="Demirbaş elden çıkarılsın mı?"
        description="Demirbaş durumu Elden Çıkarıldı olarak güncellenecek ve hareket geçmişine kaydedilecektir."
        confirmLabel="Elden Çıkar"
        cancelLabel="Vazgeç"
        pending={disposePending}
        onConfirm={() => void handleDispose()}
        onClose={() => (disposePending ? undefined : setDisposing(null))}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Demirbaş arşivlensin mi?"
        description="Demirbaş aktif listeden kaldırılacak ancak geçmiş hareketleri korunacaktır."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
        pending={archivePending}
        onConfirm={() => void handleArchive()}
        onClose={() => (archivePending ? undefined : setArchiving(null))}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Demirbaşı silmek istediğinize emin misiniz?"
        description={deleting ? `"${deleting.name}" ve bağlı hareket/bakım kayıtları kalıcı olarak silinecektir.` : ""}
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />
    </PageContainer>
  );
}
