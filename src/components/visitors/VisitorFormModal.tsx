"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type {
  Visitor,
  VisitorDetail,
  VisitorPayload,
  VisitorUpdatePayload,
} from "@/lib/visits-api";

export type VisitorFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  nationalId: string;
  note: string;
};

export function emptyVisitorForm(): VisitorFormValues {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    nationalId: "",
    note: "",
  };
}

export function visitorToForm(visitor: Visitor | VisitorDetail): VisitorFormValues {
  return {
    firstName: visitor.firstName,
    lastName: visitor.lastName,
    phone: visitor.phone ?? "",
    nationalId: "nationalId" in visitor ? (visitor.nationalId ?? "") : "",
    note: visitor.note ?? "",
  };
}

export function validateVisitorForm(values: VisitorFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.firstName.trim()) errors.firstName = "Ad zorunludur.";
  if (!values.lastName.trim()) errors.lastName = "Soyad zorunludur.";
  return errors;
}

export function visitorFormToCreatePayload(values: VisitorFormValues): VisitorPayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    ...(values.nationalId.trim() ? { nationalId: values.nationalId.trim() } : {}),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

export function visitorFormToUpdatePayload(values: VisitorFormValues): VisitorUpdatePayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() ? values.phone.trim() : null,
    nationalId: values.nationalId.trim() ? values.nationalId.trim() : null,
    note: values.note.trim() ? values.note.trim() : null,
  };
}

type VisitorFormModalProps = {
  open: boolean;
  title?: string;
  initialValues?: VisitorFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: VisitorFormValues) => Promise<void>;
};

export function VisitorFormModal({
  open,
  title = "Yeni Misafir",
  initialValues = emptyVisitorForm(),
  pending,
  error,
  onClose,
  onSubmit,
}: VisitorFormModalProps) {
  const [values, setValues] = useState<VisitorFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open]);

  function update<K extends keyof VisitorFormValues>(key: K, value: VisitorFormValues[K]) {
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
    const nextErrors = validateVisitorForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  return (
    <FormModal
      open={open}
      title={title}
      description="Misafir bilgilerini girerek rehbere ekleyin."
      icon={isEdit ? Pencil : UserRound}
      size="md"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="visitor-form" disabled={pending}>
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
      <form id="visitor-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Temel">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Ad" htmlFor="visitor-first-name" required error={errors.firstName}>
              <Input
                id="visitor-first-name"
                data-modal-autofocus
                value={values.firstName}
                invalid={Boolean(errors.firstName)}
                onChange={(event) => update("firstName", event.target.value)}
              />
            </FormField>
            <FormField label="Soyad" htmlFor="visitor-last-name" required error={errors.lastName}>
              <Input
                id="visitor-last-name"
                value={values.lastName}
                invalid={Boolean(errors.lastName)}
                onChange={(event) => update("lastName", event.target.value)}
              />
            </FormField>
            <FormField label="Telefon" htmlFor="visitor-phone">
              <Input
                id="visitor-phone"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
              />
            </FormField>
            <FormField label="T.C. Kimlik No" htmlFor="visitor-national-id">
              <Input
                id="visitor-national-id"
                value={values.nationalId}
                onChange={(event) => update("nationalId", event.target.value)}
                inputMode="numeric"
              />
            </FormField>
            <FormField label="Not" htmlFor="visitor-note" className="md:col-span-2">
              <Textarea
                id="visitor-note"
                rows={3}
                className="min-h-[76px]"
                value={values.note}
                onChange={(event) => update("note", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
