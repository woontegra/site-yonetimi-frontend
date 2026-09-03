"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Link2, Pencil } from "lucide-react";
import { ApartmentCombobox } from "@/components/apartments/ApartmentCombobox";
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
import { useApartmentsForBuilding, useBuildingsForSite } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import type { Apartment } from "@/lib/apartments-api";
import type { Building } from "@/lib/buildings-api";
import {
  RELATION_TYPE_LABELS,
  todayInputValue,
  toDateInputValue,
  type RelationType,
} from "@/lib/person-constants";
import type { PersonListItem } from "@/lib/persons-api";
import type { ApartmentPersonRelation, RelationPayload } from "@/lib/relations-api";
import { cn } from "@/lib/cn";

export type RelationFormValues = {
  siteId: string;
  buildingId: string;
  apartmentId: string;
  personId: string;
  relationType: RelationType | "";
  startDate: string;
  isPrimary: boolean;
  note: string;
};

export function emptyRelationForm(defaults?: Partial<RelationFormValues>): RelationFormValues {
  return {
    siteId: defaults?.siteId ?? "",
    buildingId: defaults?.buildingId ?? "",
    apartmentId: defaults?.apartmentId ?? "",
    personId: defaults?.personId ?? "",
    relationType: defaults?.relationType ?? "",
    startDate: defaults?.startDate ?? todayInputValue(),
    isPrimary: defaults?.isPrimary ?? false,
    note: defaults?.note ?? "",
  };
}

export function relationToForm(
  relation: ApartmentPersonRelation,
  siteId = "",
): RelationFormValues {
  return {
    siteId,
    buildingId: relation.apartment.building.id,
    apartmentId: relation.apartment.id,
    personId: relation.person.id,
    relationType: relation.relationType,
    startDate: toDateInputValue(relation.startDate),
    isPrimary: relation.isPrimary,
    note: relation.note ?? "",
  };
}

export function validateRelationForm(
  values: RelationFormValues,
  options: { requirePerson: boolean; requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options.requireSite !== false && !values.siteId) errors.siteId = "Site seçimi zorunludur.";
  if (!values.buildingId) errors.buildingId = "Bina seçimi zorunludur.";
  if (!values.apartmentId) errors.apartmentId = "Daire seçimi zorunludur.";
  if (options.requirePerson && !values.personId) errors.personId = "Kişi seçimi zorunludur.";
  if (!values.relationType) errors.relationType = "İlişki türü zorunludur.";
  return errors;
}

export function relationFormToPayload(values: RelationFormValues): RelationPayload {
  return {
    apartmentId: values.apartmentId,
    personId: values.personId,
    relationType: values.relationType as RelationType,
    ...(values.startDate ? { startDate: values.startDate } : {}),
    isPrimary: values.isPrimary,
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

type RelationFormModalProps = {
  open: boolean;
  title: string;
  buildings?: Building[];
  apartments?: Apartment[];
  persons: PersonListItem[];
  initialValues: RelationFormValues;
  pending: boolean;
  error?: string;
  lockSite?: boolean;
  lockApartment?: boolean;
  lockPerson?: boolean;
  lockedPersonLabel?: string;
  siteLabel?: string;
  isEdit?: boolean;
  onClose: () => void;
  onSubmit: (values: RelationFormValues) => Promise<void>;
  onCreatePerson?: () => void;
  onBuildingChange?: (buildingId: string) => void;
};

export function RelationFormModal({
  open,
  title,
  buildings: buildingsProp,
  apartments: apartmentsProp,
  persons,
  initialValues,
  pending,
  error,
  lockSite = false,
  lockApartment = false,
  lockPerson = false,
  lockedPersonLabel,
  siteLabel,
  isEdit = false,
  onClose,
  onSubmit,
  onCreatePerson,
  onBuildingChange,
}: RelationFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<RelationFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [personSearch, setPersonSearch] = useState("");

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const fetchSiteId = lockApartment || isEdit ? null : values.siteId || null;
  const { buildings: loadedBuildings } = useBuildingsForSite(auth, fetchSiteId);
  const { apartments: loadedApartments } = useApartmentsForBuilding(
    auth,
    values.siteId || null,
    lockApartment || isEdit ? null : values.buildingId || null,
  );

  const buildings = useMemo(() => {
    if (buildingsProp?.length) return buildingsProp;
    return loadedBuildings;
  }, [buildingsProp, loadedBuildings]);

  const apartments = useMemo(() => {
    if (apartmentsProp?.length) return apartmentsProp;
    return loadedApartments;
  }, [apartmentsProp, loadedApartments]);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
    setPersonSearch("");
  }, [open, initialValues]);

  const filteredPersons = useMemo(() => {
    const query = personSearch.trim().toLocaleLowerCase("tr");
    if (!query) return persons.slice(0, 50);
    return persons
      .filter((person) => {
        const haystack = `${person.fullName} ${person.phone ?? ""} ${person.email ?? ""}`.toLocaleLowerCase(
          "tr",
        );
        return haystack.includes(query);
      })
      .slice(0, 50);
  }, [personSearch, persons]);

  const selectedPerson = persons.find((person) => person.id === values.personId);

  function update<K extends keyof RelationFormValues>(key: K, value: RelationFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") {
        next.buildingId = "";
        next.apartmentId = "";
      }
      if (key === "buildingId") next.apartmentId = "";
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "siteId") {
        delete next.buildingId;
        delete next.apartmentId;
      }
      if (key === "buildingId") delete next.apartmentId;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateRelationForm(values, {
      requirePerson: !lockPerson || !isEdit,
      requireSite: !isEdit,
    });
    if (!values.personId) nextErrors.personId = "Kişi seçimi zorunludur.";
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

  return (
    <FormModal
      open={open}
      title={title}
      description="Daire ile kişi arasındaki ilişkiyi tanımlayın."
      icon={isEdit ? Pencil : Link2}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="relation-form" disabled={pending}>
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
      <form id="relation-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="İlişki bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {isEdit || lockSite || lockApartment ? (
              <SiteContextField value={lockedSiteName} hint="İlişki bu site kapsamında kurulur." />
            ) : (
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
                autoFocus
              />
            )}

            <FormField label="Bina" htmlFor="relation-building" required error={errors.buildingId}>
              <Select
                id="relation-building"
                data-modal-autofocus={lockApartment || lockSite || undefined}
                value={values.buildingId}
                invalid={Boolean(errors.buildingId)}
                disabled={lockApartment || (!values.siteId && !isEdit)}
                onChange={(event) => {
                  const buildingId = event.target.value;
                  update("buildingId", buildingId);
                  onBuildingChange?.(buildingId);
                }}
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

            <FormField label="Daire" htmlFor="relation-apartment" required error={errors.apartmentId}>
              <ApartmentCombobox
                id="relation-apartment"
                apartments={apartments}
                value={values.apartmentId}
                disabled={lockApartment || !values.buildingId}
                invalid={Boolean(errors.apartmentId)}
                onChange={(apartmentId) => update("apartmentId", apartmentId)}
              />
            </FormField>

            {lockPerson || isEdit ? (
              <FormField label="Kişi" htmlFor="relation-person-locked">
                <Input
                  id="relation-person-locked"
                  value={lockedPersonLabel ?? selectedPerson?.fullName ?? ""}
                  disabled
                />
              </FormField>
            ) : (
              <FormField label="Kişi" htmlFor="relation-person" required error={errors.personId}>
                <div className="space-y-2">
                  <Input
                    id="relation-person-search"
                    data-modal-autofocus={lockApartment || undefined}
                    value={personSearch}
                    onChange={(event) => setPersonSearch(event.target.value)}
                    placeholder="Kişi ara..."
                  />
                  <Select
                    id="relation-person"
                    value={values.personId}
                    invalid={Boolean(errors.personId)}
                    onChange={(event) => update("personId", event.target.value)}
                  >
                    <option value="">Kişi seçin</option>
                    {selectedPerson &&
                    !filteredPersons.some((person) => person.id === selectedPerson.id) ? (
                      <option value={selectedPerson.id}>{selectedPerson.fullName}</option>
                    ) : null}
                    {filteredPersons.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                        {person.phone ? ` · ${person.phone}` : ""}
                      </option>
                    ))}
                  </Select>
                  {onCreatePerson ? (
                    <button
                      type="button"
                      className="text-[13px] font-medium text-brand hover:underline"
                      onClick={onCreatePerson}
                    >
                      Yeni Kişi Oluştur
                    </button>
                  ) : null}
                </div>
              </FormField>
            )}

            <FormField
              label="İlişki Türü"
              htmlFor="relation-type"
              required
              error={errors.relationType}
            >
              <Select
                id="relation-type"
                value={values.relationType}
                invalid={Boolean(errors.relationType)}
                onChange={(event) => update("relationType", event.target.value as RelationType | "")}
              >
                <option value="">Seçin</option>
                {(Object.keys(RELATION_TYPE_LABELS) as RelationType[]).map((type) => (
                  <option key={type} value={type}>
                    {RELATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Başlangıç Tarihi" htmlFor="relation-start">
              <Input
                id="relation-start"
                type="date"
                value={values.startDate}
                onChange={(event) => update("startDate", event.target.value)}
              />
            </FormField>

            <FormField label="Ana Kişi mi?" htmlFor="relation-primary">
              <div className="flex h-11 items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={values.isPrimary}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors duration-micro",
                    values.isPrimary ? "bg-brand" : "bg-slate-200",
                  )}
                  onClick={() => update("isPrimary", !values.isPrimary)}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-micro",
                      values.isPrimary ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
                <span className="text-sm text-ink">{values.isPrimary ? "Evet" : "Hayır"}</span>
              </div>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Not" htmlFor="relation-note">
            <Textarea
              id="relation-note"
              rows={3}
              className="min-h-[76px]"
              value={values.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </FormField>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
