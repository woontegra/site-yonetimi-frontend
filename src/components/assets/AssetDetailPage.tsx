"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  AssetFormModal,
  assetFormToPayload,
  assetToForm,
  type AssetFormValues,
} from "@/components/assets/AssetFormModal";
import { AssetLocationModal } from "@/components/assets/AssetLocationModal";
import {
  AssetMaintenanceFormModal,
  emptyMaintenanceForm,
  maintenanceFormToPayload,
  maintenancePayloadForCreate,
  maintenanceToForm,
  type AssetMaintenanceFormValues,
} from "@/components/assets/AssetMaintenanceFormModal";
import { AssetStatusModal } from "@/components/assets/AssetStatusModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { canManageAssets } from "@/lib/permissions";
import {
  archiveAsset,
  ASSET_MOVEMENT_LABELS,
  ASSET_STATUS_LABELS,
  changeAssetLocation,
  changeAssetStatus,
  createAssetMaintenance,
  deleteAsset,
  deleteAssetMaintenance,
  getAsset,
  listAssetCategories,
  listAssetMaintenances,
  listAssetMovements,
  updateAsset,
  updateAssetMaintenance,
  type Asset,
  type AssetCategory,
  type AssetMaintenance,
  type AssetMovement,
  type AssetStatus,
} from "@/lib/assets-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "hareketler", label: "Hareketler" },
  { id: "bakim", label: "Bakım" },
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

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">{children}</dl>
    </div>
  );
}

function warrantyNote(warrantyEndDate: string | null): string | null {
  if (!warrantyEndDate) return null;
  const end = new Date(warrantyEndDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Garanti süresi dolmuş.";
  if (diffDays === 0) return "Garanti bugün sona eriyor.";
  if (diffDays <= 30) return `Garanti ${diffDays} gün sonra sona eriyor.`;
  return null;
}

function movementPrevious(movement: AssetMovement): string {
  if (movement.type === "STATUS_CHANGED" && movement.previousStatus) {
    return ASSET_STATUS_LABELS[movement.previousStatus];
  }
  if (movement.type === "LOCATION_CHANGED") {
    const parts = [movement.fromBuilding?.name, movement.fromLocation].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
  if (movement.type === "QUANTITY_CHANGED" && movement.previousQuantity != null) {
    return String(movement.previousQuantity);
  }
  return "—";
}

function movementNext(movement: AssetMovement): string {
  if (movement.type === "STATUS_CHANGED" && movement.newStatus) {
    return ASSET_STATUS_LABELS[movement.newStatus];
  }
  if (movement.type === "LOCATION_CHANGED") {
    const parts = [movement.toBuilding?.name, movement.toLocation].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
  if (movement.type === "QUANTITY_CHANGED" && movement.newQuantity != null) {
    return String(movement.newQuantity);
  }
  return "—";
}

export function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, user } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();
  const { site, siteId } = useActiveSite();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [locationOpen, setLocationOpen] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposePending, setDisposePending] = useState(false);

  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [maintenances, setMaintenances] = useState<AssetMaintenance[]>([]);
  const [maintenancesLoading, setMaintenancesLoading] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<AssetMaintenance | null>(null);
  const [maintenancePending, setMaintenancePending] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState("");
  const [deletingMaintenance, setDeletingMaintenance] = useState<AssetMaintenance | null>(null);
  const [deleteMaintenancePending, setDeleteMaintenancePending] = useState(false);

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
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getAsset(auth, params.id);
      setAsset(result.asset);
    } catch (err) {
      setAsset(null);
      setError(err instanceof ApiError ? err.message : "Demirbaş yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadMovements = useCallback(async () => {
    if (!auth || !params.id) return;
    setMovementsLoading(true);
    try {
      const result = await listAssetMovements(auth, params.id);
      setMovements(result.items);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
    void loadMeta();
  }, [ready, load, loadMeta]);

  const loadMaintenances = useCallback(async () => {
    if (!auth || !params.id) return;
    setMaintenancesLoading(true);
    try {
      const result = await listAssetMaintenances(auth, params.id, { perPage: 100 });
      setMaintenances(result.items);
    } catch {
      setMaintenances([]);
    } finally {
      setMaintenancesLoading(false);
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready || tab !== "hareketler") return;
    void loadMovements();
  }, [ready, tab, loadMovements]);

  useEffect(() => {
    if (!ready || tab !== "bakim") return;
    void loadMaintenances();
  }, [ready, tab, loadMaintenances]);

  async function handleSubmit(values: AssetFormValues) {
    if (!auth || !asset || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateAsset(auth, asset.id, assetFormToPayload(values));
      await load();
      setFormOpen(false);
      showToast("Demirbaş güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleStatusSubmit(payload: { status: AssetStatus; note?: string }) {
    if (!auth || !asset || statusPending) return;
    setStatusPending(true);
    setStatusError("");
    try {
      await changeAssetStatus(auth, asset.id, payload);
      showToast("Durum güncellendi.");
      setStatusOpen(false);
      await Promise.all([load(), tab === "hareketler" ? loadMovements() : Promise.resolve()]);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Durum güncellenemedi.");
    } finally {
      setStatusPending(false);
    }
  }

  async function handleLocationSubmit(payload: {
    buildingId: string | null;
    location: string | null;
    note?: string;
  }) {
    if (!auth || !asset || locationPending) return;
    setLocationPending(true);
    setLocationError("");
    try {
      await changeAssetLocation(auth, asset.id, payload);
      showToast("Konum güncellendi.");
      setLocationOpen(false);
      await Promise.all([load(), tab === "hareketler" ? loadMovements() : Promise.resolve()]);
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : "Konum güncellenemedi.");
    } finally {
      setLocationPending(false);
    }
  }

  async function handleHardDelete() {
    if (!auth || !asset || deletePending) return;
    setDeletePending(true);
    try {
      await deleteAsset(auth, asset.id);
      showToast("Demirbaş silindi.");
      setDeleteOpen(false);
      router.push("/app/demirbaslar");
    } catch (err) {
      toastError(err, "Demirbaş silinemedi.");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !asset || archivePending) return;
    setArchivePending(true);
    try {
      await archiveAsset(auth, asset.id);
      showToast("Demirbaş arşivlendi.");
      setArchiveOpen(false);
      router.push("/app/demirbaslar");
    } catch (err) {
      toastError(err, "Demirbaş arşivlenemedi.");
    } finally {
      setArchivePending(false);
    }
  }

  async function handleDispose() {
    if (!auth || !asset || disposePending) return;
    setDisposePending(true);
    try {
      await changeAssetStatus(auth, asset.id, { status: "DISPOSED" });
      showToast("Demirbaş elden çıkarıldı.");
      setDisposeOpen(false);
      await Promise.all([load(), tab === "hareketler" ? loadMovements() : Promise.resolve()]);
    } catch (err) {
      toastError(err, "Demirbaş elden çıkarılamadı.");
    } finally {
      setDisposePending(false);
    }
  }

  async function handleMaintenanceSubmit(values: AssetMaintenanceFormValues) {
    if (!auth || !asset || maintenancePending) return;
    setMaintenancePending(true);
    setMaintenanceError("");
    try {
      const payload = maintenanceFormToPayload(values);
      if (editingMaintenance) {
        await updateAssetMaintenance(auth, asset.id, editingMaintenance.id, payload);
        showToast("Bakım kaydı güncellendi.");
      } else {
        await createAssetMaintenance(auth, asset.id, maintenancePayloadForCreate(payload));
        showToast("Bakım kaydı eklendi.");
      }
      setMaintenanceOpen(false);
      setEditingMaintenance(null);
      await Promise.all([loadMaintenances(), load()]);
    } catch (err) {
      setMaintenanceError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setMaintenancePending(false);
    }
  }

  async function handleMaintenanceDelete() {
    if (!auth || !asset || !deletingMaintenance || deleteMaintenancePending) return;
    setDeleteMaintenancePending(true);
    try {
      await deleteAssetMaintenance(auth, asset.id, deletingMaintenance.id);
      showToast("Bakım kaydı silindi.");
      setDeletingMaintenance(null);
      await Promise.all([loadMaintenances(), load()]);
    } catch (err) {
      toastError(err, "Bakım kaydı silinemedi.");
    } finally {
      setDeleteMaintenancePending(false);
    }
  }

  const warranty = useMemo(() => warrantyNote(asset?.warrantyEndDate ?? null), [asset?.warrantyEndDate]);

  return (
    <PageContainer>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {asset ? (
        <>
          <DetailHeader
            backHref="/app/demirbaslar"
            backLabel="Demirbaşlar"
            title={asset.name}
            description={asset.code || undefined}
            status={<StatusBadge label={ASSET_STATUS_LABELS[asset.status]} />}
            actions={
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setFormError("");
                    setFormOpen(true);
                  }}
                >
                  Düzenle
                </Button>
                <Dropdown
                  align="right"
                  trigger={
                    <Button variant="secondary" size="sm" aria-label="İşlemler">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                >
                  <DropdownItem
                    onClick={() => {
                      setStatusError("");
                      setStatusOpen(true);
                    }}
                  >
                    Durumu Değiştir
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      setLocationError("");
                      setLocationOpen(true);
                    }}
                  >
                    Konumu Değiştir
                  </DropdownItem>
                  {asset.status !== "DISPOSED" ? (
                    <DropdownItem onClick={() => setDisposeOpen(true)}>Elden Çıkar</DropdownItem>
                  ) : null}
                  <DropdownItem danger onClick={() => setArchiveOpen(true)}>
                    Arşivle
                  </DropdownItem>
                  {canManageAssets(user) ? (
                    <DropdownItem danger onClick={() => setDeleteOpen(true)}>
                      Sil
                    </DropdownItem>
                  ) : null}
                </Dropdown>
              </div>
            }
          />

          {warranty ? <p className="mb-4 text-[13px] text-warning">{warranty}</p> : null}

          <DetailTabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === "genel" ? (
            <div>
              <InfoGroup title="Temel">
                <InfoItem label="Ad" value={asset.name} />
                <InfoItem label="Kod" value={asset.code || "—"} />
                <InfoItem label="Kategori" value={asset.category?.name || "—"} />
                <InfoItem
                  label="Adet / Birim"
                  value={`${asset.quantity}${asset.unit ? ` ${asset.unit}` : ""}`}
                />
                <InfoItem label="Durum" value={ASSET_STATUS_LABELS[asset.status]} />
              </InfoGroup>

              <InfoGroup title="Konum">
                <InfoItem label="Site" value={asset.site.name} />
                <InfoItem label="Bina" value={asset.building?.name || "Site Geneli"} />
                <InfoItem
                  label="Daire"
                  value={asset.apartment ? `Daire ${asset.apartment.number}` : "—"}
                />
                <InfoItem label="Konum" value={asset.location || "—"} />
              </InfoGroup>

              <InfoGroup title="Ürün">
                <InfoItem label="Marka" value={asset.brand || "—"} />
                <InfoItem label="Model" value={asset.model || "—"} />
                <InfoItem label="Seri Numarası" value={asset.serialNumber || "—"} />
              </InfoGroup>

              <InfoGroup title="Finans">
                <InfoItem label="Satın Alma Tarihi" value={formatDateTr(asset.purchaseDate)} />
                <InfoItem
                  label="Satın Alma Bedeli"
                  value={asset.purchasePrice != null ? formatMoney(asset.purchasePrice) : "—"}
                />
                <InfoItem
                  label="Güncel Değer"
                  value={asset.currentValue != null ? formatMoney(asset.currentValue) : "—"}
                />
                <InfoItem label="Tedarikçi" value={asset.supplierName || "—"} />
              </InfoGroup>

              <InfoGroup title="Bakım">
                <InfoItem label="Son Bakım" value={formatDateTr(asset.lastMaintenanceDate)} />
                <InfoItem label="Sonraki Bakım" value={formatDateTr(asset.nextMaintenanceDate)} />
              </InfoGroup>

              <InfoGroup title="Garanti">
                <InfoItem label="Garanti Bitişi" value={formatDateTr(asset.warrantyEndDate)} />
              </InfoGroup>

              <InfoGroup title="Açıklama">
                <div className="col-span-2 md:col-span-4">
                  <InfoItem label="Açıklama" value={asset.description || "—"} />
                </div>
              </InfoGroup>
            </div>
          ) : null}

          {tab === "hareketler" ? (
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Tarih</TH>
                    <TH>Hareket</TH>
                    <TH>Önceki</TH>
                    <TH>Yeni</TH>
                    <TH>Açıklama</TH>
                  </TR>
                </THead>
                <TBody>
                  {movementsLoading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <TR key={`ms-${index}`} className="hover:bg-transparent">
                          <TD colSpan={5}>
                            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                          </TD>
                        </TR>
                      ))
                    : null}
                  {!movementsLoading && movements.length === 0 ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                        Henüz hareket bulunmuyor.
                      </TD>
                    </TR>
                  ) : null}
                  {!movementsLoading
                    ? movements.map((movement) => (
                        <TR key={movement.id}>
                          <TD>{formatDateTr(movement.occurredAt)}</TD>
                          <TD>{ASSET_MOVEMENT_LABELS[movement.type]}</TD>
                          <TD>{movementPrevious(movement)}</TD>
                          <TD>{movementNext(movement)}</TD>
                          <TD>{movement.note || "—"}</TD>
                        </TR>
                      ))
                    : null}
                </TBody>
              </TableElement>
            </Table>
          ) : null}

          {tab === "bakim" ? (
            <div>
              <div className="mb-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingMaintenance(null);
                    setMaintenanceError("");
                    setMaintenanceOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Bakım Kaydı
                </Button>
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Tarih</TH>
                      <TH>Tür</TH>
                      <TH>Açıklama</TH>
                      <TH>Yapan</TH>
                      <TH className="text-right">Maliyet</TH>
                      <TH>Sonraki Bakım</TH>
                      <TH className="text-right">İşlem</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {maintenancesLoading
                      ? Array.from({ length: 4 }).map((_, index) => (
                          <TR key={`bs-${index}`} className="hover:bg-transparent">
                            <TD colSpan={7}>
                              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                            </TD>
                          </TR>
                        ))
                      : null}
                    {!maintenancesLoading && maintenances.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                          Henüz bakım kaydı bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!maintenancesLoading
                      ? maintenances.map((maintenance) => (
                          <TR key={maintenance.id}>
                            <TD>{formatDateTr(maintenance.maintenanceDate)}</TD>
                            <TD>{maintenance.type}</TD>
                            <TD>{maintenance.description}</TD>
                            <TD>{maintenance.performedBy || "—"}</TD>
                            <TD className="text-right">
                              {maintenance.cost != null ? formatMoney(maintenance.cost) : "—"}
                            </TD>
                            <TD>{formatDateTr(maintenance.nextMaintenanceDate)}</TD>
                            <TD className="text-right">
                              <Dropdown
                                align="right"
                                trigger={
                                  <button
                                    type="button"
                                    className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                                    aria-label="Bakım kaydı işlemleri"
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </button>
                                }
                              >
                                <DropdownItem
                                  onClick={() => {
                                    setEditingMaintenance(maintenance);
                                    setMaintenanceError("");
                                    setMaintenanceOpen(true);
                                  }}
                                >
                                  Düzenle
                                </DropdownItem>
                                <DropdownItem
                                  danger
                                  onClick={() => setDeletingMaintenance(maintenance)}
                                >
                                  Sil
                                </DropdownItem>
                              </Dropdown>
                            </TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>

              <AssetMaintenanceFormModal
                key={editingMaintenance?.id ?? "new-maintenance"}
                open={maintenanceOpen}
                title={editingMaintenance ? "Bakım Kaydını Düzenle" : "Yeni Bakım Kaydı"}
                initialValues={
                  editingMaintenance
                    ? maintenanceToForm(editingMaintenance)
                    : emptyMaintenanceForm()
                }
                pending={maintenancePending}
                error={maintenanceError}
                onClose={() => (maintenancePending ? undefined : setMaintenanceOpen(false))}
                onSubmit={handleMaintenanceSubmit}
              />

              <ConfirmDialog
                open={Boolean(deletingMaintenance)}
                title="Bakım kaydı silinsin mi?"
                description="Bakım kaydı listeden kaldırılacaktır."
                confirmLabel="Sil"
                cancelLabel="Vazgeç"
                danger
                pending={deleteMaintenancePending}
                onConfirm={() => void handleMaintenanceDelete()}
                onClose={() =>
                  deleteMaintenancePending ? undefined : setDeletingMaintenance(null)
                }
              />
            </div>
          ) : null}

          <AssetFormModal
            open={formOpen}
            title="Demirbaşı Düzenle"
            categories={categories}
            auth={auth}
            showStatus
            siteLabel={site?.name}
            initialValues={assetToForm(asset, siteId ?? "")}
            pending={formPending}
            error={formError}
            onCategoriesChanged={() => void loadMeta()}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <AssetStatusModal
            open={statusOpen}
            currentStatus={asset.status}
            pending={statusPending}
            error={statusError}
            onClose={() => (statusPending ? undefined : setStatusOpen(false))}
            onSubmit={handleStatusSubmit}
          />

          <AssetLocationModal
            open={locationOpen}
            buildings={buildings}
            initialBuildingId={asset.buildingId ?? asset.building?.id ?? ""}
            initialLocation={asset.location ?? ""}
            pending={locationPending}
            error={locationError}
            onClose={() => (locationPending ? undefined : setLocationOpen(false))}
            onSubmit={handleLocationSubmit}
          />

          <ConfirmDialog
            open={disposeOpen}
            title="Demirbaş elden çıkarılsın mı?"
            description="Demirbaş durumu Elden Çıkarıldı olarak güncellenecek ve hareket geçmişine kaydedilecektir."
            confirmLabel="Elden Çıkar"
            cancelLabel="Vazgeç"
            pending={disposePending}
            onConfirm={() => void handleDispose()}
            onClose={() => (disposePending ? undefined : setDisposeOpen(false))}
          />

          <ConfirmDialog
            open={archiveOpen}
            title="Demirbaş arşivlensin mi?"
            description="Demirbaş aktif listeden kaldırılacak ancak geçmiş hareketleri korunacaktır."
            confirmLabel="Arşivle"
            cancelLabel="Vazgeç"
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => (archivePending ? undefined : setArchiveOpen(false))}
          />

          <ConfirmDialog
            open={deleteOpen}
            title="Demirbaşı silmek istediğinize emin misiniz?"
            description={asset ? `"${asset.name}" ve bağlı hareket/bakım kayıtları kalıcı olarak silinecektir.` : ""}
            confirmLabel="Sil"
            cancelLabel="Vazgeç"
            danger
            pending={deletePending}
            onConfirm={() => void handleHardDelete()}
            onClose={() => (deletePending ? undefined : setDeleteOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
