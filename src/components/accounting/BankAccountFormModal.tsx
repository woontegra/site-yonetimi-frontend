"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Check } from "lucide-react";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useActiveSite } from "@/lib/active-site-context";
import type { BankAccount, BankAccountPayload } from "@/lib/banks-api";

export type BankAccountFormValues = {
  siteId: string;
  bankName: string;
  accountName: string;
  iban: string;
  accountNumber: string;
  branchName: string;
  openingBalance: string;
};

export function emptyBankAccountForm(
  defaults?: Partial<BankAccountFormValues>,
): BankAccountFormValues {
  return {
    siteId: defaults?.siteId ?? "",
    bankName: defaults?.bankName ?? "",
    accountName: defaults?.accountName ?? "",
    iban: defaults?.iban ?? "",
    accountNumber: defaults?.accountNumber ?? "",
    branchName: defaults?.branchName ?? "",
    openingBalance: defaults?.openingBalance ?? "0",
  };
}

export function bankAccountToForm(account: BankAccount, siteId = ""): BankAccountFormValues {
  return {
    siteId,
    bankName: account.bankName,
    accountName: account.accountName,
    iban: account.ibanFull ?? account.iban ?? "",
    accountNumber: account.accountNumber ?? "",
    branchName: account.branchName ?? "",
    openingBalance: account.openingBalance,
  };
}

export function validateBankAccountForm(
  values: BankAccountFormValues,
  options?: { requireSite?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }
  if (!values.bankName.trim()) errors.bankName = "Banka adı zorunludur.";
  if (!values.accountName.trim()) errors.accountName = "Hesap adı zorunludur.";
  if (values.openingBalance.trim()) {
    const balance = Number(values.openingBalance.replace(",", "."));
    if (Number.isNaN(balance) || balance < 0) {
      errors.openingBalance = "Açılış bakiyesi 0 veya daha büyük olmalıdır.";
    }
  }
  return errors;
}

export function bankAccountFormToPayload(values: BankAccountFormValues): BankAccountPayload {
  const opening = values.openingBalance.trim()
    ? Number(values.openingBalance.replace(",", "."))
    : 0;
  return {
    bankName: values.bankName.trim(),
    accountName: values.accountName.trim(),
    ...(values.iban.trim() ? { iban: values.iban.trim() } : {}),
    ...(values.accountNumber.trim() ? { accountNumber: values.accountNumber.trim() } : {}),
    ...(values.branchName.trim() ? { branchName: values.branchName.trim() } : {}),
    openingBalance: opening,
  };
}

type BankAccountFormModalProps = {
  open: boolean;
  mode?: "create" | "edit";
  initialValues: BankAccountFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: BankAccountFormValues) => Promise<void>;
};

export function BankAccountFormModal({
  open,
  mode = "create",
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: BankAccountFormModalProps) {
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<BankAccountFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = mode === "edit";

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof BankAccountFormValues>(key: K, value: BankAccountFormValues[K]) {
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
    const nextErrors = validateBankAccountForm(values, { requireSite: !isEdit });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  const lockedSiteName =
    sites.find((item) => item.id === values.siteId)?.name || site?.name || "—";

  return (
    <FormModal
      open={open}
      title={isEdit ? "Banka Hesabı Düzenle" : "Banka Hesabı Ekle"}
      description="Site yönetiminde kullanılan banka hesabını tanımlayın."
      icon={Building2}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="bank-account-form" disabled={pending}>
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
        id="bank-account-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5"
      >
        <FormSection title="Kapsam">
          {isEdit ? (
            <SiteContextField value={lockedSiteName} hint="Hesap bu siteye aittir." />
          ) : (
            <SiteSelect
              value={values.siteId}
              onChange={(siteId) => update("siteId", siteId)}
              error={errors.siteId}
              autoFocus
            />
          )}
        </FormSection>

        <FormSection title="Hesap bilgileri">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Banka Adı" htmlFor="ba-bank" required error={errors.bankName}>
              <Input
                id="ba-bank"
                data-modal-autofocus={isEdit || undefined}
                value={values.bankName}
                invalid={Boolean(errors.bankName)}
                onChange={(event) => update("bankName", event.target.value)}
              />
            </FormField>
            <FormField label="Hesap Adı" htmlFor="ba-name" required error={errors.accountName}>
              <Input
                id="ba-name"
                value={values.accountName}
                invalid={Boolean(errors.accountName)}
                onChange={(event) => update("accountName", event.target.value)}
              />
            </FormField>
            <FormField label="IBAN" htmlFor="ba-iban" className="md:col-span-2">
              <Input
                id="ba-iban"
                value={values.iban}
                onChange={(event) => update("iban", event.target.value)}
              />
            </FormField>
            <FormField label="Hesap No" htmlFor="ba-number">
              <Input
                id="ba-number"
                value={values.accountNumber}
                onChange={(event) => update("accountNumber", event.target.value)}
              />
            </FormField>
            <FormField label="Şube" htmlFor="ba-branch">
              <Input
                id="ba-branch"
                value={values.branchName}
                onChange={(event) => update("branchName", event.target.value)}
              />
            </FormField>
            <FormField
              label="Açılış Bakiyesi"
              htmlFor="ba-opening"
              error={errors.openingBalance}
              className="md:col-span-2"
            >
              <Input
                id="ba-opening"
                inputMode="decimal"
                value={values.openingBalance}
                invalid={Boolean(errors.openingBalance)}
                onChange={(event) => update("openingBalance", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
