"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  DoorOpen,
  FileText,
  History,
  LayoutGrid,
  Layers,
  MoreHorizontal,
  Package,
  Pencil,
  Percent,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BulkApartmentModal } from "@/components/setup/BulkApartmentModal";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import {
  EntityIcon,
  dash,
  siteLocation,
} from "@/components/sites/site-ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
import {
  deleteBuilding,
  getBuilding,
  updateBuilding,
  type Building,
} from "@/lib/buildings-api";
import { canManageSites } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";

const tabs = [
  { id: "genel", label: "Genel Bakış", icon: LayoutGrid },
  { id: "daireler", label: "Daireler", icon: DoorOpen },
  { id: "demirbaslar", label: "Demirbaşlar", icon: Package },
  { id: "hareketler", label: "Hareketler", icon: History },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function BuildingDetailPage() {
  const params = useParams<{ id: string }>();
  const buildingId = String(params.id);
  const { ready, user } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth();
  const { site, siteId } = useActiveSite();
  const { openWizard } = useSiteSetupWizard();
  const canManage = canManageSites(user);

  const [building, setBuilding] = useState<Building | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
  const [apartmentSearch, setApartmentSearch] = useState("");
  const debouncedApartmentSearch = useDebouncedValue(apartmentSearch, 300);
  const [apartmentStatus, setApartmentStatus] = useState<"hepsi" | "aktif" | "pasif">("hepsi");
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

  const [archiving, setArchiving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [deletingBuilding, setDeletingBuilding] = useState(false);
  const [buildingDeletePending, setBuildingDeletePending] = useState(false);

  useEffect(() => {
    setTab("genel");
    setBuilding(null);
    setError("");
    setApartmentSearch("");
    setApartmentStatus("hepsi");
  }, [buildingId]);

  const load = useCallback(async () => {
    if (!auth || !buildingId) return;
    setError("");
    try {
      const result = await getBuilding(auth, buildingId);
      setBuilding(result.building);
    } catch (err) {
      setBuilding(null);
      setError(err instanceof ApiError ? err.message : "Bina yüklenemedi.");
    }
  }, [auth, buildingId]);

  const loadApartments = useCallback(async () => {
    if (!auth || !buildingId) return;
    setApartmentsLoading(true);
    try {
      const result = await listApartments(auth, {
        buildingId,
        perPage: 100,
        search: debouncedApartmentSearch.trim() || undefined,
        status: apartmentStatus === "hepsi" ? undefined : apartmentStatus,
      });
      setApartments(result.items);
    } catch {
      setApartments([]);
    } finally {
      setApartmentsLoading(false);
    }
  }, [auth, buildingId, debouncedApartmentSearch, apartmentStatus]);

  const loadAssets = useCallback(async () => {
    if (!auth || !buildingId) return;
    setAssetsLoading(true);
    try {
      const [assetsResult, categoriesResult] = await Promise.all([
        listAssets(auth, { buildingId, perPage: 100 }),
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
  }, [auth, buildingId]);

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

  async function handleToggleActive(nextActive: boolean) {
    if (!auth || !building || statusPending) return;
    setStatusPending(true);
    try {
      const result = await updateBuilding(auth, building.id, {
        name: building.name,
        code: building.code ?? undefined,
        address: building.address,
        city: building.city,
        district: building.district,
        description: building.description ?? undefined,
        apartmentCount: building.apartmentCount,
        floorCount: building.floorCount,
        isActive: nextActive,
      });
      setBuilding(result.building);
      setArchiving(false);
      setActivating(false);
      showToast(nextActive ? "Bina aktifleştirildi." : "Bina arşivlendi.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Durum güncellenemedi.", "error");
    } finally {
      setStatusPending(false);
    }
  }

  async function handleBuildingDelete() {
    if (!auth || !building || buildingDeletePending) return;
    setBuildingDeletePending(true);
    try {
      await deleteBuilding(auth, building.id);
      showToast("Bina silindi.");
      setDeletingBuilding(false);
      window.location.href = "/app/binalar";
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Bina silinemedi.", "error");
    } finally {
      setBuildingDeletePending(false);
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

  function openAddApartment() {
    setEditingApartment(null);
    setApartmentError("");
    setApartmentFormOpen(true);
  }

  function openWizardForSite() {
    if (!canManage || !siteId) {
      showToast("Kurulum sihirbazını açma yetkiniz yok.", "error");
      return;
    }
    openWizard({ siteId });
  }

  const addressParts = useMemo(() => {
    if (!building) return { primary: "—", secondary: undefined as string | undefined, city: "", district: "", address: "" };
    const effective = effectiveBuildingAddress(building, site);
    const display = formatAddressDisplay(effective);
    return {
      ...display,
      city: effective.city ?? "",
      district: effective.district ?? "",
      address: effective.address ?? "",
    };
  }, [building, site]);

  const registered = building?.registeredApartmentCount ?? 0;
  const capacity = building?.apartmentCount ?? null;
  const overCapacity = capacity != null && registered > capacity;
  const locationLabel = site ? siteLocation(site) : [addressParts.city, addressParts.district].filter(Boolean).join(" / ");

  if (error) {
    return (
      <PageContainer>
        <p className="text-sm text-danger">{error}</p>
        <Link href="/app/binalar" className="mt-4 inline-flex text-sm text-muted hover:text-ink">
          ← Binalar
        </Link>
      </PageContainer>
    );
  }

  if (!building) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Yükleniyor…</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/binalar"
        backLabel="Binalar"
        leading={<EntityIcon icon={Building2} className="size-12 rounded-2xl" />}
        title={building.name}
        description={
          <span className="flex flex-col gap-0.5">
            {site?.name ? <span>{site.name}</span> : null}
            {locationLabel ? <span>{locationLabel}</span> : null}
          </span>
        }
        status={<StatusBadge active={building.isActive} />}
        actions={
          <>
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setFormOpen(true)}>
              <Pencil className="size-3.5" aria-hidden />
              Düzenle
            </Button>
            <Dropdown
              align="right"
              menuClassName="min-w-[12rem]"
              trigger={
                <Button type="button" variant="secondary" className="w-full sm:w-auto" aria-label="Diğer işlemler">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            >
              <DropdownItem onClick={openAddApartment}>Daire Ekle</DropdownItem>
              {building.isActive ? (
                <DropdownItem onClick={() => setArchiving(true)}>Arşivle</DropdownItem>
              ) : (
                <DropdownItem onClick={() => setActivating(true)}>Aktifleştir</DropdownItem>
              )}
              <DropdownItem danger onClick={() => setDeletingBuilding(true)}>
                Binayı Sil
              </DropdownItem>
            </Dropdown>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <CompactStat
          icon={Layers}
          label="Daire kapasitesi"
          value={capacity != null ? String(capacity) : "—"}
          hint="Kapasite alanı (kayıt değil)"
        />
        <CompactStat
          icon={DoorOpen}
          label="Kayıtlı daire"
          value={capacity != null ? `${registered} / ${capacity}` : String(registered)}
          hint={overCapacity ? "Kapasite aşıldı" : "Gerçek Apartment satırı"}
        />
        <CompactStat
          icon={Building2}
          label="Kat sayısı"
          value={building.floorCount != null ? String(building.floorCount) : "—"}
        />
        <CompactStat icon={Percent} label="Doluluk" value="—" hint="Henüz veri yok" />
      </div>

      {capacity != null && capacity > 0 && registered === 0 ? (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-ink">
          Bu binanın daire kapasitesi {capacity}, ancak bağlı gerçek daire kaydı 0.
          Kapasite alanı daire listesi değildir; aidat borçlandırması da yalnızca gerçek
          daire kayıtlarına uygulanır.
        </p>
      ) : null}

      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="border-b border-line px-4 pt-3 sm:px-5">
          <DetailTabs tabs={tabs} value={tab} onChange={setTab} className="mb-0 border-b-0" />
        </div>

        <div className="p-4 sm:p-5">
          {tab === "genel" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
                <SurfaceCard padding="none" className="overflow-hidden">
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="text-sm font-semibold text-ink">Bina Bilgileri</h2>
                  </div>
                  <div className="divide-y divide-line p-2">
                    <InfoRow label="Bina adı" value={dash(building.name)} />
                    <InfoRow label="Bina kodu" value={dash(building.code)} />
                    <InfoRow
                      label="Kat sayısı"
                      value={building.floorCount != null ? String(building.floorCount) : "—"}
                    />
                    <InfoRow
                      label="Daire kapasitesi"
                      value={capacity != null ? String(capacity) : "—"}
                    />
                    <InfoRow label="Kayıtlı daire" value={String(registered)} />
                    <InfoRow label="Durum" value={<StatusBadge active={building.isActive} />} />
                  </div>
                </SurfaceCard>

                <SurfaceCard padding="none" className="overflow-hidden">
                  <div className="border-b border-line px-4 py-3">
                    <h2 className="text-sm font-semibold text-ink">Adres</h2>
                  </div>
                  <div className="divide-y divide-line p-2">
                    <InfoRow label="Site" value={dash(site?.name)} />
                    <InfoRow label="İl" value={dash(addressParts.city)} />
                    <InfoRow label="İlçe" value={dash(addressParts.district)} />
                    <InfoRow label="Açık adres" value={dash(addressParts.address)} />
                  </div>
                </SurfaceCard>
              </div>

              {building.description?.trim() ? (
                <SurfaceCard padding="sm">
                  <h2 className="mb-2 text-sm font-semibold text-ink">Açıklama</h2>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                    {building.description}
                  </p>
                </SurfaceCard>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line bg-canvas/50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
                    <FileText className="size-4 shrink-0" aria-hidden />
                    <span>Henüz açıklama eklenmemiş</span>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
                    Düzenle
                  </Button>
                </div>
              )}

              <SurfaceCard padding="sm">
                <h2 className="mb-2 text-sm font-semibold text-ink">Hızlı İşlemler</h2>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={openAddApartment}>
                    <Plus className="size-3.5" aria-hidden />
                    Daire Ekle
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setTab("daireler")}>
                    <DoorOpen className="size-3.5" aria-hidden />
                    Daireleri Gör
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setTab("demirbaslar")}>
                    <Package className="size-3.5" aria-hidden />
                    Demirbaşları Gör
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
                    <Pencil className="size-3.5" aria-hidden />
                    Binayı Düzenle
                  </Button>
                </div>
              </SurfaceCard>
            </div>
          ) : null}

          {tab === "daireler" ? (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-section text-ink">Daireler</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {apartmentsLoading
                      ? "Yükleniyor…"
                      : `${apartments.length} kayıt (kapasite: ${capacity ?? "—"})`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="w-full sm:w-48">
                    <SearchInput
                      placeholder="Daire ara..."
                      value={apartmentSearch}
                      onChange={(event) => setApartmentSearch(event.target.value)}
                      aria-label="Daire ara"
                    />
                  </div>
                  <Select
                    className="h-10 w-full sm:w-36"
                    value={apartmentStatus}
                    onChange={(event) =>
                      setApartmentStatus(event.target.value as "hepsi" | "aktif" | "pasif")
                    }
                    aria-label="Daire durum filtresi"
                  >
                    <option value="hepsi">Tümü</option>
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                  </Select>
                  <Button size="sm" variant="secondary" onClick={() => setBulkApartmentOpen(true)}>
                    Toplu Daire
                  </Button>
                  <Button size="sm" onClick={openAddApartment}>
                    <Plus className="size-4" aria-hidden />
                    Yeni Daire
                  </Button>
                </div>
              </div>

              {!apartmentsLoading && apartments.length === 0 ? (
                <EmptyState
                  icon={DoorOpen}
                  className="mx-auto max-w-xl px-5 py-8"
                  title="Bu binada henüz daire bulunmuyor"
                  description={
                    capacity != null && capacity > 0
                      ? `Kapasite ${capacity} olarak görünüyor; bu yalnızca hedef kapasitedir. Gerçek daire kaydı oluşturmanız gerekir.`
                      : "Daireleri tek tek ekleyebilir veya toplu oluşturabilirsiniz."
                  }
                  action={
                    <>
                      <Button type="button" onClick={openAddApartment}>
                        Daire Ekle
                      </Button>
                      {canManage ? (
                        <Button type="button" variant="secondary" onClick={openWizardForSite}>
                          <Sparkles className="size-3.5" aria-hidden />
                          Kurulum Sihirbazını Aç
                        </Button>
                      ) : null}
                    </>
                  }
                />
              ) : (
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
              )}
            </div>
          ) : null}

          {tab === "demirbaslar" ? (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-section text-ink">Demirbaşlar</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {assetsLoading ? "Yükleniyor…" : `${assets.length} kayıt`}
                  </p>
                </div>
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

              {!assetsLoading && assets.length === 0 ? (
                <EmptyState
                  icon={Package}
                  className="mx-auto max-w-xl px-5 py-8"
                  title="Henüz demirbaş bulunmuyor"
                  description="Bu binaya ait demirbaş kayıtlarını ekleyerek envanteri takip edebilirsiniz."
                  action={
                    <Button
                      type="button"
                      onClick={() => {
                        setAssetError("");
                        setAssetFormOpen(true);
                      }}
                    >
                      Demirbaş Ekle
                    </Button>
                  }
                />
              ) : (
                <SurfaceCard padding="none" className="overflow-hidden">
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
                        {!assetsLoading
                          ? assets.map((asset) => (
                              <TR key={asset.id}>
                                <TD>
                                  <Link
                                    href={`/app/demirbaslar/${asset.id}`}
                                    className="font-medium hover:text-accent"
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
                </SurfaceCard>
              )}
            </div>
          ) : null}

          {tab === "hareketler" ? (
            <EmptyState
              icon={History}
              className="mx-auto max-w-xl px-5 py-8"
              title="Henüz hareket bulunmuyor"
              description="Bu bina için hareket geçmişi kaydı bulunmuyor."
            />
          ) : null}
        </div>
      </SurfaceCard>

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

      <ConfirmDialog
        open={archiving}
        title="Binayı arşivle"
        description={`"${building.name}" arşivlenecek ve pasif listelerde görünecek.`}
        confirmLabel="Arşivle"
        pending={statusPending}
        onConfirm={() => void handleToggleActive(false)}
        onClose={() => setArchiving(false)}
      />

      <ConfirmDialog
        open={activating}
        title="Binayı aktifleştir"
        description={`"${building.name}" tekrar aktif hale getirilecek.`}
        confirmLabel="Aktifleştir"
        pending={statusPending}
        onConfirm={() => void handleToggleActive(true)}
        onClose={() => setActivating(false)}
      />

      <ConfirmDialog
        open={deletingBuilding}
        title="Binayı sil"
        description={`"${building.name}" arşivlenecek. Daire kaydı olan binalar silinemez.`}
        confirmLabel="Binayı Sil"
        danger
        pending={buildingDeletePending}
        onConfirm={() => void handleBuildingDelete()}
        onClose={() => (buildingDeletePending ? undefined : setDeletingBuilding(false))}
      />
    </PageContainer>
  );
}

function CompactStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">{label}</p>
        <span className="flex size-7 items-center justify-center rounded-md bg-accent-subtle text-accent">
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold leading-none text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
