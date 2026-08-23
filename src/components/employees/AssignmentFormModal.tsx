"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Building } from "@/lib/buildings-api";
import type { AssignmentPayload, AssignmentScope } from "@/lib/employees-api";
import { todayInputValue } from "@/lib/person-constants";

export type AssignmentFormValues = {
  scope: AssignmentScope | "";
  buildingId: string;
  startDate: string;
  note: string;
};

export function emptyAssignmentForm(): AssignmentFormValues {
  return {
    scope: "SITE",
    buildingId: "",
    startDate: todayInputValue(),
    note: "",
  };
}

export function validateAssignmentForm(values: AssignmentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.scope) errors.scope = "Kapsam seçimi zorunludur.";
  if (values.scope === "BUILDING" && !values.buildingId) {
    errors.buildingId = "Bina seçimi zorunludur.";
  }
  return errors;
}

export function assignmentFormToPayload(values: AssignmentFormValues): AssignmentPayload {
  const scope = values.scope as AssignmentScope;
  return {
    scope,
    ...(scope === "BUILDING" && values.buildingId ? { buildingId: values.buildingId } : {}),
    ...(values.startDate.trim() ? { startDate: values.startDate.trim() } : {}),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

type AssignmentFormModalProps = {
  open: boolean;
  buildings: Building[];
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: AssignmentFormValues) => Promise<void>;
};

export function AssignmentFormModal({
  open,
  buildings,
  pending,
  error,
  onClose,
  onSubmit,
}: AssignmentFormModalProps) {
  const [values, setValues] = useState<AssignmentFormValues>(emptyAssignmentForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(emptyAssignmentForm());
    setErrors({});
  }, [open]);

  function update<K extends keyof AssignmentFormValues>(key: K, value: AssignmentFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "scope" && value !== "BUILDING") {
        next.buildingId = "";
      }
      return next;
    });
    setErrors((current) => {
      if (!current[key] && !(key === "scope" && current.buildingId)) return current;
      const next = { ...current };
      delete next[key];
      if (key === "scope") delete next.buildingId;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateAssignmentForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  return (
    <FormModal
      open={open}
      title="Görevlendirme Ekle"
      description="Çalışanın görev yerini ve başlangıç bilgisini girin."
      icon={MapPin}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="assignment-form" disabled={pending}>
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
      <form
        id="assignment-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5"
      >
        <FormSection title="Görevlendirme">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Kapsam" htmlFor="assignment-scope" required error={errors.scope}>
              <Select
                id="assignment-scope"
                data-modal-autofocus
                value={values.scope}
                invalid={Boolean(errors.scope)}
                onChange={(event) => update("scope", event.target.value as AssignmentScope | "")}
              >
                <option value="SITE">Site Geneli</option>
                <option value="BUILDING">Bina</option>
              </Select>
            </FormField>

            {values.scope === "BUILDING" ? (
              <FormField
                label="Bina"
                htmlFor="assignment-building"
                required
                error={errors.buildingId}
              >
                <Select
                  id="assignment-building"
                  value={values.buildingId}
                  invalid={Boolean(errors.buildingId)}
                  onChange={(event) => update("buildingId", event.target.value)}
                >
                  <option value="">Bina seçin</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}

            <FormField label="Başlangıç" htmlFor="assignment-start-date">
              <Input
                id="assignment-start-date"
                type="date"
                value={values.startDate}
                onChange={(event) => update("startDate", event.target.value)}
              />
            </FormField>

            <FormField label="Not" htmlFor="assignment-note" className="md:col-span-2">
              <Textarea
                id="assignment-note"
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
