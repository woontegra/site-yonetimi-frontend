"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Receipt } from "lucide-react";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { SupplierSelect } from "@/components/suppliers/SupplierSelect";
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
import type { Expense, ExpensePayload, ExpenseType } from "@/lib/expenses-api";
import { PAYMENT_METHOD_LABELS, toDateInputValue } from "@/lib/money";
import { todayInputValue } from "@/lib/person-constants";
import type { PaymentMethod } from "@/lib/payments-api";

export type ExpenseFormValues = {
  siteId: string;
  title: string;
  expenseTypeId: string;
  amount: string;
  expenseDate: string;
  paymentMethod: PaymentMethod | "";
  buildingId: string;
  supplierId: string;
  supplierName: string;
  referenceNo: string;
  description: string;
};

export function emptyExpenseForm(defaults?: Partial<ExpenseFormValues>): ExpenseFormValues {
  return {
    siteId: defaults?.siteId ?? "",
    title: defaults?.title ?? "",
    expenseTypeId: defaults?.expenseTypeId ?? "",
    amount: defaults?.amount ?? "",
    expenseDate: defaults?.expenseDate ?? todayInputValue(),
    paymentMethod: defaults?.paymentMethod ?? "BANK_TRANSFER",
    buildingId: defaults?.buildingId ?? "",
    supplierId: defaults?.supplierId ?? "",
    supplierName: defaults?.supplierName ?? "",
    referenceNo: defaults?.referenceNo ?? "",
    description: defaults?.description ?? "",
  };
}

export function expenseToForm(expense: Expense, siteId = ""): ExpenseFormValues {
  return {
    siteId,
    title: expense.title,
    expenseTypeId: expense.expenseType.id,
    amount: expense.amount,
    expenseDate: toDateInputValue(expense.expenseDate),
    paymentMethod: expense.paymentMethod,
    buildingId: expense.building?.id ?? "",
    supplierId: expense.supplier?.id ?? "",
    supplierName: expense.supplier?.name ?? "",
    referenceNo: expense.referenceNo ?? "",
    description: expense.description ?? "",
  };
}

export function validateExpenseForm(
  values: ExpenseFormValues,
  options?: { requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }
  if (!values.title.trim()) errors.title = "Gider başlığı zorunludur.";
  if (!values.expenseTypeId) errors.expenseTypeId = "Gider türü zorunludur.";
  if (!values.amount.trim()) errors.amount = "Tutar zorunludur.";
  else {
    const amount = Number(values.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) errors.amount = "Tutar 0'dan büyük olmalıdır.";
  }
  if (!values.expenseDate) errors.expenseDate = "Gider tarihi zorunludur.";
  if (!values.paymentMethod) errors.paymentMethod = "Ödeme yöntemi zorunludur.";
  return errors;
}

export function expenseFormToPayload(values: ExpenseFormValues): ExpensePayload {
  return {
    title: values.title.trim(),
    expenseTypeId: values.expenseTypeId,
    amount: Number(values.amount.replace(",", ".")),
    expenseDate: values.expenseDate,
    paymentMethod: values.paymentMethod as PaymentMethod,
    ...(values.buildingId ? { buildingId: values.buildingId } : {}),
    ...(values.supplierId ? { supplierId: values.supplierId } : {}),
    ...(values.referenceNo.trim() ? { referenceNo: values.referenceNo.trim() } : {}),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  };
}

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

type ExpenseFormModalProps = {
  open: boolean;
  title: string;
  expenseTypes: ExpenseType[];
  initialValues: ExpenseFormValues;
  pending: boolean;
  error?: string;
  auth?: AuthContext | null;
  applySupplier?: { id: string; name?: string; token: number } | null;
  onQuickCreateSupplier?: () => void;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => Promise<void>;
};

export function ExpenseFormModal({
  open,
  title,
  expenseTypes,
  initialValues,
  pending,
  error,
  auth: authProp = null,
  applySupplier = null,
  onQuickCreateSupplier,
  onClose,
  onSubmit,
}: ExpenseFormModalProps) {
  const apiAuth = useApiAuth({ requireSite: false });
  const auth = authProp ?? apiAuth;
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<ExpenseFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

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

  useEffect(() => {
    if (!open || !applySupplier) return;
    setValues((current) => ({
      ...current,
      supplierId: applySupplier.id,
      supplierName: applySupplier.name ?? current.supplierName,
    }));
  }, [applySupplier, open]);

  function update<K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) {
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
    const nextErrors = validateExpenseForm(values, { requireSite: !isEdit });
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
      description="Site yönetimine ait gider kaydını oluşturun."
      icon={isEdit ? Pencil : Receipt}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="expense-form" disabled={pending}>
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
      <form id="expense-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Gider bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Gider Başlığı" htmlFor="exp-title" required error={errors.title} className="md:col-span-2">
              <Input
                id="exp-title"
                data-modal-autofocus
                value={values.title}
                invalid={Boolean(errors.title)}
                onChange={(event) => update("title", event.target.value)}
              />
            </FormField>
            <FormField label="Gider Türü" htmlFor="exp-type" required error={errors.expenseTypeId}>
              <Select
                id="exp-type"
                value={values.expenseTypeId}
                invalid={Boolean(errors.expenseTypeId)}
                onChange={(event) => update("expenseTypeId", event.target.value)}
              >
                <option value="">Seçin</option>
                {expenseTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Tutar" htmlFor="exp-amount" required error={errors.amount}>
              <Input
                id="exp-amount"
                inputMode="decimal"
                value={values.amount}
                invalid={Boolean(errors.amount)}
                onChange={(event) => update("amount", event.target.value)}
              />
            </FormField>
            <FormField label="Gider Tarihi" htmlFor="exp-date" required error={errors.expenseDate}>
              <Input
                id="exp-date"
                type="date"
                value={values.expenseDate}
                invalid={Boolean(errors.expenseDate)}
                onChange={(event) => update("expenseDate", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ödeme">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Ödeme Yöntemi" htmlFor="exp-method" required error={errors.paymentMethod}>
              <Select
                id="exp-method"
                value={values.paymentMethod}
                invalid={Boolean(errors.paymentMethod)}
                onChange={(event) =>
                  update("paymentMethod", event.target.value as PaymentMethod | "")
                }
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Referans / Belge No" htmlFor="exp-ref">
              <Input
                id="exp-ref"
                value={values.referenceNo}
                onChange={(event) => update("referenceNo", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Kapsam">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {isEdit ? (
              <SiteContextField value={lockedSiteName} hint="Gider bu siteye aittir." />
            ) : (
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
              />
            )}
            <FormField label="Bina" htmlFor="exp-building" hint="Boş bırakılırsa Genel Gider kaydedilir.">
              <Select
                id="exp-building"
                value={values.buildingId}
                disabled={!isEdit && !values.siteId}
                onChange={(event) => update("buildingId", event.target.value)}
              >
                <option value="">
                  {!isEdit && !values.siteId ? "Önce site seçin" : "Genel Gider"}
                </option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Tedarikçi" htmlFor="exp-supplier" className="md:col-span-2">
              <SupplierSelect
                auth={auth}
                value={values.supplierId}
                selectedName={values.supplierName}
                disabled={pending}
                onCreateNew={onQuickCreateSupplier}
                onChange={(supplierId, supplier) => {
                  setValues((c) => ({
                    ...c,
                    supplierId,
                    supplierName: supplier?.name ?? "",
                  }));
                }}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek bilgi">
          <FormField label="Açıklama" htmlFor="exp-note">
            <Textarea
              id="exp-note"
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
