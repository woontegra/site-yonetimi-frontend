"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Filter } from "lucide-react";
import { ApartmentCombobox } from "@/components/apartments/ApartmentCombobox";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Apartment } from "@/lib/apartments-api";
import type { BankMatchingRule, BankMatchingRulePayload } from "@/lib/banks-api";
import type { Building } from "@/lib/buildings-api";
import type { PersonListItem } from "@/lib/persons-api";

export type BankMatchingRuleFormValues = {
  name: string;
  containsText: string;
  bankAccountId: string;
  buildingId: string;
  apartmentId: string;
  personId: string;
  priority: string;
};

export type BankAccountOption = {
  id: string;
  bankName: string;
  accountName: string;
};

export function emptyBankMatchingRuleForm(
  defaults?: Partial<BankMatchingRuleFormValues>,
): BankMatchingRuleFormValues {
  return {
    name: defaults?.name ?? "",
    containsText: defaults?.containsText ?? "",
    bankAccountId: defaults?.bankAccountId ?? "",
    buildingId: defaults?.buildingId ?? "",
    apartmentId: defaults?.apartmentId ?? "",
    personId: defaults?.personId ?? "",
    priority: defaults?.priority ?? "100",
  };
}

export function bankMatchingRuleToForm(rule: BankMatchingRule): BankMatchingRuleFormValues {
  return {
    name: rule.name,
    containsText: rule.containsText,
    bankAccountId: rule.bankAccount?.id ?? "",
    buildingId: rule.building?.id ?? "",
    apartmentId: rule.apartment?.id ?? "",
    personId: rule.person?.id ?? "",
    priority: String(rule.priority),
  };
}

export function validateBankMatchingRuleForm(
  values: BankMatchingRuleFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = "Kural adı zorunludur.";
  if (!values.containsText.trim()) errors.containsText = "Eşleşme ifadesi zorunludur.";
  if (values.priority.trim()) {
    const priority = Number(values.priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 1000) {
      errors.priority = "Öncelik 1–1000 arasında olmalıdır.";
    }
  }
  return errors;
}

export function bankMatchingRuleFormToPayload(
  values: BankMatchingRuleFormValues,
  bankAccountId?: string,
): BankMatchingRulePayload {
  const priority = values.priority.trim() ? Number(values.priority) : undefined;
  const resolvedAccountId = bankAccountId || values.bankAccountId || undefined;
  return {
    ...(resolvedAccountId ? { bankAccountId: resolvedAccountId } : {}),
    name: values.name.trim(),
    containsText: values.containsText.trim(),
    ...(values.buildingId ? { buildingId: values.buildingId } : {}),
    ...(values.apartmentId ? { apartmentId: values.apartmentId } : {}),
    ...(values.personId ? { personId: values.personId } : {}),
    ...(priority !== undefined ? { priority } : {}),
  };
}

type BankMatchingRuleFormModalProps = {
  open: boolean;
  mode?: "create" | "edit";
  siteLabel?: string;
  bankAccounts?: BankAccountOption[];
  showBankAccountField?: boolean;
  buildings: Building[];
  apartments: Apartment[];
  persons: PersonListItem[];
  initialValues: BankMatchingRuleFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: BankMatchingRuleFormValues) => Promise<void>;
  onBuildingChange: (buildingId: string) => void;
};

export function BankMatchingRuleFormModal({
  open,
  mode = "create",
  siteLabel,
  bankAccounts,
  showBankAccountField = false,
  buildings,
  apartments,
  persons,
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
  onBuildingChange,
}: BankMatchingRuleFormModalProps) {
  const [values, setValues] = useState<BankMatchingRuleFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
    if (initialValues.buildingId) onBuildingChange(initialValues.buildingId);
  }, [open, initialValues]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateBankMatchingRuleForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  return (
    <FormModal
      open={open}
      title={mode === "edit" ? "Eşleştirme Kuralı Düzenle" : "Eşleştirme Kuralı Ekle"}
      description="Açıklama metnine göre otomatik eşleştirme kuralı tanımlayın."
      icon={Filter}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="bank-rule-form" disabled={pending}>
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
      <form id="bank-rule-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Kural">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Kural Adı" htmlFor="br-name" required error={errors.name}>
              <Input
                id="br-name"
                data-modal-autofocus
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(event) => setValues((c) => ({ ...c, name: event.target.value }))}
              />
            </FormField>
            {showBankAccountField ? (
              <FormField label="Banka Hesabı" htmlFor="br-account">
                <Select
                  id="br-account"
                  value={values.bankAccountId}
                  disabled={mode === "edit"}
                  onChange={(event) =>
                    setValues((c) => ({ ...c, bankAccountId: event.target.value }))
                  }
                >
                  <option value="">Bu sitedeki tüm banka hesapları</option>
                  {(bankAccounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bankName} — {account.accountName}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
            <FormField
              label="Açıklamada Şu İfade Geçerse"
              htmlFor="br-contains"
              required
              error={errors.containsText}
            >
              <Input
                id="br-contains"
                value={values.containsText}
                invalid={Boolean(errors.containsText)}
                onChange={(event) =>
                  setValues((c) => ({ ...c, containsText: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Öncelik" htmlFor="br-priority" error={errors.priority}>
              <Input
                id="br-priority"
                inputMode="numeric"
                value={values.priority}
                invalid={Boolean(errors.priority)}
                onChange={(event) => setValues((c) => ({ ...c, priority: event.target.value }))}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Eşleştirme">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {siteLabel ? (
              <FormField label="Site" htmlFor="br-site">
                <Input id="br-site" value={siteLabel} disabled readOnly />
              </FormField>
            ) : null}
            <FormField label="Bina" htmlFor="br-building">
              <Select
                id="br-building"
                value={values.buildingId}
                onChange={(event) => {
                  const buildingId = event.target.value;
                  setValues((c) => ({ ...c, buildingId, apartmentId: "" }));
                  onBuildingChange(buildingId);
                }}
              >
                <option value="">Seçilmedi</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Daire" htmlFor="br-apartment">
              <ApartmentCombobox
                id="br-apartment"
                apartments={apartments}
                value={values.apartmentId}
                disabled={!values.buildingId}
                onChange={(apartmentId) => setValues((c) => ({ ...c, apartmentId }))}
              />
            </FormField>
            <FormField label="Kişi" htmlFor="br-person">
              <Select
                id="br-person"
                value={values.personId}
                onChange={(event) => setValues((c) => ({ ...c, personId: event.target.value }))}
              >
                <option value="">Seçilmedi</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
