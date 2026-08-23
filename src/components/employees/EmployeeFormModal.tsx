"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, UserRound } from "lucide-react";
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
import { useApiAuth } from "@/lib/active-site-context";
import type {
  AssignmentScope,
  Employee,
  EmployeePayload,
  EmployeeUpdatePayload,
} from "@/lib/employees-api";
import { toDateInputValue } from "@/lib/person-constants";

export type EmployeeFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  jobTitle: string;
  hireDate: string;
  address: string;
  siteId: string;
  scope: AssignmentScope | "";
  buildingId: string;
};

export function emptyEmployeeForm(siteId = ""): EmployeeFormValues {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    jobTitle: "",
    hireDate: "",
    address: "",
    siteId,
    scope: "SITE",
    buildingId: "",
  };
}

export function employeeToForm(employee: Employee, siteId = ""): EmployeeFormValues {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    jobTitle: employee.jobTitle,
    hireDate: toDateInputValue(employee.hireDate),
    address: employee.address ?? "",
    siteId,
    scope: "",
    buildingId: "",
  };
}

export function validateEmployeeForm(
  values: EmployeeFormValues,
  options?: { requireAssignment?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.firstName.trim()) errors.firstName = "Ad zorunludur.";
  if (!values.lastName.trim()) errors.lastName = "Soyad zorunludur.";
  if (!values.jobTitle.trim()) errors.jobTitle = "Görev zorunludur.";
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Geçerli bir e-posta girin.";
  }
  if (options?.requireAssignment) {
    if (!values.siteId) errors.siteId = "Site seçimi zorunludur.";
    if (!values.scope) errors.scope = "Kapsam seçimi zorunludur.";
    if (values.scope === "BUILDING" && !values.buildingId) {
      errors.buildingId = "Bina seçimi zorunludur.";
    }
  }
  return errors;
}

export function employeeFormToCreatePayload(values: EmployeeFormValues): EmployeePayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    jobTitle: values.jobTitle.trim(),
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    ...(values.email.trim() ? { email: values.email.trim() } : {}),
    ...(values.address.trim() ? { address: values.address.trim() } : {}),
    ...(values.hireDate.trim() ? { hireDate: values.hireDate.trim() } : {}),
    assignment: {
      siteId: values.siteId,
      scope: values.scope as AssignmentScope,
      ...(values.scope === "BUILDING" && values.buildingId
        ? { buildingId: values.buildingId }
        : {}),
      ...(values.hireDate.trim() ? { startDate: values.hireDate.trim() } : {}),
    },
  };
}

export function employeeFormToUpdatePayload(values: EmployeeFormValues): EmployeeUpdatePayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    jobTitle: values.jobTitle.trim(),
    phone: values.phone.trim() ? values.phone.trim() : null,
    email: values.email.trim() ? values.email.trim() : null,
    address: values.address.trim() ? values.address.trim() : null,
    hireDate: values.hireDate.trim() ? values.hireDate.trim() : null,
  };
}

type EmployeeFormModalProps = {
  open: boolean;
  title: string;
  initialValues: EmployeeFormValues;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
};

export function EmployeeFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const [values, setValues] = useState<EmployeeFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(
    auth,
    !isEdit && values.scope === "BUILDING" ? values.siteId || null : null,
  );

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  function update<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") next.buildingId = "";
      if (key === "scope" && value !== "BUILDING") next.buildingId = "";
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "siteId" || key === "scope") delete next.buildingId;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateEmployeeForm(values, { requireAssignment: !isEdit });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  return (
    <FormModal
      open={open}
      title={title}
      description="Çalışan bilgilerini girerek kaydı oluşturun."
      icon={isEdit ? Pencil : UserRound}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="employee-form" disabled={pending}>
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
      <form id="employee-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Kişi">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Ad" htmlFor="employee-first-name" required error={errors.firstName}>
              <Input
                id="employee-first-name"
                data-modal-autofocus
                value={values.firstName}
                invalid={Boolean(errors.firstName)}
                onChange={(event) => update("firstName", event.target.value)}
                autoComplete="given-name"
              />
            </FormField>
            <FormField label="Soyad" htmlFor="employee-last-name" required error={errors.lastName}>
              <Input
                id="employee-last-name"
                value={values.lastName}
                invalid={Boolean(errors.lastName)}
                onChange={(event) => update("lastName", event.target.value)}
                autoComplete="family-name"
              />
            </FormField>
            <FormField label="Telefon" htmlFor="employee-phone">
              <Input
                id="employee-phone"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
              />
            </FormField>
            <FormField label="E-posta" htmlFor="employee-email" error={errors.email}>
              <Input
                id="employee-email"
                type="email"
                value={values.email}
                invalid={Boolean(errors.email)}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Çalışma">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField
              label="Görevi"
              htmlFor="employee-job-title"
              required
              error={errors.jobTitle}
              className="md:col-span-2"
            >
              <Input
                id="employee-job-title"
                value={values.jobTitle}
                invalid={Boolean(errors.jobTitle)}
                onChange={(event) => update("jobTitle", event.target.value)}
                placeholder="Örn. Kapıcı, Güvenlik, Temizlik"
              />
            </FormField>
            <FormField label="İşe Giriş" htmlFor="employee-hire-date">
              <Input
                id="employee-hire-date"
                type="date"
                value={values.hireDate}
                onChange={(event) => update("hireDate", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        {!isEdit ? (
          <FormSection title="Görev yeri">
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
              />
              <FormField label="Kapsam" htmlFor="employee-scope" required error={errors.scope}>
                <Select
                  id="employee-scope"
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
                  htmlFor="employee-building"
                  required
                  error={errors.buildingId}
                  className="md:col-span-2"
                >
                  <Select
                    id="employee-building"
                    value={values.buildingId}
                    invalid={Boolean(errors.buildingId)}
                    disabled={!values.siteId}
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
              ) : null}
            </div>
          </FormSection>
        ) : null}

        <FormSection title="İletişim">
          <FormField label="Adres" htmlFor="employee-address">
            <Textarea
              id="employee-address"
              rows={3}
              className="min-h-[76px]"
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
            />
          </FormField>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
