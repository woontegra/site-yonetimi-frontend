"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MapPinned, Pencil } from "lucide-react";
import { ProvinceDistrictFields } from "@/components/location/ProvinceDistrictFields";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { Site, SitePayload } from "@/lib/sites-api";

export type SiteFormValues = {
  name: string;
  code: string;
  city: string;
  district: string;
  address: string;
  description: string;
};

export function emptySiteForm(): SiteFormValues {
  return {
    name: "",
    code: "",
    city: "",
    district: "",
    address: "",
    description: "",
  };
}

export function siteToForm(site: Site): SiteFormValues {
  return {
    name: site.name,
    code: site.code ?? "",
    city: site.city ?? "",
    district: site.district ?? "",
    address: site.address ?? "",
    description: site.description ?? "",
  };
}

export function validateSiteForm(values: SiteFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) {
    errors.name = "Site adı zorunludur.";
  }
  return errors;
}

export function formToSitePayload(values: SiteFormValues): SitePayload {
  return {
    name: values.name.trim(),
    ...(values.code.trim() ? { code: values.code.trim() } : { code: null }),
    ...(values.city.trim() ? { city: values.city.trim() } : { city: null }),
    ...(values.district.trim() ? { district: values.district.trim() } : { district: null }),
    ...(values.address.trim() ? { address: values.address.trim() } : { address: null }),
    ...(values.description.trim()
      ? { description: values.description.trim() }
      : { description: null }),
  };
}

type SiteFormModalProps = {
  open: boolean;
  title: string;
  description?: string;
  initialValues: SiteFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: SiteFormValues) => Promise<void>;
};

export function SiteFormModal({
  open,
  title,
  description = "Yönetilecek site veya yerleşke bilgilerini girin.",
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: SiteFormModalProps) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setFieldErrors({});
    }
  }, [open, initialValues]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validateSiteForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await onSubmit(values);
  }

  function setField<K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <FormModal
      open={open}
      title={title}
      description={description}
      icon={title.startsWith("Düzenle") || title.includes("Düzenle") ? Pencil : MapPinned}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="site-form" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </>
      }
    >
      <form id="site-form" className="space-y-6" onSubmit={handleSubmit}>
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <FormSection title="Site Bilgileri">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Site Adı" required error={fieldErrors.name} className="sm:col-span-2">
              <Input
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Hanlılar Sitesi"
              />
            </FormField>
            <FormField label="Site Kodu" error={fieldErrors.code}>
              <Input
                value={values.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder="HAN"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Konum">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProvinceDistrictFields
              city={values.city}
              district={values.district}
              cityId="site-city"
              districtId="site-district"
              onCityChange={(city) => setField("city", city)}
              onDistrictChange={(district) => setField("district", district)}
            />
            <FormField label="Adres" className="sm:col-span-2">
              <Textarea
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                rows={2}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek Bilgi">
          <FormField label="Açıklama">
            <Textarea
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={3}
            />
          </FormField>
        </FormSection>
      </form>
    </FormModal>
  );
}
