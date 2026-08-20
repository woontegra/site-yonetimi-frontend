"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { Building, BuildingPayload } from "@/lib/buildings-api";

export type BuildingFormValues = {
  name: string;
  code: string;
  apartmentCount: string;
  floorCount: string;
  city: string;
  district: string;
  address: string;
  description: string;
};

export function emptyBuildingForm(): BuildingFormValues {
  return {
    name: "",
    code: "",
    apartmentCount: "",
    floorCount: "",
    city: "",
    district: "",
    address: "",
    description: "",
  };
}

export function buildingToForm(building: Building): BuildingFormValues {
  return {
    name: building.name,
    code: building.code ?? "",
    apartmentCount: String(building.apartmentCount),
    floorCount: String(building.floorCount),
    city: building.city ?? "",
    district: building.district ?? "",
    address: building.address ?? "",
    description: building.description ?? "",
  };
}

export function validateBuildingForm(values: BuildingFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.name.trim()) {
    errors.name = "Bina adı zorunludur.";
  }

  const apartments = Number(values.apartmentCount);
  if (values.apartmentCount.trim() === "") {
    errors.apartmentCount = "Daire sayısı zorunludur.";
  } else if (!Number.isInteger(apartments)) {
    errors.apartmentCount = "Daire sayısı tam sayı olmalıdır.";
  } else if (apartments <= 0) {
    errors.apartmentCount = "Daire sayısı 0'dan büyük olmalıdır.";
  }

  const floors = Number(values.floorCount);
  if (values.floorCount.trim() === "") {
    errors.floorCount = "Kat sayısı zorunludur.";
  } else if (!Number.isInteger(floors)) {
    errors.floorCount = "Kat sayısı tam sayı olmalıdır.";
  } else if (floors <= 0) {
    errors.floorCount = "Kat sayısı 0'dan büyük olmalıdır.";
  }

  return errors;
}

export function formToPayload(values: BuildingFormValues): BuildingPayload {
  return {
    name: values.name.trim(),
    apartmentCount: Number(values.apartmentCount),
    floorCount: Number(values.floorCount),
    ...(values.code.trim() ? { code: values.code.trim() } : {}),
    ...(values.city.trim() ? { city: values.city.trim() } : {}),
    ...(values.district.trim() ? { district: values.district.trim() } : {}),
    ...(values.address.trim() ? { address: values.address.trim() } : {}),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

type BuildingFormModalProps = {
  open: boolean;
  title: string;
  initialValues: BuildingFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: BuildingFormValues) => Promise<void>;
};

export function BuildingFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: BuildingFormModalProps) {
  const [values, setValues] = useState<BuildingFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open]);

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

    const nextErrors = validateBuildingForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit(values);
  }

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
          <Button variant="ghost" onClick={onClose} disabled={pending}>
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
        <FormSection title="Bina bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Bina Adı" htmlFor="building-name" required error={errors.name}>
              <Input
                id="building-name"
                data-modal-autofocus
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="off"
                placeholder="Örn. Hanlılar Sitesi"
              />
            </FormField>
            <FormField label="Bina Kodu" htmlFor="building-code">
              <Input
                id="building-code"
                value={values.code}
                onChange={(event) => update("code", event.target.value)}
                autoComplete="off"
                placeholder="Örn. A Blok"
              />
            </FormField>
            <FormField label="Daire Sayısı" htmlFor="building-apartments" required error={errors.apartmentCount}>
              <Input
                id="building-apartments"
                inputMode="numeric"
                value={values.apartmentCount}
                invalid={Boolean(errors.apartmentCount)}
                onChange={(event) => update("apartmentCount", event.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Kat Sayısı" htmlFor="building-floors" required error={errors.floorCount}>
              <Input
                id="building-floors"
                inputMode="numeric"
                value={values.floorCount}
                invalid={Boolean(errors.floorCount)}
                onChange={(event) => update("floorCount", event.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Konum">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="İl" htmlFor="building-city">
              <Input
                id="building-city"
                value={values.city}
                onChange={(event) => update("city", event.target.value)}
                autoComplete="address-level1"
              />
            </FormField>
            <FormField label="İlçe" htmlFor="building-district">
              <Input
                id="building-district"
                value={values.district}
                onChange={(event) => update("district", event.target.value)}
                autoComplete="address-level2"
              />
            </FormField>
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
        </FormSection>

        {error ? (
          <p className="flex items-center gap-1 text-[13px] text-danger">{error}</p>
        ) : null}
      </form>
    </FormModal>
  );
}
