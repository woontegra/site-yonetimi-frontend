"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApartmentsForBuilding } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import type { Building } from "@/lib/buildings-api";
import { GENDER_OPTIONS, RELATION_TYPE_LABELS, toDateInputValue, type RelationType } from "@/lib/person-constants";
import type { Person, PersonPayload } from "@/lib/persons-api";

export type PersonFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  nationalId: string;
  gender: string;
  occupation: string;
  birthDate: string;
  note: string;
  buildingId: string;
  apartmentId: string;
  relationType: RelationType | "";
};

export function emptyPersonForm(): PersonFormValues {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    nationalId: "",
    gender: "",
    occupation: "",
    birthDate: "",
    note: "",
    buildingId: "",
    apartmentId: "",
    relationType: "",
  };
}

export function personToForm(person: Person): PersonFormValues {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    phone: person.phone ?? "",
    email: person.email ?? "",
    nationalId: person.nationalId ?? "",
    gender: person.gender ?? "",
    occupation: person.occupation ?? "",
    birthDate: toDateInputValue(person.birthDate),
    note: person.note ?? "",
    buildingId: "",
    apartmentId: "",
    relationType: "",
  };
}

export function validatePersonForm(values: PersonFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.firstName.trim()) errors.firstName = "Ad zorunludur.";
  if (!values.lastName.trim()) errors.lastName = "Soyad zorunludur.";
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Geçerli bir e-posta girin.";
  }
  return errors;
}

export function personFormToPayload(values: PersonFormValues): PersonPayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    ...(values.email.trim() ? { email: values.email.trim() } : {}),
    ...(values.nationalId.trim() ? { nationalId: values.nationalId.trim() } : {}),
    ...(values.gender ? { gender: values.gender } : {}),
    ...(values.occupation.trim() ? { occupation: values.occupation.trim() } : {}),
    ...(values.birthDate ? { birthDate: values.birthDate } : {}),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

type PersonFormModalProps = {
  open: boolean;
  title: string;
  initialValues: PersonFormValues;
  pending: boolean;
  error?: string;
  siteLabel?: string;
  buildings?: Building[];
  onClose: () => void;
  onSubmit: (values: PersonFormValues) => Promise<void>;
};

export function PersonFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  siteLabel,
  buildings = [],
  onClose,
  onSubmit,
}: PersonFormModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId } = useActiveSite();
  const [values, setValues] = useState<PersonFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");
  const { apartments } = useApartmentsForBuilding(auth, siteId, values.buildingId || null);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open]);

  function update<K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) {
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
    const nextErrors = validatePersonForm(values);
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
          ? "Kişi bilgilerini güncelleyerek kaydı kaydedin."
          : "Kişi bilgilerini girerek kaydı oluşturun."
      }
      icon={isEdit ? Pencil : UserRound}
      size="md"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="person-form" disabled={pending}>
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
      <form id="person-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Kişi bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Ad" htmlFor="person-first-name" required error={errors.firstName}>
              <Input
                id="person-first-name"
                data-modal-autofocus
                value={values.firstName}
                invalid={Boolean(errors.firstName)}
                onChange={(event) => update("firstName", event.target.value)}
                autoComplete="given-name"
              />
            </FormField>
            <FormField label="Soyad" htmlFor="person-last-name" required error={errors.lastName}>
              <Input
                id="person-last-name"
                value={values.lastName}
                invalid={Boolean(errors.lastName)}
                onChange={(event) => update("lastName", event.target.value)}
                autoComplete="family-name"
              />
            </FormField>
            <FormField label="Telefon" htmlFor="person-phone">
              <Input
                id="person-phone"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
              />
            </FormField>
            <FormField label="E-posta" htmlFor="person-email" error={errors.email}>
              <Input
                id="person-email"
                type="email"
                value={values.email}
                invalid={Boolean(errors.email)}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
              />
            </FormField>
          </div>
        </FormSection>

        {!isEdit ? (
          <FormSection title="Yerleşim / ilişki">
            <p className="mb-3 text-[13px] text-muted">
              Site: <span className="font-medium text-ink">{siteLabel ?? site?.name ?? "—"}</span>
              <span className="ml-1">(opsiyonel)</span>
            </p>
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <FormField label="Bina" htmlFor="person-building">
                <Select
                  id="person-building"
                  value={values.buildingId}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      buildingId: event.target.value,
                      apartmentId: "",
                    }))
                  }
                >
                  <option value="">Seçiniz</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Daire" htmlFor="person-apartment">
                <Select
                  id="person-apartment"
                  value={values.apartmentId}
                  disabled={!values.buildingId}
                  onChange={(event) => update("apartmentId", event.target.value)}
                >
                  <option value="">Seçiniz</option>
                  {apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      {apartment.number}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="İlişki türü" htmlFor="person-relation-type">
                <Select
                  id="person-relation-type"
                  value={values.relationType}
                  onChange={(event) =>
                    update("relationType", event.target.value as PersonFormValues["relationType"])
                  }
                >
                  <option value="">Seçiniz</option>
                  {(Object.keys(RELATION_TYPE_LABELS) as RelationType[]).map((type) => (
                    <option key={type} value={type}>
                      {RELATION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </FormSection>
        ) : null}

        <FormSection title="Diğer bilgiler">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="T.C. Kimlik No" htmlFor="person-national-id">
              <Input
                id="person-national-id"
                value={values.nationalId}
                onChange={(event) => update("nationalId", event.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Cinsiyet" htmlFor="person-gender">
              <Select
                id="person-gender"
                value={values.gender}
                onChange={(event) => update("gender", event.target.value)}
              >
                <option value="">Seçiniz</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Meslek" htmlFor="person-occupation">
              <Input
                id="person-occupation"
                value={values.occupation}
                onChange={(event) => update("occupation", event.target.value)}
              />
            </FormField>
            <FormField label="Doğum Tarihi" htmlFor="person-birth-date">
              <Input
                id="person-birth-date"
                type="date"
                value={values.birthDate}
                onChange={(event) => update("birthDate", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Not" htmlFor="person-note">
            <Textarea
              id="person-note"
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
