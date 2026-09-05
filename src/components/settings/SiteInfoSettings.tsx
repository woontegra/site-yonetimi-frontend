"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import {
  emptySiteForm,
  formToSitePayload,
  siteToForm,
  validateSiteForm,
  type SiteFormValues,
} from "@/components/sites/SiteFormModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import {
  SettingsActionRow,
  SettingsField,
  SettingsInput,
  SettingsSelect,
  SettingsTextarea,
  settingsUi,
} from "@/components/settings/settings-ui";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { canManageSites } from "@/lib/permissions";
import { getSite, updateSite, type Site } from "@/lib/sites-api";
import {
  TURKEY_PROVINCES,
  getDistrictsForProvince,
  withLegacyOption,
} from "@/lib/turkey-locations";

function formsEqual(a: SiteFormValues, b: SiteFormValues): boolean {
  return (
    a.name === b.name &&
    a.code === b.code &&
    a.city === b.city &&
    a.district === b.district &&
    a.address === b.address &&
    a.description === b.description
  );
}

export function SiteInfoSettings() {
  const { user } = useAuth();
  const { showToast, toastError } = useToast();
  const { siteId, status, refreshSites } = useActiveSite();
  const auth = useApiAuth({ requireSite: true });
  const { openWizard } = useSiteSetupWizard();
  const canOpenDetail = canManageSites(user) || !user.permissions?.length;

  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [values, setValues] = useState<SiteFormValues>(emptySiteForm());
  const [baseline, setBaseline] = useState<SiteFormValues>(emptySiteForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const dirtyRef = useRef(false);

  const dirty = useMemo(() => !formsEqual(values, baseline), [values, baseline]);
  dirtyRef.current = dirty;

  const provinceOptions = withLegacyOption(TURKEY_PROVINCES, values.city);
  const districtOptions = withLegacyOption(getDistrictsForProvince(values.city), values.district);
  const districtDisabled = !values.city.trim();

  const load = useCallback(async () => {
    if (!auth || !siteId) {
      setLoading(false);
      setSite(null);
      return;
    }
    setLoading(true);
    try {
      const result = await getSite(auth, siteId);
      setSite(result.site);
      const form = siteToForm(result.site);
      setValues(form);
      setBaseline(form);
      setFieldErrors({});
    } catch (error) {
      toastError(error, "Site bilgileri yüklenemedi.");
      setSite(null);
    } finally {
      setLoading(false);
    }
  }, [auth, siteId, toastError]);

  useEffect(() => {
    if (dirtyRef.current) {
      showToast("Site değişti. Kaydedilmemiş site bilgileri silindi.", "error");
    }
    void load();
  }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!auth || !siteId || pending) return;
    const errors = validateSiteForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      // Site kodu Ayarlar UI’ında yok; mevcut değer korunarak gönderilir.
      const payload = formToSitePayload({
        ...values,
        code: baseline.code,
      });
      const result = await updateSite(auth, siteId, payload);
      setSite(result.site);
      const form = siteToForm(result.site);
      setValues(form);
      setBaseline(form);
      await refreshSites({ preferSiteId: siteId });
      showToast("Site bilgileri güncellendi.");
    } catch (error) {
      toastError(error, "Site bilgileri güncellenemedi. Lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") return <p className={settingsUi.help}>Yükleniyor…</p>;

  if (status === "noSites" || !siteId) {
    return (
      <EmptyState
        icon={Building2}
        title="Önce bir site seçin."
        description="Üst çubuktan bir site seçin."
        action={
          <Link href="/app/siteler" className={settingsUi.btnSecondary}>
            Site Seç
          </Link>
        }
        compact
        className="border-0 bg-transparent px-0 py-3"
      />
    );
  }

  if (loading) return <p className={settingsUi.help}>Site bilgileri yükleniyor…</p>;
  if (!site) return <p className="text-[12px] text-danger">Site bilgileri alınamadı.</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SettingsField
          label="Site Adı"
          htmlFor="settings-site-name"
          required
          error={fieldErrors.name}
          className="md:col-span-2"
        >
          <SettingsInput
            id="settings-site-name"
            value={values.name}
            invalid={Boolean(fieldErrors.name)}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          />
        </SettingsField>
        <SettingsField label="Durum" htmlFor="settings-site-status">
          <div className="flex h-9 flex-wrap items-center gap-2">
            <StatusBadge active={site.isActive} />
            <span className={settingsUi.help}>
              Durum{" "}
              {canOpenDetail ? (
                <Link href={`/app/siteler/${site.id}`} className="text-accent hover:underline">
                  Site Detayı
                </Link>
              ) : (
                "Site Detayı"
              )}{" "}
              ekranından değiştirilir.
            </span>
          </div>
        </SettingsField>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SettingsField label="İl" htmlFor="settings-site-city">
          <SettingsSelect
            id="settings-site-city"
            value={values.city}
            onChange={(event) => {
              const city = event.target.value;
              setValues((current) => ({ ...current, city, district: "" }));
            }}
          >
            <option value="">İl seçin</option>
            {provinceOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SettingsSelect>
        </SettingsField>
        <SettingsField label="İlçe" htmlFor="settings-site-district">
          <SettingsSelect
            id="settings-site-district"
            value={values.district}
            disabled={districtDisabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, district: event.target.value }))
            }
          >
            <option value="">{districtDisabled ? "Önce il seçin" : "İlçe seçin"}</option>
            {districtOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SettingsSelect>
        </SettingsField>
      </div>

      <SettingsField label="Adres" htmlFor="settings-site-address">
        <SettingsTextarea
          id="settings-site-address"
          rows={2}
          value={values.address}
          onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))}
        />
      </SettingsField>

      <SettingsField label="Açıklama" htmlFor="settings-site-description" hint="Opsiyonel">
        <SettingsTextarea
          id="settings-site-description"
          rows={2}
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
        />
      </SettingsField>

      <SettingsActionRow>
        {site.setupStatus !== "COMPLETED" && site.setupStatus !== "SKIPPED" ? (
          <button type="button" className={settingsUi.btnSecondary} onClick={() => openWizard()}>
            {site.setupStatus === "IN_PROGRESS" ? "Kuruluma Devam Et" : "Site Kurulumunu Tamamla"}
          </button>
        ) : null}
        <button
          type="button"
          className={settingsUi.btnPrimary}
          disabled={pending || !dirty}
          onClick={() => void handleSave()}
        >
          {pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
        </button>
      </SettingsActionRow>
    </div>
  );
}
