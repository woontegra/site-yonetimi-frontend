"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  emptySiteForm,
  formToSitePayload,
  siteToForm,
  validateSiteForm,
  type SiteFormValues,
} from "@/components/sites/SiteFormModal";
import { ProvinceDistrictFields } from "@/components/location/ProvinceDistrictFields";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { getSite, updateSite, type Site } from "@/lib/sites-api";

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
  const { showToast, toastError } = useToast();
  const { siteId, status, refreshSites } = useActiveSite();
  const auth = useApiAuth({ requireSite: true });
  const { openWizard } = useSiteSetupWizard();

  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [values, setValues] = useState<SiteFormValues>(emptySiteForm());
  const [baseline, setBaseline] = useState<SiteFormValues>(emptySiteForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const dirtyRef = useRef(false);

  const dirty = useMemo(() => !formsEqual(values, baseline), [values, baseline]);
  dirtyRef.current = dirty;

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
  }, [auth, siteId, showToast]);

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
      const result = await updateSite(auth, siteId, formToSitePayload(values));
      setSite(result.site);
      const form = siteToForm(result.site);
      setValues(form);
      setBaseline(form);
      await refreshSites({ preferSiteId: siteId });
      showToast("Site bilgileri güncellendi.");
    } catch (error) {
      toastError(error, "Site kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-muted">Yükleniyor…</p>;
  }

  if (status === "noSites" || !siteId) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Seçili site yok.</p>
        <p className="text-sm text-muted">
          Site bilgilerini düzenlemek için önce bir site oluşturun veya üst çubuktan bir site seçin.
        </p>
        <Link href="/app/siteler" className="inline-block text-sm font-medium text-accent hover:underline">
          Siteler sayfasına git
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Site bilgileri yükleniyor…</p>;
  }

  if (!site) {
    return <p className="text-sm text-danger">Site bilgileri alınamadı.</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted">
        Bu bilgiler yalnızca seçili site için geçerlidir.
      </p>

      <FormSection title="Genel bilgiler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField label="Site Adı" htmlFor="settings-site-name" required error={fieldErrors.name}>
            <Input
              id="settings-site-name"
              value={values.name}
              invalid={Boolean(fieldErrors.name)}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            />
          </FormField>
          <FormField label="Site Kodu" htmlFor="settings-site-code">
            <Input
              id="settings-site-code"
              value={values.code}
              onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Durum" htmlFor="settings-site-status">
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <StatusBadge active={site.isActive} />
                <span className="text-[13px] text-muted">
                  Durum değişikliği{" "}
                  <Link href={`/app/siteler/${site.id}`} className="text-brand hover:underline">
                    Siteler › Site Detayı
                  </Link>{" "}
                  üzerinden yapılır.
                </span>
              </div>
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Adres bilgileri">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ProvinceDistrictFields
            city={values.city}
            district={values.district}
            cityId="settings-site-city"
            districtId="settings-site-district"
            onCityChange={(city) => setValues((current) => ({ ...current, city }))}
            onDistrictChange={(district) => setValues((current) => ({ ...current, district }))}
          />
          <FormField label="Adres" htmlFor="settings-site-address" className="md:col-span-2">
            <Textarea
              id="settings-site-address"
              rows={3}
              value={values.address}
              onChange={(event) =>
                setValues((current) => ({ ...current, address: event.target.value }))
              }
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Diğer bilgiler">
        <FormField label="Açıklama" htmlFor="settings-site-description">
          <Textarea
            id="settings-site-description"
            rows={3}
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
          />
        </FormField>
      </FormSection>

      <div className="flex flex-wrap justify-end gap-2">
        {site.setupStatus !== "COMPLETED" && site.setupStatus !== "SKIPPED" ? (
          <Button type="button" variant="secondary" onClick={() => openWizard()}>
            {site.setupStatus === "IN_PROGRESS" ? "Kuruluma Devam Et" : "Site Kurulumunu Tamamla"}
          </Button>
        ) : null}
        <Button type="button" disabled={pending || !dirty} onClick={() => void handleSave()}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
        </Button>
      </div>
    </div>
  );
}
