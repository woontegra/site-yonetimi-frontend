"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Receipt } from "lucide-react";
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
import type { DuesDefinition, DuesPayload } from "@/lib/dues-api";
import {
  MONTH_LABELS,
  currentMonth,
  currentYear,
  toDateInputValue,
} from "@/lib/money";

export type DuesFormValues = {
  siteId: string;
  name: string;
  buildingId: string;
  amount: string;
  periodMonth: string;
  periodYear: string;
  dueDate: string;
  description: string;
};

export function emptyDuesForm(siteId = ""): DuesFormValues {
  return {
    siteId,
    name: "",
    buildingId: "",
    amount: "",
    periodMonth: String(currentMonth()),
    periodYear: String(currentYear()),
    dueDate: "",
    description: "",
  };
}

export function duesToForm(dues: DuesDefinition, siteId = ""): DuesFormValues {
  return {
    siteId,
    name: dues.name,
    buildingId: dues.building.id,
    amount: dues.amount,
    periodMonth: String(dues.periodMonth),
    periodYear: String(dues.periodYear),
    dueDate: toDateInputValue(dues.dueDate),
    description: dues.description ?? "",
  };
}

export function validateDuesForm(
  values: DuesFormValues,
  options?: { requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }
  if (!values.name.trim()) errors.name = "Aidat adı zorunludur.";
  if (!values.buildingId) errors.buildingId = "Bina seçimi zorunludur.";
  if (!values.amount.trim()) errors.amount = "Tutar zorunludur.";
  else {
    const amount = Number(values.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) errors.amount = "Tutar 0'dan büyük olmalıdır.";
  }
  if (!values.periodMonth) errors.periodMonth = "Ay zorunludur.";
  if (!values.periodYear) errors.periodYear = "Yıl zorunludur.";
  if (!values.dueDate) errors.dueDate = "Son ödeme tarihi zorunludur.";
  return errors;
}

export function duesFormToPayload(values: DuesFormValues): DuesPayload {
  return {
    name: values.name.trim(),
    buildingId: values.buildingId,
    amount: Number(values.amount.replace(",", ".")),
    periodYear: Number(values.periodYear),
    periodMonth: Number(values.periodMonth),
    dueDate: values.dueDate,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

type DuesFormModalProps = {
  open: boolean;
  title: string;
  initialValues: DuesFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: DuesFormValues) => Promise<void>;
};

export function DuesFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: DuesFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");
  const years = Array.from({ length: 7 }, (_, index) => currentYear() - 2 + index);

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(auth, values.siteId || null);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof DuesFormValues>(key: K, value: DuesFormValues[K]) {
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
    const nextErrors = validateDuesForm(values, { requireSite: !isEdit });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  const lockedSiteName =
    sites.find((item) => item.id === values.siteId)?.name || site?.name || "—";

  return (
    <FormModal
      open={open}
      title={title}
      description={
        isEdit
          ? "Aidat bilgisini güncelleyerek kaydı kaydedin."
          : "Belirli bir dönem için dairelere uygulanacak aidatı tanımlayın."
      }
      icon={isEdit ? Pencil : Receipt}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="dues-form" disabled={pending}>
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
      <form id="dues-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Kapsam">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {isEdit ? (
              <SiteContextField value={lockedSiteName} hint="Aidat bu siteye aittir." />
            ) : (
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
                autoFocus
              />
            )}
            <FormField label="Bina" htmlFor="dues-building" required error={errors.buildingId}>
              <Select
                id="dues-building"
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
          </div>
        </FormSection>

        <FormSection title="Aidat bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Aidat Adı" htmlFor="dues-name" required error={errors.name}>
              <Input
                id="dues-name"
                data-modal-autofocus={isEdit || undefined}
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Örn. Eylül 2026 Aidatı"
              />
            </FormField>
            <FormField label="Tutar" htmlFor="dues-amount" required error={errors.amount}>
              <Input
                id="dues-amount"
                inputMode="decimal"
                value={values.amount}
                invalid={Boolean(errors.amount)}
                onChange={(event) => update("amount", event.target.value)}
                placeholder="1500"
              />
            </FormField>
            <FormField label="Son Ödeme Tarihi" htmlFor="dues-due" required error={errors.dueDate}>
              <Input
                id="dues-due"
                type="date"
                value={values.dueDate}
                invalid={Boolean(errors.dueDate)}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </FormField>
            <FormField label="Ay" htmlFor="dues-month" required error={errors.periodMonth}>
              <Select
                id="dues-month"
                value={values.periodMonth}
                invalid={Boolean(errors.periodMonth)}
                onChange={(event) => update("periodMonth", event.target.value)}
              >
                <option value="">Ay seçin</option>
                {MONTH_LABELS.map((label, index) => (
                  <option key={label} value={String(index + 1)}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Yıl" htmlFor="dues-year" required error={errors.periodYear}>
              <Select
                id="dues-year"
                value={values.periodYear}
                invalid={Boolean(errors.periodYear)}
                onChange={(event) => update("periodYear", event.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Açıklama" htmlFor="dues-description">
            <Textarea
              id="dues-description"
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
