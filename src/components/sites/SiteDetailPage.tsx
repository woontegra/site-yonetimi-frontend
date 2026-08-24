"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import {
  BuildingFormModal,
  buildingToForm,
  emptyBuildingForm,
  formToPayload,
  type BuildingFormValues,
} from "@/components/buildings/BuildingFormModal";
import { BuildingsTable } from "@/components/buildings/BuildingsTable";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  SiteFormModal,
  formToSitePayload,
  siteToForm,
  type SiteFormValues,
} from "@/components/sites/SiteFormModal";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  createBuilding,
  deleteBuilding,
  listBuildings,
  updateBuilding,
  type Building,
} from "@/lib/buildings-api";
import { getSite, setupWizardActionLabel, updateSite, type Site } from "@/lib/sites-api";
import { canManageSites } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "binalar", label: "Binalar" },
  { id: "ozet", label: "Özet" },
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

export function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const siteId = String(params.id);
  const { user } = useAuth();
  const tenantAuth = useApiAuth({ requireSite: false });
  const { setSiteId, refreshSites, siteId: activeSiteId, sites } = useActiveSite();
  const { showToast } = useToast();
  const { openWizard } = useSiteSetupWizard();
  const canOpenWizard = canManageSites(user);

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

  useEffect(() => {
    setTab("genel");
    setSite(null);
    setError("");
    setFormOpen(false);
    setBuildingFormOpen(false);
    setEditingBuilding(null);
    setBuildings([]);
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
    // Bu site için geçici olarak X-Site-Id = detay site id
    const authForSite = { ...tenantAuth, siteId };
    setBuildingsLoading(true);
    try {
      const result = await listBuildings(authForSite, { perPage: 100, status: "aktif" });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    } finally {
      setBuildingsLoading(false);
    }
  }, [tenantAuth, siteId]);

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
      showToast("Site güncellendi.");
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
        showToast("Bina güncellendi.");
      } else {
        await createBuilding(authForSite, payload);
        showToast("Bina oluşturuldu.");
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
      showToast(err instanceof ApiError ? err.message : "Bina silinemedi.", "error");
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

  const locationMuted = [site?.city, site?.district].filter(Boolean).join(" / ");

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

  return (
    <PageContainer>
      <Link
        href="/app/siteler"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Siteler
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{site.name}</h1>
          {locationMuted ? <p className="mt-1 text-sm text-muted">{locationMuted}</p> : null}
        </div>
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
          {canOpenWizard ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={openWizardForThisSite}
            >
              {setupWizardActionLabel(site.setupStatus)}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setFormOpen(true)}>
            Düzenle
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "px-3 py-2 text-sm",
              tab === item.id
                ? "border-b-2 border-ink font-medium text-ink"
                : "text-muted hover:text-ink",
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "genel" ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <InfoItem label="Site adı" value={site.name} />
          <InfoItem label="Kod" value={site.code ?? "—"} />
          <InfoItem label="Adres" value={site.address ?? "—"} />
          <InfoItem label="İl" value={site.city ?? "—"} />
          <InfoItem label="İlçe" value={site.district ?? "—"} />
          <InfoItem label="Durum" value={<StatusBadge active={site.isActive} />} />
        </dl>
      ) : null}

      {tab === "binalar" ? (
        <div>
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setEditingBuilding(null);
                setBuildingError("");
                setBuildingFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Yeni Bina
            </Button>
          </div>
          <BuildingsTable
            items={buildings}
            loading={buildingsLoading}
            onEdit={(building) => {
              setEditingBuilding(building);
              setBuildingError("");
              setBuildingFormOpen(true);
            }}
            onDelete={(building) => void handleBuildingDelete(building)}
          />
        </div>
      ) : null}

      {tab === "ozet" ? (
        <dl className="grid gap-4 sm:grid-cols-3">
          <InfoItem label="Bina" value={`${site.buildingCount ?? 0}`} />
          <InfoItem label="Daire" value={`${site.apartmentCount ?? 0}`} />
          <InfoItem label="Aktif daire" value={`${site.activeApartmentCount ?? 0}`} />
        </dl>
      ) : null}

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
          editingBuilding
            ? buildingToForm(editingBuilding, siteId)
            : emptyBuildingForm(siteId)
        }
        pending={buildingPending}
        error={buildingError}
        lockSite
        siteLabel={site.name}
        onClose={() => setBuildingFormOpen(false)}
        onSubmit={handleBuildingSubmit}
      />
    </PageContainer>
  );
}
