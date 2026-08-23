"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, MessageSquareText } from "lucide-react";
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
import { listEmployees, type Employee } from "@/lib/employees-api";
import {
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_TYPE_LABELS,
  type FeedbackCategory,
  type FeedbackPayload,
  type FeedbackPriority,
  type FeedbackRecord,
  type FeedbackType,
} from "@/lib/feedback-api";
import { listPersons, type PersonListItem } from "@/lib/persons-api";

export type FeedbackFormValues = {
  siteId: string;
  type: FeedbackType | "";
  title: string;
  description: string;
  categoryId: string;
  priority: FeedbackPriority;
  buildingId: string;
  apartmentId: string;
  personId: string;
  employeeId: string;
};

export function emptyFeedbackForm(siteId = ""): FeedbackFormValues {
  return {
    siteId,
    type: "",
    title: "",
    description: "",
    categoryId: "",
    priority: "NORMAL",
    buildingId: "",
    apartmentId: "",
    personId: "",
    employeeId: "",
  };
}

export function feedbackToForm(record: FeedbackRecord): FeedbackFormValues {
  return {
    siteId: record.siteId,
    type: record.type,
    title: record.title,
    description: record.description,
    categoryId: record.categoryId ?? "",
    priority: record.priority,
    buildingId: record.buildingId ?? "",
    apartmentId: record.apartmentId ?? "",
    personId: record.personId ?? "",
    employeeId: record.employeeId ?? "",
  };
}

export function validateFeedbackForm(values: FeedbackFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.siteId) errors.siteId = "Site seçimi zorunludur.";
  if (!values.type) errors.type = "Tür seçimi zorunludur.";
  if (!values.title.trim()) errors.title = "Başlık zorunludur.";
  if (!values.description.trim()) errors.description = "Açıklama zorunludur.";
  return errors;
}

export function feedbackFormToPayload(values: FeedbackFormValues): FeedbackPayload {
  return {
    type: values.type as FeedbackType,
    title: values.title.trim(),
    description: values.description.trim(),
    priority: values.priority,
    categoryId: values.categoryId || null,
    buildingId: values.buildingId || null,
    apartmentId: values.apartmentId || null,
    personId: values.personId || null,
    employeeId: values.employeeId || null,
  };
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues: FeedbackFormValues;
  categories: FeedbackCategory[];
  pending: boolean;
  error?: string;
  lockSite?: boolean;
  siteLabel?: string;
  onClose: () => void;
  onSubmit: (values: FeedbackFormValues) => Promise<void>;
  onOpenCategories?: () => void;
};

export function FeedbackFormModal({
  open,
  mode,
  initialValues,
  categories,
  pending,
  error,
  lockSite = false,
  siteLabel,
  onClose,
  onSubmit,
  onOpenCategories,
}: Props) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [persons, setPersons] = useState<PersonListItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [personsLoading, setPersonsLoading] = useState(false);

  const isEdit = mode === "edit";

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(auth, values.siteId || null);
  const { apartments } = useApartmentsForBuilding(
    auth,
    values.siteId || null,
    values.buildingId || null,
  );

  const categoryOptions = useMemo(
    () => categories.filter((item) => item.isActive || item.id === values.categoryId),
    [categories, values.categoryId],
  );

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  useEffect(() => {
    if (!open || !auth || !values.siteId) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    void listEmployees(
      { ...auth, siteId: values.siteId },
      { status: "aktif", page: 1, perPage: 100 },
    )
      .then((result) => {
        if (!cancelled) setEmployees(result.items);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth?.token, auth?.tenantId, values.siteId]);

  useEffect(() => {
    if (!open || !auth || !values.siteId) {
      setPersons([]);
      return;
    }
    let cancelled = false;
    setPersonsLoading(true);
    void listPersons(
      { ...auth, siteId: values.siteId },
      {
        status: "aktif",
        page: 1,
        perPage: 100,
        apartmentId: values.apartmentId || undefined,
      },
    )
      .then((result) => {
        if (!cancelled) setPersons(result.items);
      })
      .catch(() => {
        if (!cancelled) setPersons([]);
      })
      .finally(() => {
        if (!cancelled) setPersonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth?.token, auth?.tenantId, values.siteId, values.apartmentId]);

  function update<K extends keyof FeedbackFormValues>(key: K, value: FeedbackFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") {
        next.buildingId = "";
        next.apartmentId = "";
        next.personId = "";
        next.employeeId = "";
      }
      if (key === "buildingId") {
        next.apartmentId = "";
        next.personId = "";
      }
      if (key === "apartmentId") {
        next.personId = "";
      }
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateFeedbackForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  const lockedSiteName =
    siteLabel || sites.find((item) => item.id === values.siteId)?.name || site?.name || "—";

  return (
    <FormModal
      open={open}
      title={isEdit ? "Kaydı Düzenle" : "Yeni Kayıt"}
      description={
        isEdit
          ? "Kayıt bilgilerini güncelleyin."
          : "Siteyle ilgili bilgi, öneri, talep veya şikâyeti kaydedin."
      }
      icon={MessageSquareText}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="feedback-form" disabled={pending}>
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
      <form id="feedback-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <FormSection title="Kayıt">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Tür" htmlFor="feedback-type" required error={errors.type}>
              <Select
                id="feedback-type"
                value={values.type}
                invalid={Boolean(errors.type)}
                onChange={(event) => update("type", event.target.value as FeedbackType | "")}
              >
                <option value="">Seçin</option>
                {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((type) => (
                  <option key={type} value={type}>
                    {FEEDBACK_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Öncelik" htmlFor="feedback-priority">
              <Select
                id="feedback-priority"
                value={values.priority}
                onChange={(event) => update("priority", event.target.value as FeedbackPriority)}
              >
                {(Object.keys(FEEDBACK_PRIORITY_LABELS) as FeedbackPriority[]).map((priority) => (
                  <option key={priority} value={priority}>
                    {FEEDBACK_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Başlık"
              htmlFor="feedback-title"
              required
              error={errors.title}
              className="md:col-span-2"
            >
              <Input
                id="feedback-title"
                value={values.title}
                invalid={Boolean(errors.title)}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Kısa başlık"
              />
            </FormField>
            <FormField
              label="Açıklama"
              htmlFor="feedback-description"
              required
              error={errors.description}
              className="md:col-span-2"
            >
              <Textarea
                id="feedback-description"
                rows={4}
                value={values.description}
                invalid={Boolean(errors.description)}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Detaylı açıklama"
              />
            </FormField>
            <FormField label="Kategori" htmlFor="feedback-category" className="md:col-span-2">
              <div className="flex gap-2">
                <Select
                  id="feedback-category"
                  className="flex-1"
                  value={values.categoryId}
                  onChange={(event) => update("categoryId", event.target.value)}
                >
                  <option value="">Seçilmedi</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {!category.isActive ? " (pasif)" : ""}
                    </option>
                  ))}
                </Select>
                {onOpenCategories ? (
                  <Button type="button" variant="secondary" onClick={onOpenCategories}>
                    Kategoriler
                  </Button>
                ) : null}
              </div>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Kapsam">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {isEdit || lockSite ? (
              <SiteContextField value={lockedSiteName} />
            ) : (
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
                autoFocus
              />
            )}
            <FormField label="Bina" htmlFor="feedback-building">
              <Select
                id="feedback-building"
                value={values.buildingId}
                disabled={!values.siteId}
                onChange={(event) => update("buildingId", event.target.value)}
              >
                <option value="">{!values.siteId ? "Önce site seçin" : "Site Geneli"}</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Daire" htmlFor="feedback-apartment">
              <Select
                id="feedback-apartment"
                value={values.apartmentId}
                disabled={!values.buildingId}
                onChange={(event) => update("apartmentId", event.target.value)}
              >
                <option value="">
                  {!values.buildingId ? "Önce bina seçin" : "Daire seçilmedi"}
                </option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>
                    Daire {apartment.number}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </FormSection>

        <FormSection title="İlgili Kişi">
          <FormField label="Kişi" htmlFor="feedback-person">
            <Select
              id="feedback-person"
              value={values.personId}
              disabled={!values.siteId || personsLoading}
              onChange={(event) => update("personId", event.target.value)}
            >
              <option value="">
                {personsLoading
                  ? "Yükleniyor..."
                  : values.apartmentId
                    ? "Daire sakinlerinden seçin (opsiyonel)"
                    : "Seçilmedi"}
              </option>
              {persons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                  {person.relationSummary ? ` · ${person.relationSummary}` : ""}
                </option>
              ))}
            </Select>
          </FormField>
        </FormSection>

        <FormSection title="Sorumlu">
          <FormField label="Çalışan" htmlFor="feedback-employee">
            <Select
              id="feedback-employee"
              value={values.employeeId}
              disabled={!values.siteId}
              onChange={(event) => update("employeeId", event.target.value)}
            >
              <option value="">Seçilmedi</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                  {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
                </option>
              ))}
            </Select>
          </FormField>
        </FormSection>
      </form>
    </FormModal>
  );
}
