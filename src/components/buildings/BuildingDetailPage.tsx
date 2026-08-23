"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import {
  ApartmentFormModal,
  apartmentFormToPayload,
  apartmentToForm,
  emptyApartmentForm,
  type ApartmentFormValues,
} from "@/components/apartments/ApartmentFormModal";
import { ApartmentsTable } from "@/components/apartments/ApartmentsTable";
import {
  AssetFormModal,
  assetFormToPayload,
  assetPayloadForCreate,
  emptyAssetForm,
  type AssetFormValues,
} from "@/components/assets/AssetFormModal";
import {
  BuildingFormModal,
  buildingToForm,
  formToPayload,
  type BuildingFormValues,
} from "@/components/buildings/BuildingFormModal";
import { BulkApartmentModal } from "@/components/setup/BulkApartmentModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  effectiveBuildingAddress,
  formatAddressDisplay,
} from "@/lib/building-address";
import { ApiError } from "@/lib/http";
import {
  createApartment,
  deleteApartment,
  listApartments,
  updateApartment,
  type Apartment,
} from "@/lib/apartments-api";
import {
  ASSET_STATUS_LABELS,
  createAsset,
  listAssetCategories,
  listAssets,
  type Asset,
  type AssetCategory,
} from "@/lib/assets-api";
import { getBuilding, updateBuilding, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "daireler", label: "Daireler" },
  { id: "demirbaslar", label: "Demirbaşlar" },
  { id: "hareketler", label: "Hareketler" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function BuildingDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth();
  const { site, siteId } = useActiveSite();

  const [building, setBuilding] = useState<Building | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
  const [apartmentFormOpen, setApartmentFormOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [apartmentPending, setApartmentPending] = useState(false);
  const [apartmentError, setApartmentError] = useState("");
  const [deletingApartment, setDeletingApartment] = useState<Apartment | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [assetPending, setAssetPending] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [bulkApartmentOpen, setBulkApartmentOpen] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getBuilding(auth, params.id);
      setBuilding(result.building);
    } catch (err) {
      setBuilding(null);
      setError(err instanceof ApiError ? err.message : "Bina yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadApartments = useCallback(async () => {
    if (!auth || !params.id) return;
    setApartmentsLoading(true);
    try {
      const result = await listApartments(auth, { buildingId: params.id, perPage: 100 });
      setApartments(result.items);
    } catch {
      setApartments([]);
    } finally {
      setApartmentsLoading(false);
    }
  }, [auth, params.id]);

  const loadAssets = useCallback(async () => {
    if (!auth || !params.id) return;
    setAssetsLoading(true);
    try {
      const [assetsResult, categoriesResult] = await Promise.all([
        listAssets(auth, { buildingId: params.id, perPage: 100 }),
        listAssetCategories(auth, { status: "hepsi" }),
      ]);
      setAssets(assetsResult.items);
      setAssetCategories(categoriesResult.items);
    } catch {
      setAssets([]);
      setAssetCategories([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || tab !== "daireler") return;
    void loadApartments();
  }, [ready, tab, loadApartments]);

  useEffect(() => {
    if (!ready || tab !== "demirbaslar") return;
    void loadAssets();
  }, [ready, tab, loadAssets]);

  async function handleSubmit(values: BuildingFormValues) {
    if (!auth || !building || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const result = await updateBuilding(
        auth,
        building.id,
        formToPayload(values, { clearInheritedAddress: true }),
      );
      setBuilding(result.building);
      setFormOpen(false);
      showToast("Bina güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleApartmentSubmit(values: ApartmentFormValues) {
    if (!auth || !building || apartmentPending) return;
    const targetSiteId = values.siteId || siteId;
    if (!targetSiteId) {
      setApartmentError("Site seçimi zorunludur.");
      return;
    }
    setApartmentPending(true);
    setApartmentError("");
    try {
      const payload = apartmentFormToPayload(values);
      const authForSite = { ...auth, siteId: targetSiteId };
      if (editingApartment) {
        await updateApartment(authForSite, editingApartment.id, payload);
        showToast("Daire güncellendi.");
      } else {
        await createApartment(authForSite, payload);
        showToast("Daire oluşturuldu.");
      }
      setApartmentFormOpen(false);
      setEditingApartment(null);
      await Promise.all([load(), loadApartments()]);
    } catch (err) {
      setApartmentError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setApartmentPending(false);
    }
  }

  async function handleApartmentDelete() {
    if (!auth || !deletingApartment || deletePending) return;
    setDeletePending(true);
    try {
      await deleteApartment(auth, deletingApartment.id);
      showToast("Daire silindi.");
      setDeletingApartment(null);
      await Promise.all([load(), loadApartments()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Daire silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleAssetSubmit(values: AssetFormValues) {
    if (!auth || !building || assetPending) return;
    const targetSiteId = values.siteId || siteId;
    if (!targetSiteId) {
      setAssetError("Site seçimi zorunludur.");
      return;
    }
    setAssetPending(true);
    setAssetError("");
    try {
      await createAsset(
        { ...auth, siteId: targetSiteId },
        assetPayloadForCreate(
          assetFormToPayload({ ...values, buildingId: building.id, siteId: targetSiteId }),
        ),
      );
      showToast("Demirbaş oluşturuldu.");
      setAssetFormOpen(false);
      await loadAssets();
    } catch (err) {
      setAssetError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setAssetPending(false);
    }
  }

  const addressDisplay = building
    ? formatAddressDisplay(effectiveBuildingAddress(building, site))
    : { primary: "—" };
  const registered = building?.registeredApartmentCount ?? apartments.length;
  const capacity = building?.apartmentCount ?? null;
  const overCapacity = capacity != null && registered > capacity;

  return (
    <PageContainer>
      <Link
        href="/app/binalar"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Binalar
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {building ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-[24px] font-semibold leading-none text-ink">{building.name}</h1>
            <Button onClick={() => setFormOpen(true)}>Düzenle</Button>
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-line pb-5 md:grid-cols-5">
            <InfoItem label="Bina kodu" value={building.code || "—"} />
            <InfoItem
              label="Daireler"
              value={
                <span className={overCapacity ? "font-medium text-warning" : undefined}>
                  {capacity != null
                    ? `${registered} / ${capacity} daire kayıtlı`
                    : `${registered} daire kayıtlı`}
                </span>
              }
            />
            <InfoItem
              label="Kat sayısı"
              value={building.floorCount != null ? String(building.floorCount) : "—"}
            />
            <div>
              <dt className="text-xs text-muted">Durum</dt>
              <dd className="mt-0.5">
                <StatusBadge active={building.isActive} />
              </dd>
            </div>
            <InfoItem
              label="Adres"
              value={
                addressDisplay.secondary
                  ? `${addressDisplay.primary} · ${addressDisplay.secondary}`
                  : addressDisplay.primary
              }
            />
            <InfoItem
              label="Daire kapasitesi"
              value={capacity != null ? String(capacity) : "Belirtilmedi"}
            />
          </dl>

          {overCapacity ? (
            <p className="mb-4 text-[13px] text-warning">
              Kayıtlı daire sayısı bina kapasitesini aşıyor.
            </p>
          ) : null}

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

          {tab === "genel" ? (
            <p className="text-sm text-muted">
              {building.description || "Bu bina için henüz açıklama girilmedi."}
            </p>
          ) : null}

          {tab === "daireler" ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">Daireler</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setBulkApartmentOpen(true)}
                  >
                    Toplu Daire Oluştur
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingApartment(null);
                      setApartmentError("");
                      setApartmentFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Yeni Daire
                  </Button>
                </div>
              </div>
              <ApartmentsTable
                items={apartments}
                loading={apartmentsLoading}
                showBuilding={false}
                onEdit={(apartment) => {
                  setEditingApartment(apartment);
                  setApartmentError("");
                  setApartmentFormOpen(true);
                }}
                onDelete={setDeletingApartment}
              />
            </div>
          ) : null}

          {tab === "demirbaslar" ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Demirbaşlar</h2>
                <Button
                  size="sm"
                  onClick={() => {
                    setAssetError("");
                    setAssetFormOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Yeni Demirbaş
                </Button>
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Demirbaş</TH>
                      <TH>Kategori</TH>
                      <TH>Konum</TH>
                      <TH>Adet</TH>
                      <TH className="text-right">Değer</TH>
                      <TH>Durum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {assetsLoading
                      ? Array.from({ length: 4 }).map((_, index) => (
                          <TR key={`as-${index}`} className="hover:bg-transparent">
                            <TD colSpan={6}>
                              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                            </TD>
                          </TR>
                        ))
                      : null}
                    {!assetsLoading && assets.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                          Henüz demirbaş bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!assetsLoading
                      ? assets.map((asset) => (
                          <TR key={asset.id}>
                            <TD>
                              <Link
                                href={`/app/demirbaslar/${asset.id}`}
                                className="font-medium hover:text-brand"
                              >
                                {asset.name}
                              </Link>
                              {asset.code ? (
                                <p className="text-xs text-muted">{asset.code}</p>
                              ) : null}
                            </TD>
                            <TD>{asset.category?.name || "—"}</TD>
                            <TD>{asset.location || "—"}</TD>
                            <TD>
                              {asset.quantity}
                              {asset.unit ? ` ${asset.unit}` : ""}
                            </TD>
                            <TD className="text-right">
                              {asset.currentValue != null
                                ? formatMoney(asset.currentValue)
                                : "—"}
                            </TD>
                            <TD>{ASSET_STATUS_LABELS[asset.status]}</TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>
            </div>
          ) : null}

          {tab === "hareketler" ? (
            <p className="py-6 text-sm text-muted">Henüz hareket bulunmuyor.</p>
          ) : null}

          <BuildingFormModal
            open={formOpen}
            title="Binayı Düzenle"
            initialValues={buildingToForm(building)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <ApartmentFormModal
            key={editingApartment?.id ?? `new-${building.id}`}
            open={apartmentFormOpen}
            title={editingApartment ? "Daireyi Düzenle" : "Yeni Daire"}
            buildings={[building]}
            lockSite
            lockBuilding
            siteLabel={site?.name}
            buildingLabel={building.name}
            initialValues={
              editingApartment
                ? apartmentToForm(editingApartment, siteId ?? "")
                : emptyApartmentForm(building.id, siteId ?? "")
            }
            pending={apartmentPending}
            error={apartmentError}
            onClose={() => (apartmentPending ? undefined : setApartmentFormOpen(false))}
            onSubmit={handleApartmentSubmit}
          />

          <AssetFormModal
            key={`asset-new-${building.id}`}
            open={assetFormOpen}
            title="Yeni Demirbaş"
            categories={assetCategories}
            auth={auth}
            lockSite
            lockBuilding
            siteLabel={site?.name}
            initialValues={emptyAssetForm({
              siteId: siteId ?? "",
              buildingId: building.id,
            })}
            pending={assetPending}
            error={assetError}
            onCategoriesChanged={() => void loadAssets()}
            onClose={() => (assetPending ? undefined : setAssetFormOpen(false))}
            onSubmit={handleAssetSubmit}
          />

          <BulkApartmentModal
            open={bulkApartmentOpen}
            buildingId={building.id}
            buildingName={building.name}
            onClose={() => setBulkApartmentOpen(false)}
            onCreated={() => void Promise.all([load(), loadApartments()])}
          />

          <ConfirmDialog
            open={Boolean(deletingApartment)}
            title="Daire silinsin mi?"
            description="Bu daire arşivlenecek ve aktif listelerden kaldırılacak."
            confirmLabel="Daireyi Sil"
            cancelLabel="Vazgeç"
            danger
            pending={deletePending}
            onConfirm={() => void handleApartmentDelete()}
            onClose={() => (deletePending ? undefined : setDeletingApartment(null))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
