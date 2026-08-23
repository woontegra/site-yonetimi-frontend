"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Check, Pencil } from "lucide-react";
import { ProvinceDistrictFields } from "@/components/location/ProvinceDistrictFields";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useActiveSite } from "@/lib/active-site-context";
import { hasCustomBuildingAddress } from "@/lib/building-address";
import type { Building, BuildingPayload } from "@/lib/buildings-api";

export type BuildingFormValues = {
  siteId: string;
  name: string;
  code: string;
  apartmentCount: string;
  floorCount: string;
  useCustomAddress: boolean;
  city: string;
  district: string;
  address: string;
  description: string;
};

export function emptyBuildingForm(siteId = ""): BuildingFormValues {
  return {
    siteId,
    name: "",
    code: "",
    apartmentCount: "",
    floorCount: "",
    useCustomAddress: false,
    city: "",
    district: "",
    address: "",
    description: "",
  };
}

export function buildingToForm(building: Building, siteId = ""): BuildingFormValues {
  const useCustomAddress = hasCustomBuildingAddress(building);
  return {
    siteId,
    name: building.name,
    code: building.code ?? "",
    apartmentCount: building.apartmentCount != null ? String(building.apartmentCount) : "",
    floorCount: building.floorCount != null ? String(building.floorCount) : "",
    useCustomAddress,
    city: useCustomAddress ? (building.city ?? "") : "",
    district: useCustomAddress ? (building.district ?? "") : "",
    address: useCustomAddress ? (building.address ?? "") : "",
    description: building.description ?? "",
  };
}

export function validateBuildingForm(
  values: BuildingFormValues,
  options?: { requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }

  if (!values.name.trim()) {
    errors.name = "Bina adı zorunludur.";
  }

  if (values.apartmentCount.trim() !== "") {
    const apartments = Number(values.apartmentCount);
    if (!Number.isInteger(apartments)) {
      errors.apartmentCount = "Daire sayısı tam sayı olmalıdır.";
    } else if (apartments <= 0) {
      errors.apartmentCount = "Daire sayısı 0'dan büyük olmalıdır.";
    }
  }

  if (values.floorCount.trim() !== "") {
    const floors = Number(values.floorCount);
    if (!Number.isInteger(floors)) {
      errors.floorCount = "Kat sayısı tam sayı olmalıdır.";
    } else if (floors <= 0) {
      errors.floorCount = "Kat sayısı 0'dan büyük olmalıdır.";
    }
  }

  return errors;
}

export function formToPayload(
  values: BuildingFormValues,
  options?: { clearInheritedAddress?: boolean },
): BuildingPayload {
  const payload: BuildingPayload = {
    name: values.name.trim(),
    apartmentCount: values.apartmentCount.trim()
      ? Number(values.apartmentCount)
      : null,
    floorCount: values.floorCount.trim() ? Number(values.floorCount) : null,
    ...(values.code.trim() ? { code: values.code.trim() } : {}),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };

  if (values.useCustomAddress) {
    payload.city = values.city.trim() || null;
    payload.district = values.district.trim() || null;
    payload.address = values.address.trim() || null;
    return payload;
  }

  if (options?.clearInheritedAddress) {
    payload.city = null;
    payload.district = null;
    payload.address = null;
  }

  return payload;
}

type BuildingFormModalProps = {
  open: boolean;
  title: string;
  initialValues: BuildingFormValues;
  pending: boolean;
  error?: string;
  /** Site detayından açıldığında site kilitli */
  lockSite?: boolean;
  siteLabel?: string;
  onClose: () => void;
  onSubmit: (values: BuildingFormValues) => Promise<void>;
};

export function BuildingFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  lockSite = false,
  siteLabel,
  onClose,
  onSubmit,
}: BuildingFormModalProps) {
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<BuildingFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);

  useCloseFormOnSiteChange(open, handleClose);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof BuildingFormValues>(key: K, value: BuildingFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const nextErrors = validateBuildingForm(values, { requireSite: !isEdit });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit(values);
  }

  const lockedSiteName =
    siteLabel ||
    sites.find((s) => s.id === values.siteId)?.name ||
    site?.name ||
    "—";

  return (
    <FormModal
      open={open}
      title={title}
      description={
        isEdit
          ? "Bina bilgilerini güncelleyerek kaydı kaydedin."
          : "Yeni bina bilgilerini girerek kaydı oluşturun."
      }
      icon={isEdit ? Pencil : Building2}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="building-form" disabled={pending}>
            {pending ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Kaydet
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="building-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Site">
          {isEdit || lockSite ? (
            <SiteContextField value={lockedSiteName} hint="Bina bu siteye aittir." />
          ) : (
            <SiteSelect
              value={values.siteId}
              onChange={(siteId) => update("siteId", siteId)}
              error={errors.siteId}
              autoFocus
            />
          )}
        </FormSection>

        <FormSection title="Bina bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Bina Adı" htmlFor="building-name" required error={errors.name}>
              <Input
                id="building-name"
                data-modal-autofocus={isEdit || lockSite || undefined}
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="off"
                placeholder="Örn. A Blok"
              />
            </FormField>
            <FormField label="Bina Kodu" htmlFor="building-code">
              <Input
                id="building-code"
                value={values.code}
                onChange={(event) => update("code", event.target.value)}
                autoComplete="off"
                placeholder="Örn. A"
              />
            </FormField>
            <FormField label="Daire Sayısı" htmlFor="building-apartments" error={errors.apartmentCount}>
              <Input
                id="building-apartments"
                inputMode="numeric"
                value={values.apartmentCount}
                invalid={Boolean(errors.apartmentCount)}
                onChange={(event) => update("apartmentCount", event.target.value)}
                placeholder="Opsiyonel"
              />
            </FormField>
            <FormField label="Kat Sayısı" htmlFor="building-floors" error={errors.floorCount}>
              <Input
                id="building-floors"
                inputMode="numeric"
                value={values.floorCount}
                invalid={Boolean(errors.floorCount)}
                onChange={(event) => update("floorCount", event.target.value)}
                placeholder="Opsiyonel"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Açıklama" htmlFor="building-description">
            <Textarea
              id="building-description"
              rows={3}
              className="min-h-[76px]"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </FormField>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-line text-brand focus:ring-brand/30"
              checked={values.useCustomAddress}
              onChange={(event) => {
                const checked = event.target.checked;
                setValues((current) => ({
                  ...current,
                  useCustomAddress: checked,
                  ...(checked
                    ? {}
                    : { city: "", district: "", address: "" }),
                }));
              }}
            />
            <span>Bina adresi site adresinden farklı</span>
          </label>

          {values.useCustomAddress ? (
            <div className="mt-3 grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <ProvinceDistrictFields
                city={values.city}
                district={values.district}
                cityId="building-city"
                districtId="building-district"
                onCityChange={(city) => update("city", city)}
                onDistrictChange={(district) => update("district", district)}
              />
              <FormField label="Adres" htmlFor="building-address" className="md:col-span-2">
                <Textarea
                  id="building-address"
                  rows={3}
                  className="min-h-[76px]"
                  value={values.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </FormField>
            </div>
          ) : null}
        </FormSection>

        {error ? (
          <p className="flex items-center gap-1 text-[13px] text-danger">{error}</p>
        ) : null}
      </form>
    </FormModal>
  );
}
