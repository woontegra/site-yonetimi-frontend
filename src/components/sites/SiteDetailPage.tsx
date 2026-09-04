"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  DoorOpen,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { BuildingCardsGrid } from "@/components/buildings/BuildingCard";
import {
  BuildingFormModal,
  buildingToForm,
  emptyBuildingForm,
  formToPayload,
  type BuildingFormValues,
} from "@/components/buildings/BuildingFormModal";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  SiteFormModal,
  formToSitePayload,
  siteToForm,
  type SiteFormValues,
} from "@/components/sites/SiteFormModal";
import {
  EntityIcon,
  Field,
  FieldGrid,
  SETUP_STATUS_LABELS,
  dash,
  readSiteStats,
  setupNeedsAttention,
  siteLocation,
} from "@/components/sites/site-ui";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  createBuilding,
  deleteBuilding,
  listBuildings,
  updateBuilding,
  type Building,
} from "@/lib/buildings-api";
import { formatDateTr } from "@/lib/money";
import { canManageSites } from "@/lib/permissions";
import {
  deleteSite,
  getSite,
  getSiteDeletePreview,
  setupWizardActionLabel,
  updateSite,
  type Site,
  type SiteDeleteCounts,
} from "@/lib/sites-api";
import { useAuth } from "@/lib/auth-context";

const tabs = [
  { id: "genel", label: "Genel Bakış", icon: LayoutGrid },
  { id: "binalar", label: "Binalar", icon: Building2 },
] as const;

type TabId = (typeof tabs)[number]["id"];

const EMPTY_COUNTS: SiteDeleteCounts = {
  buildings: 0,
  apartments: 0,
  assets: 0,
  announcements: 0,
  relations: 0,
  debts: 0,
  payments: 0,
  expenses: 0,
  feedback: 0,
  other: 0,
};

export function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const siteId = String(params.id);
  const { user } = useAuth();
  const tenantAuth = useApiAuth({ requireSite: false });
  const { setSiteId, refreshSites, siteId: activeSiteId, sites } = useActiveSite();
  const { showToast, toastError } = useToast();
  const { openWizard } = useSiteSetupWizard();
  const canManage = canManageSites(user);

  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [buildingFormOpen, setBuildingFormOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [buildingPending, setBuildingPending] = useState(false);
  const [buildingError, setBuildingError] = useState("");
  const [buildingSearch, setBuildingSearch] = useState("");
  const debouncedBuildingSearch = useDebouncedValue(buildingSearch, 300);

  const [archiving, setArchiving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteCounts, setDeleteCounts] = useState<SiteDeleteCounts>(EMPTY_COUNTS);
  const [deletePreviewError, setDeletePreviewError] = useState("");

  useEffect(() => {
    setTab("genel");
    setSite(null);
    setError("");
    setFormOpen(false);
    setBuildingFormOpen(false);
    setEditingBuilding(null);
    setBuildings([]);
    setBuildingSearch("");
  }, [siteId]);

  const load = useCallback(async () => {
    if (!tenantAuth) return;
    setError("");
    try {
      const result = await getSite(tenantAuth, siteId);
      setSite(result.site);
    } catch (err) {
      setSite(null);
      setError(err instanceof ApiError ? err.message : "Site yüklenemedi.");
    }
  }, [tenantAuth, siteId]);

  const loadBuildings = useCallback(async () => {
    if (!tenantAuth) return;
    const authForSite = { ...tenantAuth, siteId };
    setBuildingsLoading(true);
    try {
      const result = await listBuildings(authForSite, {
        perPage: 100,
        status: "aktif",
        search: debouncedBuildingSearch.trim() || undefined,
      });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    } finally {
      setBuildingsLoading(false);
    }
  }, [tenantAuth, siteId, debouncedBuildingSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "binalar") {
      void loadBuildings();
    }
  }, [tab, loadBuildings]);

  async function handleSiteSubmit(values: SiteFormValues) {
    if (!tenantAuth || !site || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateSite(tenantAuth, site.id, formToSitePayload(values));
      showToast("Site bilgileri güncellendi.");
      setFormOpen(false);
      await refreshSites();
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleBuildingSubmit(values: BuildingFormValues) {
    const authForSite = tenantAuth ? { ...tenantAuth, siteId } : null;
    if (!authForSite || buildingPending) return;
    if (activeSiteId !== siteId) {
      setSiteId(siteId);
    }
    setBuildingPending(true);
    setBuildingError("");
    try {
      const payload = formToPayload(values, {
        clearInheritedAddress: Boolean(editingBuilding),
      });
      if (editingBuilding) {
        await updateBuilding(authForSite, editingBuilding.id, payload);
        showToast("Bina bilgileri güncellendi.");
      } else {
        await createBuilding(authForSite, payload);
        showToast("Bina başarıyla oluşturuldu.");
      }
      setBuildingFormOpen(false);
      setEditingBuilding(null);
      await loadBuildings();
      await load();
    } catch (err) {
      setBuildingError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setBuildingPending(false);
    }
  }

  async function handleBuildingDelete(building: Building) {
    const authForSite = tenantAuth ? { ...tenantAuth, siteId } : null;
    if (!authForSite) return;
    try {
      await deleteBuilding(authForSite, building.id);
      showToast("Bina silindi.");
      await loadBuildings();
      await load();
    } catch (err) {
      toastError(err, "Bina silinemedi.");
    }
  }

  function openWizardForThisSite() {
    if (!canManageSites(user)) {
      showToast("Kurulum sihirbazını açma yetkiniz yok.", "error");
      return;
    }
    if (!site?.isActive || !sites.some((item) => item.id === site.id)) {
      showToast("Sihirbaz yalnızca aktif siteler için açılabilir.", "error");
      return;
    }
    openWizard({ siteId: site.id });
  }

  function openAddBuilding() {
    setEditingBuilding(null);
    setBuildingError("");
    setBuildingFormOpen(true);
  }

  async function handleToggleActive(nextActive: boolean) {
    if (!tenantAuth || !site || statusPending) return;
    setStatusPending(true);
    try {
      await updateSite(tenantAuth, site.id, {
        name: site.name,
        code: site.code,
        address: site.address,
        city: site.city,
        district: site.district,
        description: site.description,
        isActive: nextActive,
      });
      showToast(nextActive ? "Site aktifleştirildi." : "Site arşivlendi.");
      setArchiving(false);
      setActivating(false);
      await refreshSites({
        preferSiteId: !nextActive && activeSiteId === site.id ? undefined : activeSiteId,
      });
      await load();
    } catch (err) {
      toastError(err, "Durum güncellenemedi.");
    } finally {
      setStatusPending(false);
    }
  }

  async function openDelete() {
    if (!tenantAuth || !site) return;
    setDeleting(true);
    setDeleteConfirmName("");
    setDeleteCounts(EMPTY_COUNTS);
    setDeletePreviewError("");
    try {
      const preview = await getSiteDeletePreview(tenantAuth, site.id);
      setDeleteCounts(preview.counts);
    } catch (err) {
      setDeletePreviewError(err instanceof ApiError ? err.message : "Silme özeti yüklenemedi.");
    }
  }

  async function handleDelete() {
    if (!tenantAuth || !site || deletePending) return;
    if (deleteConfirmName !== site.name) return;
    setDeletePending(true);
    try {
      const deletedId = site.id;
      await deleteSite(tenantAuth, deletedId, deleteConfirmName);
      showToast("Site ve ilişkili kayıtları kalıcı olarak silindi.");
      setDeleting(false);
      await refreshSites({
        preferSiteId: activeSiteId === deletedId ? undefined : activeSiteId,
      });
      window.location.href = "/app/siteler";
    } catch (err) {
      toastError(err, "Site silinemedi.");
    } finally {
      setDeletePending(false);
    }
  }

  if (error) {
    return (
      <PageContainer>
        <p className="text-sm text-danger">{error}</p>
        <Link href="/app/siteler" className="mt-4 inline-flex text-sm text-muted hover:text-ink">
          ← Siteler
        </Link>
      </PageContainer>
    );
  }

  if (!site) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Yükleniyor…</p>
      </PageContainer>
    );
  }

  const stats = readSiteStats(site);
  const location = siteLocation(site);
  const setupLabel = site.setupStatus ? SETUP_STATUS_LABELS[site.setupStatus] : "—";
  const setupDone = site.setupStatus === "COMPLETED" || site.setupStatus === "SKIPPED";
  const hasBuildings = (site.buildingCount ?? buildings.length) > 0;
  const hasApartments = (site.apartmentCount ?? 0) > 0;

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/siteler"
        backLabel="Siteler"
        leading={<EntityIcon icon={Building2} className="size-12 rounded-2xl" />}
        title={site.name}
        description={location || undefined}
        status={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge active={site.isActive} />
            {site.setupStatus && setupNeedsAttention(site.setupStatus) ? (
              <Badge tone="warning">{SETUP_STATUS_LABELS[site.setupStatus]}</Badge>
            ) : site.setupStatus === "COMPLETED" ? (
              <Badge tone="success">Kurulum tamamlandı</Badge>
            ) : null}
          </div>
        }
        actions={
          canManage ? (
            <>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={openWizardForThisSite}>
                <Sparkles className="size-3.5" aria-hidden />
                {setupWizardActionLabel(site.setupStatus)}
              </Button>
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
                {site.isActive ? (
                  <DropdownItem onClick={() => setArchiving(true)}>Arşivle</DropdownItem>
                ) : (
                  <DropdownItem onClick={() => setActivating(true)}>Aktifleştir</DropdownItem>
                )}
                <DropdownItem danger onClick={() => void openDelete()}>
                  Siteyi Sil
                </DropdownItem>
              </Dropdown>
            </>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Binalar" value={String(stats.buildings)} hint="Toplam bina" />
        <StatCard
          icon={DoorOpen}
          label="Daireler"
          value={String(stats.apartments)}
          hint={stats.apartments > 0 ? `${stats.activeApartments} aktif` : "Kayıtlı daire"}
        />
        <StatCard
          icon={UserRound}
          label="Aktif daire"
          value={String(stats.activeApartments)}
          hint="Aktif daire kaydı"
        />
        <StatCard
          icon={Wrench}
          label="Kurulum Durumu"
          value={setupDone ? "Tamam" : "Eksik"}
          hint={setupLabel}
        />
      </div>

      <SurfaceCard padding="none" className="overflow-hidden">
        <div className="border-b border-line px-4 pt-3 sm:px-5">
          <DetailTabs tabs={tabs} value={tab} onChange={setTab} className="mb-0 border-b-0" />
        </div>

        <div className="p-4 sm:p-5">
          {tab === "genel" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <SectionCard title="Site Bilgileri">
                  <FieldGrid>
                    <Field label="Site adı" value={dash(site.name)} />
                    <Field label="Site kodu" value={dash(site.code)} />
                    <Field label="Durum" value={<StatusBadge active={site.isActive} />} />
                    <Field label="Oluşturulma" value={formatDateTr(site.createdAt)} />
                    <div className="sm:col-span-2">
                      <Field label="Açıklama" value={dash(site.description)} />
                    </div>
                  </FieldGrid>
                </SectionCard>

                <SectionCard title="Adres Bilgileri">
                  <FieldGrid>
                    <div className="sm:col-span-2">
                      <Field label="Açık adres" value={dash(site.address)} />
                    </div>
                    <Field label="İl" value={dash(site.city)} />
                    <Field label="İlçe" value={dash(site.district)} />
                  </FieldGrid>
                </SectionCard>
              </div>

              <div className="space-y-4">
                <SectionCard title="Hızlı İşlemler">
                  <div className="flex flex-col gap-2">
                    {canManage ? (
                      <Button type="button" variant="secondary" className="w-full justify-start" onClick={openAddBuilding}>
                        <Building2 className="size-3.5" aria-hidden />
                        Bina Ekle
                      </Button>
                    ) : null}
                    <Link
                      href="/app/daireler"
                      className="inline-flex h-9 w-full items-center justify-start gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas"
                      onClick={() => {
                        if (activeSiteId !== siteId) setSiteId(siteId);
                      }}
                    >
                      <DoorOpen className="size-3.5" aria-hidden />
                      Daireleri Gör
                    </Link>
                    <Link
                      href="/app/kisiler"
                      className="inline-flex h-9 w-full items-center justify-start gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas"
                      onClick={() => {
                        if (activeSiteId !== siteId) setSiteId(siteId);
                      }}
                    >
                      <UserRound className="size-3.5" aria-hidden />
                      Sakinleri Gör
                    </Link>
                    {canManage ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-start"
                          onClick={() => setFormOpen(true)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Siteyi Düzenle
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-start"
                          onClick={openWizardForThisSite}
                        >
                          <Sparkles className="size-3.5" aria-hidden />
                          Kurulum Sihirbazını Aç
                        </Button>
                      </>
                    ) : null}
                  </div>
                </SectionCard>

                <SectionCard title="Kurulum Durumu" description="Gerçek kayıt durumuna göre">
                  <ul className="space-y-2.5 text-sm">
                    <SetupRow label="Site bilgileri" done={Boolean(site.name)} />
                    <SetupRow label="Binalar" done={hasBuildings} />
                    <SetupRow label="Daireler" done={hasApartments} />
                    <SetupRow
                      label="Kurulum sihirbazı"
                      done={setupDone}
                      detail={setupLabel}
                    />
                  </ul>
                </SectionCard>
              </div>
            </div>
          ) : null}

          {tab === "binalar" ? (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-section text-ink">Binalar</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {buildingsLoading ? "Yükleniyor…" : `${buildings.length} bina`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    className="h-9 w-full sm:w-56"
                    placeholder="Bina ara..."
                    value={buildingSearch}
                    onChange={(event) => setBuildingSearch(event.target.value)}
                    aria-label="Bina ara"
                  />
                  {canManage ? (
                    <Button type="button" onClick={openAddBuilding}>
                      Bina Ekle
                    </Button>
                  ) : null}
                </div>
              </div>
              <BuildingCardsGrid
                items={buildings}
                loading={buildingsLoading}
                siteFallback={site}
                onEdit={(building) => {
                  setEditingBuilding(building);
                  setBuildingError("");
                  setBuildingFormOpen(true);
                }}
                onDelete={(building) => void handleBuildingDelete(building)}
                onAdd={canManage ? openAddBuilding : undefined}
              />
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      <SiteFormModal
        open={formOpen}
        title="Siteyi Düzenle"
        initialValues={siteToForm(site)}
        pending={formPending}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSiteSubmit}
      />

      <BuildingFormModal
        open={buildingFormOpen}
        title={editingBuilding ? "Binayı Düzenle" : "Yeni Bina"}
        initialValues={
          editingBuilding ? buildingToForm(editingBuilding, siteId) : emptyBuildingForm(siteId)
        }
        pending={buildingPending}
        error={buildingError}
        lockSite
        siteLabel={site.name}
        onClose={() => setBuildingFormOpen(false)}
        onSubmit={handleBuildingSubmit}
      />

      <ConfirmDialog
        open={archiving}
        title="Siteyi arşivle"
        description={`"${site.name}" arşivlenecek. Site listesinde pasif görünür; bağlı kayıtlar silinmez.`}
        confirmLabel="Arşivle"
        pending={statusPending}
        onConfirm={() => void handleToggleActive(false)}
        onClose={() => setArchiving(false)}
      />

      <ConfirmDialog
        open={activating}
        title="Siteyi aktifleştir"
        description={`"${site.name}" tekrar aktif hale getirilecek.`}
        confirmLabel="Aktifleştir"
        pending={statusPending}
        onConfirm={() => void handleToggleActive(true)}
        onClose={() => setActivating(false)}
      />

      <Modal
        open={deleting}
        title="Siteyi kalıcı olarak sil"
        description="Bu siteye bağlı binalar, daireler, demirbaşlar, duyurular, geri bildirimler, finansal kayıtlar ve diğer site verileri kalıcı olarak silinecektir. Bu işlem geri alınamaz."
        iconTone="danger"
        variant="confirm"
        size="md"
        onClose={() => (deletePending ? undefined : setDeleting(false))}
        footer={
          <>
            <Button variant="secondary" disabled={deletePending} onClick={() => setDeleting(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              disabled={deletePending || deleteConfirmName !== site.name}
              onClick={() => void handleDelete()}
            >
              {deletePending ? "Siliniyor..." : "Siteyi Sil"}
            </Button>
          </>
        }
      >
        {deletePreviewError ? <p className="mb-3 text-sm text-danger">{deletePreviewError}</p> : null}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["Bina", deleteCounts.buildings],
              ["Daire", deleteCounts.apartments],
              ["Demirbaş", deleteCounts.assets],
              ["Duyuru", deleteCounts.announcements],
              ["Kişi/daire ilişkisi", deleteCounts.relations],
              ["Borç", deleteCounts.debts],
              ["Tahsilat", deleteCounts.payments],
              ["Gider", deleteCounts.expenses],
              ["Geri bildirim", deleteCounts.feedback],
              ["Diğer ilgili kayıtlar", deleteCounts.other],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="rounded-md border border-line bg-canvas px-3 py-2">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-medium text-ink">{count}</dd>
            </div>
          ))}
        </dl>
        <label className="mt-4 block text-sm text-ink">
          Onay için site adını birebir yazın
          <Input
            className="mt-1"
            value={deleteConfirmName}
            onChange={(event) => setDeleteConfirmName(event.target.value)}
            placeholder={site.name}
            autoComplete="off"
            data-modal-autofocus
          />
        </label>
      </Modal>
    </PageContainer>
  );
}

function SetupRow({
  label,
  done,
  detail,
}: {
  label: string;
  done: boolean;
  detail?: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-line bg-canvas px-3 py-2">
      <div className="min-w-0">
        <p className="font-medium text-ink">{label}</p>
        {detail ? <p className="text-caption text-muted">{detail}</p> : null}
      </div>
      <Badge tone={done ? "success" : "warning"}>{done ? "Tamam" : "Eksik"}</Badge>
    </li>
  );
}
