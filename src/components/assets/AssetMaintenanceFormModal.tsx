"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Wrench } from "lucide-react";
import { parseMoneyInput } from "@/components/assets/AssetFormModal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  MAINTENANCE_TYPE_OPTIONS,
  type AssetMaintenance,
  type AssetMaintenancePayload,
} from "@/lib/assets-api";
import { toDateInputValue } from "@/lib/money";

export type AssetMaintenanceFormValues = {
  type: string;
  maintenanceDate: string;
  description: string;
  performedBy: string;
  cost: string;
  nextMaintenanceDate: string;
  note: string;
};

export function emptyMaintenanceForm(): AssetMaintenanceFormValues {
  return {
    type: MAINTENANCE_TYPE_OPTIONS[0],
    maintenanceDate: new Date().toISOString().slice(0, 10),
    description: "",
    performedBy: "",
    cost: "",
    nextMaintenanceDate: "",
    note: "",
  };
}

export function maintenanceToForm(item: AssetMaintenance): AssetMaintenanceFormValues {
  return {
    type: item.type,
    maintenanceDate: toDateInputValue(item.maintenanceDate),
    description: item.description,
    performedBy: item.performedBy ?? "",
    cost: item.cost ?? "",
    nextMaintenanceDate: toDateInputValue(item.nextMaintenanceDate),
    note: item.note ?? "",
  };
}

export function maintenanceFormToPayload(
  values: AssetMaintenanceFormValues,
): AssetMaintenancePayload {
  const cost = parseMoneyInput(values.cost);
  return {
    type: values.type.trim(),
    maintenanceDate: values.maintenanceDate,
    description: values.description.trim(),
    cost: cost === null || Number.isNaN(cost) ? null : cost,
    performedBy: values.performedBy.trim() || null,
    nextMaintenanceDate: values.nextMaintenanceDate || null,
    note: values.note.trim() || null,
  };
}

/** Create şeması null metin alanlarını kabul etmez; boş olanları payload'dan çıkarır. */
export function maintenancePayloadForCreate(
  payload: AssetMaintenancePayload,
): AssetMaintenancePayload {
  const next: AssetMaintenancePayload = {
    type: payload.type,
    maintenanceDate: payload.maintenanceDate,
    description: payload.description,
  };
  if (payload.cost != null) next.cost = payload.cost;
  if (payload.performedBy != null) next.performedBy = payload.performedBy;
  if (payload.nextMaintenanceDate != null) {
    next.nextMaintenanceDate = payload.nextMaintenanceDate;
  }
  if (payload.note != null) next.note = payload.note;
  return next;
}

export function validateMaintenanceForm(
  values: AssetMaintenanceFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.type.trim()) errors.type = "Bakım türü zorunludur.";
  if (!values.maintenanceDate) errors.maintenanceDate = "Bakım tarihi zorunludur.";
  if (!values.description.trim()) errors.description = "Açıklama zorunludur.";
  if (values.cost.trim()) {
    const cost = parseMoneyInput(values.cost);
    if (cost === null || Number.isNaN(cost) || cost < 0) {
      errors.cost = "Geçerli bir tutar girin.";
    }
  }
  return errors;
}

type AssetMaintenanceFormModalProps = {
  open: boolean;
  title: string;
  initialValues: AssetMaintenanceFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: AssetMaintenanceFormValues) => Promise<void>;
};

export function AssetMaintenanceFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: AssetMaintenanceFormModalProps) {
  const [values, setValues] = useState<AssetMaintenanceFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof AssetMaintenanceFormValues>(
    key: K,
    value: AssetMaintenanceFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateMaintenanceForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  const typeOptions = (MAINTENANCE_TYPE_OPTIONS as readonly string[]).includes(values.type)
    ? MAINTENANCE_TYPE_OPTIONS
    : [values.type, ...MAINTENANCE_TYPE_OPTIONS];

  return (
    <FormModal
      open={open}
      title={title}
      description="Demirbaşa ait bakım kaydını girin."
      icon={isEdit ? Pencil : Wrench}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="asset-maintenance-form" disabled={pending}>
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
        id="asset-maintenance-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <FormField label="Bakım Türü" htmlFor="maintenance-type" required error={errors.type}>
            <Select
              id="maintenance-type"
              data-modal-autofocus
              value={values.type}
              invalid={Boolean(errors.type)}
              onChange={(event) => update("type", event.target.value)}
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Bakım Tarihi"
            htmlFor="maintenance-date"
            required
            error={errors.maintenanceDate}
          >
            <Input
              id="maintenance-date"
              type="date"
              value={values.maintenanceDate}
              invalid={Boolean(errors.maintenanceDate)}
              onChange={(event) => update("maintenanceDate", event.target.value)}
            />
          </FormField>
          <FormField
            label="Açıklama"
            htmlFor="maintenance-description"
            required
            error={errors.description}
            className="md:col-span-2"
          >
            <Textarea
              id="maintenance-description"
              rows={3}
              className="min-h-[76px]"
              value={values.description}
              invalid={Boolean(errors.description)}
              onChange={(event) => update("description", event.target.value)}
            />
          </FormField>
          <FormField label="Yapan Kişi / Firma" htmlFor="maintenance-performed-by">
            <Input
              id="maintenance-performed-by"
              value={values.performedBy}
              onChange={(event) => update("performedBy", event.target.value)}
            />
          </FormField>
          <FormField label="Maliyet" htmlFor="maintenance-cost" error={errors.cost}>
            <Input
              id="maintenance-cost"
              inputMode="decimal"
              value={values.cost}
              invalid={Boolean(errors.cost)}
              onChange={(event) => update("cost", event.target.value)}
              placeholder="0,00"
            />
          </FormField>
          <FormField label="Sonraki Bakım Tarihi" htmlFor="maintenance-next-date">
            <Input
              id="maintenance-next-date"
              type="date"
              value={values.nextMaintenanceDate}
              onChange={(event) => update("nextMaintenanceDate", event.target.value)}
            />
          </FormField>
          <FormField label="Not" htmlFor="maintenance-note">
            <Input
              id="maintenance-note"
              value={values.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </FormField>
        </div>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
