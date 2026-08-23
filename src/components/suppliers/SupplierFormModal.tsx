"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { Supplier, SupplierPayload } from "@/lib/suppliers-api";

export type SupplierFormValues = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  taxNumber: string;
  taxOffice: string;
  city: string;
  district: string;
  address: string;
  note: string;
};

export function emptySupplierForm(): SupplierFormValues {
  return {
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    taxNumber: "",
    taxOffice: "",
    city: "",
    district: "",
    address: "",
    note: "",
  };
}

export function supplierToForm(supplier: Supplier): SupplierFormValues {
  return {
    name: supplier.name,
    contactPerson: supplier.contactPerson ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    taxNumber: supplier.taxNumber ?? "",
    taxOffice: supplier.taxOffice ?? "",
    city: supplier.city ?? "",
    district: supplier.district ?? "",
    address: supplier.address ?? "",
    note: supplier.note ?? "",
  };
}

export function validateSupplierForm(values: SupplierFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = "Tedarikçi adı zorunludur.";
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Geçerli bir e-posta girin.";
  }
  return errors;
}

export function supplierFormToPayload(values: SupplierFormValues): SupplierPayload {
  return {
    name: values.name.trim(),
    ...(values.contactPerson.trim() ? { contactPerson: values.contactPerson.trim() } : {}),
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    ...(values.email.trim() ? { email: values.email.trim() } : {}),
    ...(values.taxNumber.trim() ? { taxNumber: values.taxNumber.trim() } : {}),
    ...(values.taxOffice.trim() ? { taxOffice: values.taxOffice.trim() } : {}),
    ...(values.city.trim() ? { city: values.city.trim() } : {}),
    ...(values.district.trim() ? { district: values.district.trim() } : {}),
    ...(values.address.trim() ? { address: values.address.trim() } : {}),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

type SupplierFormModalProps = {
  open: boolean;
  title: string;
  initialValues: SupplierFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
};

export function SupplierFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: SupplierFormModalProps) {
  const [values, setValues] = useState<SupplierFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open]);

  function update<K extends keyof SupplierFormValues>(key: K, value: SupplierFormValues[K]) {
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
    const nextErrors = validateSupplierForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  return (
    <FormModal
      open={open}
      title={title}
      description="Tedarikçi veya hizmet sağlayıcı bilgilerini girin."
      icon={isEdit ? Pencil : Truck}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="supplier-form" disabled={pending}>
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
      <form id="supplier-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Temel">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Tedarikçi Adı" htmlFor="supplier-name" required error={errors.name} className="md:col-span-2">
              <Input
                id="supplier-name"
                data-modal-autofocus
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(event) => update("name", event.target.value)}
              />
            </FormField>
            <FormField label="Yetkili" htmlFor="supplier-contact">
              <Input
                id="supplier-contact"
                value={values.contactPerson}
                onChange={(event) => update("contactPerson", event.target.value)}
              />
            </FormField>
            <FormField label="Telefon" htmlFor="supplier-phone">
              <Input
                id="supplier-phone"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
              />
            </FormField>
            <FormField label="E-posta" htmlFor="supplier-email" error={errors.email} className="md:col-span-2">
              <Input
                id="supplier-email"
                type="email"
                value={values.email}
                invalid={Boolean(errors.email)}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Vergi">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Vergi No" htmlFor="supplier-tax-number">
              <Input
                id="supplier-tax-number"
                value={values.taxNumber}
                onChange={(event) => update("taxNumber", event.target.value)}
              />
            </FormField>
            <FormField label="Vergi Dairesi" htmlFor="supplier-tax-office">
              <Input
                id="supplier-tax-office"
                value={values.taxOffice}
                onChange={(event) => update("taxOffice", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Adres">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Şehir" htmlFor="supplier-city">
              <Input
                id="supplier-city"
                value={values.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </FormField>
            <FormField label="İlçe" htmlFor="supplier-district">
              <Input
                id="supplier-district"
                value={values.district}
                onChange={(event) => update("district", event.target.value)}
              />
            </FormField>
            <FormField label="Adres" htmlFor="supplier-address" className="md:col-span-2">
              <Textarea
                id="supplier-address"
                rows={2}
                className="min-h-[64px]"
                value={values.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ek">
          <FormField label="Not" htmlFor="supplier-note">
            <Textarea
              id="supplier-note"
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
