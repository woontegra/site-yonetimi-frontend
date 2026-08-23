"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { BankDirection, BankTransactionPayload } from "@/lib/banks-api";
import { BANK_DIRECTION_LABELS } from "@/lib/money";
import { todayInputValue } from "@/lib/person-constants";

export type BankTransactionFormValues = {
  transactionDate: string;
  direction: BankDirection | "";
  amount: string;
  description: string;
  senderName: string;
  referenceNo: string;
};

export function emptyBankTransactionForm(
  defaults?: Partial<BankTransactionFormValues>,
): BankTransactionFormValues {
  return {
    transactionDate: defaults?.transactionDate ?? todayInputValue(),
    direction: defaults?.direction ?? "CREDIT",
    amount: defaults?.amount ?? "",
    description: defaults?.description ?? "",
    senderName: defaults?.senderName ?? "",
    referenceNo: defaults?.referenceNo ?? "",
  };
}

export function validateBankTransactionForm(
  values: BankTransactionFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.transactionDate) errors.transactionDate = "Tarih zorunludur.";
  if (!values.direction) errors.direction = "Yön zorunludur.";
  if (!values.amount.trim()) errors.amount = "Tutar zorunludur.";
  else {
    const amount = Number(values.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) errors.amount = "Tutar 0'dan büyük olmalıdır.";
  }
  if (!values.description.trim()) errors.description = "Açıklama zorunludur.";
  return errors;
}

export function bankTransactionFormToPayload(
  bankAccountId: string,
  values: BankTransactionFormValues,
): BankTransactionPayload {
  return {
    bankAccountId,
    transactionDate: values.transactionDate,
    direction: values.direction as BankDirection,
    amount: Number(values.amount.replace(",", ".")),
    description: values.description.trim(),
    ...(values.senderName.trim() ? { senderName: values.senderName.trim() } : {}),
    ...(values.referenceNo.trim() ? { referenceNo: values.referenceNo.trim() } : {}),
  };
}

type BankTransactionFormModalProps = {
  open: boolean;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: BankTransactionFormValues) => Promise<void>;
};

export function BankTransactionFormModal({
  open,
  pending,
  error,
  onClose,
  onSubmit,
}: BankTransactionFormModalProps) {
  const [values, setValues] = useState<BankTransactionFormValues>(emptyBankTransactionForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(emptyBankTransactionForm());
    setErrors({});
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateBankTransactionForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  return (
    <FormModal
      open={open}
      title="Manuel Hareket Ekle"
      description="Banka hesabına manuel hareket kaydı ekleyin."
      icon={ArrowLeftRight}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="bank-tx-form" disabled={pending}>
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
      <form id="bank-tx-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Hareket">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField
              label="Tarih"
              htmlFor="btx-date"
              required
              error={errors.transactionDate}
            >
              <Input
                id="btx-date"
                type="date"
                data-modal-autofocus
                value={values.transactionDate}
                invalid={Boolean(errors.transactionDate)}
                onChange={(event) =>
                  setValues((c) => ({ ...c, transactionDate: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Yön" htmlFor="btx-dir" required error={errors.direction}>
              <Select
                id="btx-dir"
                value={values.direction}
                invalid={Boolean(errors.direction)}
                onChange={(event) =>
                  setValues((c) => ({
                    ...c,
                    direction: event.target.value as BankDirection | "",
                  }))
                }
              >
                {(Object.keys(BANK_DIRECTION_LABELS) as BankDirection[]).map((direction) => (
                  <option key={direction} value={direction}>
                    {BANK_DIRECTION_LABELS[direction]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Tutar" htmlFor="btx-amount" required error={errors.amount}>
              <Input
                id="btx-amount"
                inputMode="decimal"
                value={values.amount}
                invalid={Boolean(errors.amount)}
                onChange={(event) => setValues((c) => ({ ...c, amount: event.target.value }))}
              />
            </FormField>
            <FormField label="Gönderen" htmlFor="btx-sender">
              <Input
                id="btx-sender"
                value={values.senderName}
                onChange={(event) => setValues((c) => ({ ...c, senderName: event.target.value }))}
              />
            </FormField>
            <FormField label="Referans No" htmlFor="btx-ref" className="md:col-span-2">
              <Input
                id="btx-ref"
                value={values.referenceNo}
                onChange={(event) => setValues((c) => ({ ...c, referenceNo: event.target.value }))}
              />
            </FormField>
            <FormField
              label="Açıklama"
              htmlFor="btx-desc"
              required
              error={errors.description}
              className="md:col-span-2"
            >
              <Textarea
                id="btx-desc"
                rows={3}
                className="min-h-[76px]"
                value={values.description}
                invalid={Boolean(errors.description)}
                onChange={(event) => setValues((c) => ({ ...c, description: event.target.value }))}
              />
            </FormField>
          </div>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
