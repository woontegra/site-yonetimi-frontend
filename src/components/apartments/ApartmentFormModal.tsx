"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, DoorOpen, Pencil } from "lucide-react";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useBuildingsForSite } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { cn } from "@/lib/cn";
import type { Apartment, ApartmentPayload } from "@/lib/apartments-api";
import type { Building } from "@/lib/buildings-api";
import { ROOM_TYPES } from "@/lib/room-types";

export type ApartmentFormValues = {
  siteId: string;
  buildingId: string;
  number: string;
  floor: string;
  roomType: string;
  squareMeters: string;
  hasBalcony: boolean | null;
  description: string;
};

export function emptyApartmentForm(buildingId = "", siteId = ""): ApartmentFormValues {
  return {
    siteId,
    buildingId,
    number: "",
    floor: "",
    roomType: "",
    squareMeters: "",
    hasBalcony: null,
    description: "",
  };
}

export function apartmentToForm(apartment: Apartment, siteId = ""): ApartmentFormValues {
  return {
    siteId,
    buildingId: apartment.building.id,
    number: apartment.number,
    floor: apartment.floor ?? "",
    roomType: apartment.roomType ?? "",
    squareMeters: apartment.squareMeters != null ? String(apartment.squareMeters) : "",
    hasBalcony: apartment.hasBalcony,
    description: apartment.description ?? "",
  };
}

export function validateApartmentForm(values: ApartmentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.siteId) errors.siteId = "Site seçimi zorunludur.";
  if (!values.buildingId) errors.buildingId = "Bina seçimi zorunludur.";
  if (!values.number.trim()) errors.number = "Daire numarası zorunludur.";

  if (values.squareMeters.trim()) {
    const meters = Number(values.squareMeters.replace(",", "."));
    if (Number.isNaN(meters)) errors.squareMeters = "Metrekare sayısal olmalıdır.";
    else if (meters <= 0) errors.squareMeters = "Metrekare 0'dan büyük olmalıdır.";
  }

  return errors;
}

export function apartmentFormToPayload(values: ApartmentFormValues): ApartmentPayload {
  const meters = values.squareMeters.trim()
    ? Number(values.squareMeters.replace(",", "."))
    : undefined;

  return {
    buildingId: values.buildingId,
    number: values.number.trim(),
    floor: values.floor.trim() ? values.floor.trim() : null,
    roomType: values.roomType.trim() ? values.roomType : null,
    ...(meters !== undefined ? { squareMeters: meters } : {}),
    hasBalcony: values.hasBalcony,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

type ApartmentFormModalProps = {
  open: boolean;
  title: string;
  initialValues: ApartmentFormValues;
  pending: boolean;
  error?: string;
  buildings?: Building[];
  lockSite?: boolean;
  lockBuilding?: boolean;
  siteLabel?: string;
  buildingLabel?: string;
  onClose: () => void;
  onSubmit: (values: ApartmentFormValues) => Promise<void>;
};

export function ApartmentFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  buildings: buildingsProp,
  lockSite = false,
  lockBuilding = false,
  siteLabel,
  buildingLabel,
  onClose,
  onSubmit,
}: ApartmentFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<ApartmentFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const fetchSiteId = lockBuilding || isEdit ? null : values.siteId || null;
  const { buildings: loadedBuildings } = useBuildingsForSite(auth, fetchSiteId);

  const buildings = useMemo(() => {
    if (buildingsProp?.length) return buildingsProp;
    return loadedBuildings;
  }, [buildingsProp, loadedBuildings]);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof ApartmentFormValues>(key: K, value: ApartmentFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") next.buildingId = "";
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "siteId") delete next.buildingId;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateApartmentForm(values);
    if (isEdit) delete nextErrors.siteId;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  const lockedSiteName =
    siteLabel ||
    sites.find((item) => item.id === values.siteId)?.name ||
    site?.name ||
    "—";

  const lockedBuildingName =
    buildingLabel ||
    buildings.find((item) => item.id === values.buildingId)?.name ||
    "—";

  return (
    <FormModal
      open={open}
      title={title}
      description={
        isEdit
          ? "Daire bilgilerini güncelleyerek kaydı kaydedin."
          : "Daire bilgilerini girerek kaydı oluşturun."
      }
      icon={isEdit ? Pencil : DoorOpen}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="apartment-form" disabled={pending}>
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
      <form id="apartment-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Konum">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {isEdit || lockSite ? (
              <SiteContextField value={lockedSiteName} hint="Daire bu siteye aittir." />
            ) : (
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
                autoFocus
              />
            )}
            {lockBuilding ? (
              <SiteContextField
                label="Bina"
                value={lockedBuildingName}
                hint="Daire bu binaya eklenir."
              />
            ) : (
              <FormField label="Bina" htmlFor="apartment-building" required error={errors.buildingId}>
                <Select
                  id="apartment-building"
                  data-modal-autofocus={lockSite || isEdit || undefined}
                  value={values.buildingId}
                  invalid={Boolean(errors.buildingId)}
                  disabled={!values.siteId && !isEdit}
                  onChange={(event) => update("buildingId", event.target.value)}
                >
                  <option value="">
                    {values.siteId || isEdit ? "Bina seçin" : "Önce site seçin"}
                  </option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </div>
        </FormSection>

        <FormSection title="Daire bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Daire Numarası" htmlFor="apartment-number" required error={errors.number}>
              <Input
                id="apartment-number"
                data-modal-autofocus={lockBuilding || undefined}
                value={values.number}
                invalid={Boolean(errors.number)}
                onChange={(event) => update("number", event.target.value)}
                placeholder="Örn. 12 veya A1"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Kat" htmlFor="apartment-floor" error={errors.floor}>
              <Input
                id="apartment-floor"
                value={values.floor}
                invalid={Boolean(errors.floor)}
                onChange={(event) => update("floor", event.target.value)}
                placeholder="Örn. 3, Zemin, Bahçe Katı"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Oda Tipi" htmlFor="apartment-room-type" error={errors.roomType}>
              <Select
                id="apartment-room-type"
                value={values.roomType}
                invalid={Boolean(errors.roomType)}
                onChange={(event) => update("roomType", event.target.value)}
              >
                <option value="">Oda tipi seçin (opsiyonel)</option>
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Fiziksel bilgiler">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Metrekare" htmlFor="apartment-sqm" error={errors.squareMeters}>
              <Input
                id="apartment-sqm"
                inputMode="decimal"
                value={values.squareMeters}
                invalid={Boolean(errors.squareMeters)}
                onChange={(event) => update("squareMeters", event.target.value)}
                placeholder="Örn. 92,5"
              />
            </FormField>
            <FormField label="Balkon Var mı?" htmlFor="apartment-balcony">
              <div className="flex h-11 rounded-[10px] border border-line p-0.5">
                {[
                  { label: "Var", value: true as const },
                  { label: "Yok", value: false as const },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg text-sm transition-colors duration-micro",
                      values.hasBalcony === option.value
                        ? "bg-brand-soft font-medium text-brand"
                        : "text-muted hover:text-ink",
                    )}
                    onClick={() => update("hasBalcony", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Açıklama" htmlFor="apartment-description">
            <Textarea
              id="apartment-description"
              rows={3}
              className="min-h-[76px]"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </FormField>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
