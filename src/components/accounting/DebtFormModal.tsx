"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Wallet } from "lucide-react";
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
import type { ApartmentDebt, ManualDebtPayload } from "@/lib/debts-api";
import { toDateInputValue } from "@/lib/money";

export type DebtFormValues = {
  siteId: string;
  buildingId: string;
  apartmentId: string;
  title: string;
  amount: string;
  dueDate: string;
  description: string;
};

export function emptyDebtForm(defaults?: Partial<DebtFormValues>): DebtFormValues {
  return {
    siteId: defaults?.siteId ?? "",
    buildingId: defaults?.buildingId ?? "",
    apartmentId: defaults?.apartmentId ?? "",
    title: defaults?.title ?? "",
    amount: defaults?.amount ?? "",
    dueDate: defaults?.dueDate ?? "",
    description: defaults?.description ?? "",
  };
}

export function debtToForm(debt: ApartmentDebt, siteId = ""): DebtFormValues {
  return {
    siteId,
    buildingId: debt.building.id,
    apartmentId: debt.apartment.id,
    title: debt.title,
    amount: debt.originalAmount,
    dueDate: toDateInputValue(debt.dueDate),
    description: debt.description ?? "",
  };
}

export function validateDebtForm(
  values: DebtFormValues,
  options?: { requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }
  if (!values.buildingId) errors.buildingId = "Bina seçimi zorunludur.";
  if (!values.apartmentId) errors.apartmentId = "Daire seçimi zorunludur.";
  if (!values.title.trim()) errors.title = "Borç başlığı zorunludur.";
  if (!values.amount.trim()) errors.amount = "Tutar zorunludur.";
  else {
    const amount = Number(values.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) errors.amount = "Tutar 0'dan büyük olmalıdır.";
  }
  if (!values.dueDate) errors.dueDate = "Son ödeme tarihi zorunludur.";
  return errors;
}

export function debtFormToPayload(values: DebtFormValues): ManualDebtPayload {
  return {
    buildingId: values.buildingId,
    apartmentId: values.apartmentId,
    title: values.title.trim(),
    amount: Number(values.amount.replace(",", ".")),
    dueDate: values.dueDate,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

type DebtFormModalProps = {
  open: boolean;
  title: string;
  initialValues: DebtFormValues;
  pending: boolean;
  error?: string;
  isEdit?: boolean;
  lockApartment?: boolean;
  allowAmountEdit?: boolean;
  siteLabel?: string;
  onClose: () => void;
  onSubmit: (values: DebtFormValues) => Promise<void>;
};

export function DebtFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  isEdit = false,
  lockApartment = false,
  allowAmountEdit = true,
  siteLabel,
  onClose,
  onSubmit,
}: DebtFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(
    auth,
    !isEdit ? values.siteId || null : null,
  );
  const { apartments } = useApartmentsForBuilding(
    auth,
    !isEdit ? values.siteId || null : null,
    !isEdit ? values.buildingId || null : null,
  );

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof DebtFormValues>(key: K, value: DebtFormValues[K]) {
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
    const nextErrors = validateDebtForm(values, { requireSite: !isEdit });
    if (isEdit) {
      delete nextErrors.siteId;
      delete nextErrors.buildingId;
      delete nextErrors.apartmentId;
    }
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
      description={
        isEdit
          ? "Borç bilgilerini güncelleyerek kaydı kaydedin."
          : "Daireye manuel borç kaydı oluşturun."
      }
      icon={isEdit ? Pencil : Wallet}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="debt-form" disabled={pending}>
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
      <form id="debt-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Borç bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {!isEdit ? (
              <>
                {lockApartment ? (
                  <SiteContextField
                    className="md:col-span-2"
                    value={lockedSiteName}
                    hint="Borç bu site kapsamında oluşturulur."
                  />
                ) : (
                  <SiteSelect
                    value={values.siteId}
                    onChange={(siteId) => update("siteId", siteId)}
                    error={errors.siteId}
                    autoFocus={!lockApartment}
                  />
                )}
                <FormField label="Bina" htmlFor="debt-building" required error={errors.buildingId}>
                  <Select
                    id="debt-building"
                    data-modal-autofocus={lockApartment || undefined}
                    value={values.buildingId}
                    invalid={Boolean(errors.buildingId)}
                    disabled={lockApartment || !values.siteId}
                    onChange={(event) => update("buildingId", event.target.value)}
                  >
                    <option value="">
                      {values.siteId ? "Bina seçin" : "Önce site seçin"}
                    </option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Daire" htmlFor="debt-apartment" required error={errors.apartmentId}>
                  <ApartmentCombobox
                    id="debt-apartment"
                    apartments={apartments}
                    value={values.apartmentId}
                    disabled={lockApartment || !values.buildingId}
                    invalid={Boolean(errors.apartmentId)}
                    onChange={(apartmentId) => update("apartmentId", apartmentId)}
                  />
                </FormField>
              </>
            ) : null}

            <FormField label="Borç Başlığı" htmlFor="debt-title" required error={errors.title}>
              <Input
                id="debt-title"
                data-modal-autofocus={isEdit || undefined}
                value={values.title}
                invalid={Boolean(errors.title)}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Örn. Çatı Tamirat Katılım Payı"
              />
            </FormField>
            <FormField label="Tutar" htmlFor="debt-amount" required error={errors.amount}>
              <Input
                id="debt-amount"
                inputMode="decimal"
                value={values.amount}
                invalid={Boolean(errors.amount)}
                disabled={isEdit && !allowAmountEdit}
                onChange={(event) => update("amount", event.target.value)}
              />
            </FormField>
            <FormField label="Son Ödeme Tarihi" htmlFor="debt-due" required error={errors.dueDate}>
              <Input
                id="debt-due"
                type="date"
                value={values.dueDate}
                invalid={Boolean(errors.dueDate)}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Açıklama" htmlFor="debt-description">
            <Textarea
              id="debt-description"
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
