"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Receipt } from "lucide-react";
import {
  parseAmountInput,
  suggestedDuesName,
} from "@/components/accounting/dues-status";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useApartmentsForBuilding, useBuildingsForSite } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import type {
  DuesDefinition,
  DuesPayload,
  MultiPeriodAssessmentPayload,
  MultiPeriodAssessmentPreview,
} from "@/lib/dues-api";
import { previewMultiPeriodAssessment } from "@/lib/dues-api";
import { cn } from "@/lib/cn";
import {
  dueDayLabel,
  expandCustomMonths,
  expandFullYear,
  expandPeriodRange,
  MAX_ASSESSMENT_PERIODS,
  parseDueDay,
  type PeriodMode,
} from "@/lib/dues-period";
import {
  MONTH_LABELS,
  currentMonth,
  currentYear,
  formatDateTr,
  formatMoney,
  formatPeriodLong,
  toDateInputValue,
} from "@/lib/money";

export type DuesFormValues = {
  siteId: string;
  name: string;
  buildingId: string;
  amount: string;
  periodMode: PeriodMode;
  periodMonth: string;
  periodYear: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  year: string;
  customMonths: number[];
  dueDay: string;
  dueDate: string;
  conflictPolicy: "ABORT" | "SKIP";
  description: string;
};

export function emptyDuesForm(siteId = ""): DuesFormValues {
  const month = currentMonth();
  const year = currentYear();
  return {
    siteId,
    name: suggestedDuesName(month, year),
    buildingId: "",
    amount: "",
    periodMode: "SINGLE",
    periodMonth: String(month),
    periodYear: String(year),
    startMonth: String(month),
    startYear: String(year),
    endMonth: String(month),
    endYear: String(year),
    year: String(year),
    customMonths: [month],
    dueDay: "10",
    dueDate: "",
    conflictPolicy: "ABORT",
    description: "",
  };
}

export function duesToForm(dues: DuesDefinition, siteId = ""): DuesFormValues {
  const base = emptyDuesForm(siteId);
  return {
    ...base,
    siteId,
    name: dues.name,
    buildingId: dues.building.id,
    amount: dues.amount,
    periodMode: "SINGLE",
    periodMonth: String(dues.periodMonth),
    periodYear: String(dues.periodYear),
    startMonth: String(dues.periodMonth),
    startYear: String(dues.periodYear),
    endMonth: String(dues.periodMonth),
    endYear: String(dues.periodYear),
    year: String(dues.periodYear),
    customMonths: [dues.periodMonth],
    dueDate: toDateInputValue(dues.dueDate),
    description: dues.description ?? "",
  };
}

export function validateDuesForm(
  values: DuesFormValues,
  options?: {
    requireSite?: boolean;
    requireApartments?: boolean;
    apartmentCount?: number;
    isEdit?: boolean;
  },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (options?.requireSite !== false && !values.siteId) {
    errors.siteId = "Site seçimi zorunludur.";
  }
  if (options?.isEdit && !values.name.trim()) errors.name = "Aidat açıklaması zorunludur.";
  if (!values.buildingId) errors.buildingId = "Bina seçimi zorunludur.";
  if (options?.requireApartments && (options.apartmentCount ?? 0) <= 0) {
    errors.buildingId = "Bu binada borçlandırılabilecek daire bulunmuyor.";
  }
  if (!values.amount.trim()) errors.amount = "Tutar zorunludur.";
  else {
    const amount = parseAmountInput(values.amount);
    if (amount == null || amount <= 0) errors.amount = "Tutar 0'dan büyük olmalıdır.";
  }

  if (options?.isEdit) {
    if (!values.periodMonth) errors.periodMonth = "Ay zorunludur.";
    if (!values.periodYear) errors.periodYear = "Yıl zorunludur.";
    if (!values.dueDate) errors.dueDate = "Son ödeme tarihi zorunludur.";
    return errors;
  }

  if (parseDueDay(values.dueDay) == null) {
    errors.dueDay = "Son ödeme günü 1–28 veya Ay Sonu olmalıdır.";
  }

  try {
    const periods = resolveClientPeriods(values);
    if (periods.length === 0) errors.periodMode = "En az bir dönem seçilmelidir.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dönem seçimi geçersiz.";
    if (values.periodMode === "CUSTOM") errors.customMonths = message;
    else if (values.periodMode === "RANGE") errors.endMonth = message;
    else if (values.periodMode === "YEAR") errors.year = message;
    else errors.periodMonth = message;
  }

  return errors;
}

function resolveClientPeriods(values: DuesFormValues) {
  if (values.periodMode === "SINGLE") {
    return [
      {
        periodYear: Number(values.periodYear),
        periodMonth: Number(values.periodMonth),
      },
    ];
  }
  if (values.periodMode === "RANGE") {
    return expandPeriodRange(
      Number(values.startYear),
      Number(values.startMonth),
      Number(values.endYear),
      Number(values.endMonth),
    );
  }
  if (values.periodMode === "YEAR") {
    return expandFullYear(Number(values.year));
  }
  return expandCustomMonths(Number(values.year), values.customMonths);
}

export function duesFormToPayload(
  values: DuesFormValues,
  options?: { chargeImmediately?: boolean },
): DuesPayload {
  const amount = parseAmountInput(values.amount);
  return {
    name: values.name.trim(),
    buildingId: values.buildingId,
    amount: amount ?? 0,
    periodYear: Number(values.periodYear),
    periodMonth: Number(values.periodMonth),
    dueDate: values.dueDate,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    ...(options?.chargeImmediately ? { chargeImmediately: true } : {}),
  };
}

export function duesFormToMultiPeriodPayload(
  values: DuesFormValues,
  options?: { assessmentBatchId?: string },
): MultiPeriodAssessmentPayload {
  const amount = parseAmountInput(values.amount) ?? 0;
  const dueDay = parseDueDay(values.dueDay) ?? 10;
  const base: MultiPeriodAssessmentPayload = {
    buildingId: values.buildingId,
    amount,
    dueDay,
    conflictPolicy: values.conflictPolicy,
    mode: values.periodMode,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    ...(options?.assessmentBatchId ? { assessmentBatchId: options.assessmentBatchId } : {}),
  };

  if (values.periodMode === "SINGLE") {
    return {
      ...base,
      periodYear: Number(values.periodYear),
      periodMonth: Number(values.periodMonth),
    };
  }
  if (values.periodMode === "RANGE") {
    return {
      ...base,
      startYear: Number(values.startYear),
      startMonth: Number(values.startMonth),
      endYear: Number(values.endYear),
      endMonth: Number(values.endMonth),
    };
  }
  if (values.periodMode === "YEAR") {
    return { ...base, year: Number(values.year) };
  }
  return {
    ...base,
    year: Number(values.year),
    months: values.customMonths,
  };
}

type StepId = 1 | 2 | 3;

type DuesFormModalProps = {
  open: boolean;
  title: string;
  initialValues: DuesFormValues;
  pending: boolean;
  error?: string;
  financialFieldsLocked?: boolean;
  existingDuesId?: string | null;
  assessmentBatchId?: string | null;
  onClose: () => void;
  onSubmit: (values: DuesFormValues) => Promise<void>;
};

const PERIOD_MODE_OPTIONS: Array<{ value: PeriodMode; label: string }> = [
  { value: "SINGLE", label: "Tek Ay" },
  { value: "RANGE", label: "Ay Aralığı" },
  { value: "YEAR", label: "Tüm Yıl" },
  { value: "CUSTOM", label: "Özel Aylar" },
];

export function DuesFormModal({
  open,
  title,
  initialValues,
  pending,
  error,
  financialFieldsLocked = false,
  existingDuesId,
  assessmentBatchId,
  onClose,
  onSubmit,
}: DuesFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<StepId>(1);
  const [assessmentPreview, setAssessmentPreview] = useState<MultiPeriodAssessmentPreview | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const wasOpenRef = useRef(false);
  const isEdit = title.toLocaleLowerCase("tr").includes("düzenle");
  const years = Array.from({ length: 7 }, (_, index) => currentYear() - 2 + index);

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings, loading: buildingsLoading } = useBuildingsForSite(
    auth,
    values.siteId || null,
  );
  const { apartments, loading: apartmentsLoading } = useApartmentsForBuilding(
    auth,
    values.siteId || null,
    values.buildingId || null,
  );

  const activeApartmentCount = apartments.length;
  const selectedBuilding = buildings.find((item) => item.id === values.buildingId);
  const registeredCount =
    selectedBuilding?.registeredApartmentCount ??
    (values.buildingId ? activeApartmentCount : null);
  const amountValue = parseAmountInput(values.amount);
  const dueDayValue = parseDueDay(values.dueDay);

  const selectedPeriodCount = useMemo(() => {
    try {
      return resolveClientPeriods(values).length;
    } catch {
      return 0;
    }
  }, [values]);

  useEffect(() => {
    if (!open || isEdit || step !== 3 || !auth || !values.buildingId || amountValue == null) {
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");
    const payload = duesFormToMultiPeriodPayload(values, {
      assessmentBatchId: assessmentBatchId ?? undefined,
    });
    void previewMultiPeriodAssessment({ ...auth, siteId: values.siteId || auth.siteId }, payload)
      .then((preview) => {
        if (!cancelled) setAssessmentPreview(preview);
      })
      .catch((err) => {
        if (!cancelled) {
          setAssessmentPreview(null);
          setPreviewError(
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : "Önizleme alınamadı.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    isEdit,
    step,
    auth,
    values,
    amountValue,
    assessmentBatchId,
  ]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setValues(initialValues);
      setErrors({});
      setStep(1);
      setAssessmentPreview(null);
      setPreviewLoading(false);
      setPreviewError("");
    }
    wasOpenRef.current = open;
  }, [open, initialValues]);

  function update<K extends keyof DuesFormValues>(key: K, value: DuesFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") next.buildingId = "";
      if (key === "periodMode" && value === "SINGLE") {
        next.name = suggestedDuesName(Number(next.periodMonth), Number(next.periodYear));
      }
      if (
        (key === "periodMonth" || key === "periodYear") &&
        next.periodMode === "SINGLE"
      ) {
        const month = Number(key === "periodMonth" ? value : next.periodMonth);
        const year = Number(key === "periodYear" ? value : next.periodYear);
        if (month && year) next.name = suggestedDuesName(month, year);
      }
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "siteId") delete next.buildingId;
      if (key === "periodMode") {
        delete next.periodMonth;
        delete next.customMonths;
        delete next.endMonth;
        delete next.year;
      }
      return next;
    });
    if (key === "conflictPolicy" || key === "periodMode") {
      setAssessmentPreview(null);
    }
  }

  function toggleCustomMonth(month: number) {
    setValues((current) => {
      const set = new Set(current.customMonths);
      if (set.has(month)) set.delete(month);
      else set.add(month);
      return { ...current, customMonths: [...set].sort((a, b) => a - b) };
    });
    setErrors((current) => {
      const next = { ...current };
      delete next.customMonths;
      return next;
    });
  }

  function validateStep(currentStep: StepId): boolean {
    if (currentStep === 1) {
      const nextErrors: Record<string, string> = {};
      if (!isEdit && !values.siteId) nextErrors.siteId = "Site seçimi zorunludur.";
      if (!values.buildingId) nextErrors.buildingId = "Bina seçimi zorunludur.";
      else if (!apartmentsLoading && activeApartmentCount <= 0) {
        nextErrors.buildingId = "Bu binada borçlandırılabilecek daire bulunmuyor.";
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }
    if (currentStep === 2) {
      const nextErrors = validateDuesForm(values, {
        requireSite: !isEdit,
        requireApartments: !isEdit,
        apartmentCount: activeApartmentCount,
        isEdit,
      });
      const keys = isEdit
        ? (["name", "amount", "periodMonth", "periodYear", "dueDate"] as const)
        : ([
            "amount",
            "periodMonth",
            "periodYear",
            "startMonth",
            "endMonth",
            "year",
            "customMonths",
            "dueDay",
            "periodMode",
          ] as const);
      const stepErrors: Record<string, string> = {};
      for (const key of keys) {
        if (nextErrors[key]) stepErrors[key] = nextErrors[key];
      }
      setErrors(stepErrors);
      return Object.keys(stepErrors).length === 0;
    }
    return true;
  }

  function goNext() {
    if (pending) return;
    if (!validateStep(step)) return;
    setStep((current) => (current < 3 ? ((current + 1) as StepId) : current));
  }

  function goBack() {
    if (pending) return;
    setStep((current) => (current > 1 ? ((current - 1) as StepId) : current));
  }

  async function handleCreateAssessment() {
    if (pending) return;
    if (step !== 3) return;
    const nextErrors = validateDuesForm(values, {
      requireSite: !isEdit,
      requireApartments: !isEdit,
      apartmentCount: activeApartmentCount,
      isEdit,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(Object.keys(nextErrors).some((key) => key === "siteId" || key === "buildingId") ? 1 : 2);
      return;
    }
    if (!isEdit) {
      if (previewLoading || !assessmentPreview?.canCreate) return;
      if (
        assessmentPreview.requiresConflictChoice &&
        values.conflictPolicy === "ABORT" &&
        assessmentPreview.skipPeriodCount > 0
      ) {
        return;
      }
    }
    await onSubmit(values);
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (step !== 3) return;
    void handleCreateAssessment();
  }

  const lockedSiteName =
    sites.find((item) => item.id === values.siteId)?.name || site?.name || "—";

  const steps = [
    { id: 1 as const, label: "Kapsam" },
    { id: 2 as const, label: "Aidat Bilgileri" },
    { id: 3 as const, label: "Kontrol ve Onay" },
  ];

  const createPeriodCount = assessmentPreview?.createPeriodCount ?? selectedPeriodCount;
  const createDebtCount = assessmentPreview?.totalDebtCount ?? 0;
  const confirmDisabled =
    pending ||
    (!isEdit &&
      (previewLoading ||
        Boolean(previewError) ||
        !assessmentPreview?.canCreate ||
        (assessmentPreview.requiresConflictChoice &&
          values.conflictPolicy === "ABORT" &&
          assessmentPreview.skipPeriodCount > 0 &&
          assessmentPreview.createPeriodCount > 0)));

  return (
    <FormModal
      open={open}
      title={isEdit ? title : "Aidat Borçlandırması Oluştur"}
      description={
        isEdit
          ? financialFieldsLocked
            ? "Borçlandırılmış aidatta dönem/tutar/kapsam kilitlidir. Gerekirse silip yeniden oluşturun; yalnızca güvenli alanlar düzenlenebilir."
            : "Aidat tanımını güncelleyin. Daha önce oluşmuş daire borçlarının tutarı otomatik değişmez."
          : "Seçtiğiniz dönemler için kapsamdaki dairelere aylık aidat borçları oluşturun."
      }
      icon={isEdit ? Pencil : Receipt}
      size={step === 3 && !isEdit ? "xl" : "lg"}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={pending}>
              <ChevronLeft className="size-4" aria-hidden />
              Geri
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={handleClose} disabled={pending}>
              İptal
            </Button>
          )}
          {step < 3 ? (
            <Button
              key="dues-wizard-next"
              type="button"
              onClick={goNext}
              disabled={pending || apartmentsLoading}
            >
              İleri
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              key="dues-wizard-confirm"
              type="button"
              onClick={() => void handleCreateAssessment()}
              disabled={confirmDisabled}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {isEdit ? "Kaydediliyor…" : "Borçlandırılıyor…"}
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden />
                  {isEdit
                    ? "Kaydet"
                    : createPeriodCount > 0
                      ? `${createPeriodCount} Dönemi ve ${createDebtCount} Borcu Oluştur`
                      : "Borçlandır"}
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <form id="dues-form" onSubmit={handleFormSubmit} className="space-y-5">
        <nav aria-label="Adımlar" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {steps.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-xs sm:text-sm",
                step === item.id
                  ? "border-accent bg-accent-subtle font-medium text-accent"
                  : step > item.id
                    ? "border-line bg-canvas text-ink"
                    : "border-transparent text-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  step === item.id
                    ? "bg-accent text-white"
                    : step > item.id
                      ? "bg-accent/15 text-accent"
                      : "bg-canvas text-muted",
                )}
              >
                {item.id}
              </span>
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </nav>

        {step === 1 ? (
          <div className="space-y-4">
            {!isEdit ? (
              <div className="rounded-md border border-accent/25 bg-accent-subtle px-3 py-2.5 text-sm text-ink">
                Aidat tanımı <strong>tek bir binaya</strong> bağlanır. Onayda seçilen her ay için
                o binanın aktif dairelerine ayrı borç oluşturulur.
              </div>
            ) : null}

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
                  disabled={(!values.siteId && !isEdit) || buildingsLoading || financialFieldsLocked}
                  onChange={(event) => update("buildingId", event.target.value)}
                >
                  <option value="">
                    {buildingsLoading
                      ? "Binalar yükleniyor..."
                      : values.siteId || isEdit
                        ? "Bina seçin"
                        : "Önce site seçin"}
                  </option>
                  {buildings.map((building) => {
                    const count = building.registeredApartmentCount;
                    return (
                      <option key={building.id} value={building.id}>
                        {building.name}
                        {count != null ? ` (${count} daire)` : ""}
                      </option>
                    );
                  })}
                </Select>
              </FormField>
            </div>

            {values.buildingId ? (
              <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
                <p className="font-medium text-ink">Kapsam özeti</p>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Site</dt>
                    <dd className="font-medium">{lockedSiteName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Bina</dt>
                    <dd className="font-medium">{selectedBuilding?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Kayıtlı daire</dt>
                    <dd className="font-medium">
                      {buildingsLoading || apartmentsLoading
                        ? "…"
                        : String(registeredCount ?? activeApartmentCount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Borçlandırılacak aktif daire</dt>
                    <dd className="font-medium">
                      {apartmentsLoading ? "…" : activeApartmentCount}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {!isEdit ? (
              <FormField
                label="Borçlandırma dönemi"
                htmlFor="dues-period-mode"
                required
                error={errors.periodMode}
              >
                <Select
                  id="dues-period-mode"
                  value={values.periodMode}
                  invalid={Boolean(errors.periodMode)}
                  onChange={(event) => update("periodMode", event.target.value as PeriodMode)}
                >
                  {PERIOD_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}

            {isEdit || values.periodMode === "SINGLE" ? (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Aidat dönemi</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Ay" htmlFor="dues-month" required error={errors.periodMonth}>
                    <Select
                      id="dues-month"
                      value={values.periodMonth}
                      invalid={Boolean(errors.periodMonth)}
                      disabled={financialFieldsLocked}
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
                      disabled={financialFieldsLocked}
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
              </div>
            ) : null}

            {!isEdit && values.periodMode === "RANGE" ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Ay aralığı</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Başlangıç ayı" htmlFor="dues-start-month" required>
                    <Select
                      id="dues-start-month"
                      value={values.startMonth}
                      onChange={(event) => update("startMonth", event.target.value)}
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={label} value={String(index + 1)}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Başlangıç yılı" htmlFor="dues-start-year" required>
                    <Select
                      id="dues-start-year"
                      value={values.startYear}
                      onChange={(event) => update("startYear", event.target.value)}
                    >
                      {years.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField
                    label="Bitiş ayı"
                    htmlFor="dues-end-month"
                    required
                    error={errors.endMonth}
                  >
                    <Select
                      id="dues-end-month"
                      value={values.endMonth}
                      invalid={Boolean(errors.endMonth)}
                      onChange={(event) => update("endMonth", event.target.value)}
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={label} value={String(index + 1)}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Bitiş yılı" htmlFor="dues-end-year" required>
                    <Select
                      id="dues-end-year"
                      value={values.endYear}
                      onChange={(event) => update("endYear", event.target.value)}
                    >
                      {years.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <p className="text-xs text-muted">
                  Tek işlemde en fazla {MAX_ASSESSMENT_PERIODS} ay. Seçili: {selectedPeriodCount} ay.
                </p>
              </div>
            ) : null}

            {!isEdit && values.periodMode === "YEAR" ? (
              <FormField label="Yıl" htmlFor="dues-full-year" required error={errors.year}>
                <Select
                  id="dues-full-year"
                  value={values.year}
                  invalid={Boolean(errors.year)}
                  onChange={(event) => update("year", event.target.value)}
                >
                  {years.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}

            {!isEdit && values.periodMode === "CUSTOM" ? (
              <div className="space-y-3">
                <FormField label="Yıl" htmlFor="dues-custom-year" required error={errors.year}>
                  <Select
                    id="dues-custom-year"
                    value={values.year}
                    invalid={Boolean(errors.year)}
                    onChange={(event) => update("year", event.target.value)}
                  >
                    {years.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Aylar"
                  htmlFor="dues-custom-months"
                  required
                  error={errors.customMonths}
                  hint="En az bir ay seçin. Birden fazla yıl için Ay Aralığı kullanın."
                >
                  <div id="dues-custom-months" className="flex flex-wrap gap-2">
                    {MONTH_LABELS.map((label, index) => {
                      const month = index + 1;
                      const selected = values.customMonths.includes(month);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleCustomMonth(month)}
                          className={cn(
                            "rounded-md border px-2.5 py-1.5 text-sm",
                            selected
                              ? "border-accent bg-accent-subtle font-medium text-accent"
                              : "border-line bg-surface text-ink hover:bg-canvas",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </FormField>
              </div>
            ) : null}

            {isEdit ? (
              <FormField
                label="Aidat açıklaması"
                htmlFor="dues-name"
                required
                error={errors.name}
                hint="Borç kaydında başlık olarak görünür."
              >
                <Input
                  id="dues-name"
                  value={values.name}
                  invalid={Boolean(errors.name)}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Örn. Eylül 2026 Aidatı"
                />
              </FormField>
            ) : values.periodMode === "SINGLE" ? (
              <p className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted">
                Oluşacak başlık:{" "}
                <span className="font-medium text-ink">
                  {suggestedDuesName(Number(values.periodMonth) || 1, Number(values.periodYear) || currentYear())}
                </span>
              </p>
            ) : (
              <p className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted">
                Her ay için ayrı başlık oluşturulur (ör. Eylül 2026 Aidatı). Tek yıllık toplam
                borç üretilmez.
              </p>
            )}

            <FormField
              label="Daire başına aylık aidat tutarı"
              htmlFor="dues-amount"
              required
              error={errors.amount}
              hint="Bu tutar seçilen her ay için daire başına ayrı ayrı uygulanır."
            >
              <div className="relative">
                <Input
                  id="dues-amount"
                  inputMode="decimal"
                  className="pr-12"
                  value={values.amount}
                  invalid={Boolean(errors.amount)}
                  disabled={financialFieldsLocked}
                  onChange={(event) => update("amount", event.target.value)}
                  placeholder="2.500,00"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  TL
                </span>
              </div>
            </FormField>

            {isEdit ? (
              <FormField
                label="Son ödeme tarihi"
                htmlFor="dues-due"
                required
                error={errors.dueDate}
              >
                <Input
                  id="dues-due"
                  type="date"
                  value={values.dueDate}
                  invalid={Boolean(errors.dueDate)}
                  disabled={financialFieldsLocked}
                  onChange={(event) => update("dueDate", event.target.value)}
                />
              </FormField>
            ) : (
              <FormField
                label="Son ödeme günü"
                htmlFor="dues-due-day"
                required
                error={errors.dueDay}
                hint="Seçilen her ay için aynı gün uygulanır. Ay Sonu seçilirse o ayın son takvim günü kullanılır."
              >
                <Select
                  id="dues-due-day"
                  value={values.dueDay}
                  invalid={Boolean(errors.dueDay)}
                  onChange={(event) => update("dueDay", event.target.value)}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={String(day)}>
                      Her ayın {day}&apos;i
                    </option>
                  ))}
                  <option value="END">Ay Sonu</option>
                </Select>
              </FormField>
            )}

            <FormField
              label="Açıklama"
              htmlFor="dues-description"
              hint="Opsiyonel. Seçilen bütün dönemlerin borçlarına uygulanır."
            >
              <Textarea
                id="dues-description"
                rows={3}
                className="min-h-[76px]"
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            {isEdit ? (
              <dl className="space-y-2.5 rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
                <SummaryRow label="Site" value={lockedSiteName} />
                <SummaryRow label="Bina" value={selectedBuilding?.name ?? "—"} />
                <SummaryRow
                  label="Dönem"
                  value={formatPeriodLong(Number(values.periodYear), Number(values.periodMonth))}
                />
                <SummaryRow
                  label="Son ödeme tarihi"
                  value={values.dueDate ? formatDateTr(values.dueDate) : "—"}
                />
                <SummaryRow
                  label="Daire başına aidat"
                  value={amountValue != null ? formatMoney(amountValue) : "—"}
                />
              </dl>
            ) : (
              <>
                <div className="rounded-md border border-accent/25 bg-accent-subtle px-3 py-2.5 text-sm text-ink">
                  Onayladığınızda her dönem için ayrı aidat tanımı ve daire borçları oluşturulur.
                  Ara adımlar finansal kayıt yazmaz.
                </div>

                {previewError ? <p className="text-sm text-danger">{previewError}</p> : null}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard
                    label="Seçilen dönem"
                    value={previewLoading ? "…" : `${assessmentPreview?.periodCount ?? selectedPeriodCount} ay`}
                  />
                  <StatCard
                    label="Toplam daire"
                    value={
                      previewLoading
                        ? "…"
                        : String(
                            assessmentPreview?.periods.find((p) => p.status === "CREATE")
                              ?.activeApartmentCount ??
                              registeredCount ??
                              activeApartmentCount,
                          )
                    }
                  />
                  <StatCard
                    label="Aylık aidat"
                    value={amountValue != null ? formatMoney(amountValue) : "—"}
                  />
                  <StatCard
                    label="Son ödeme düzeni"
                    value={dueDayValue != null ? dueDayLabel(dueDayValue) : "—"}
                  />
                </div>

                {(assessmentPreview?.requiresConflictChoice ||
                  (assessmentPreview?.skipPeriodCount ?? 0) > 0) &&
                !previewLoading ? (
                  <div className="space-y-3 rounded-md border border-warning/40 bg-warning/5 px-3 py-3 text-sm">
                    <p className="font-medium text-ink">
                      {assessmentPreview!.skipPeriodCount} dönem zaten borçlandırılmış.
                    </p>
                    <FormField label="Çakışma politikası" htmlFor="dues-conflict-policy">
                      <Select
                        id="dues-conflict-policy"
                        value={values.conflictPolicy}
                        onChange={(event) =>
                          update("conflictPolicy", event.target.value as "ABORT" | "SKIP")
                        }
                      >
                        <option value="SKIP">Çakışan dönemleri atla, yalnız yenileri oluştur</option>
                        <option value="ABORT">Çakışan dönem varsa işlemi iptal et</option>
                      </Select>
                    </FormField>
                    {values.conflictPolicy === "ABORT" &&
                    assessmentPreview!.createPeriodCount > 0 ? (
                      <p className="text-warning">
                        Bu seçenekle işlem oluşturulmaz. Devam etmek için çakışanları atlayın veya
                        dönem seçimini değiştirin.
                      </p>
                    ) : null}
                    {assessmentPreview!.blockedByConflicts ? (
                      <p className="text-danger">
                        Seçilen dönemlerin tümü zaten borçlandırılmış.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-canvas text-xs text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Dönem</th>
                        <th className="px-3 py-2 font-medium">Durum</th>
                        <th className="px-3 py-2 text-right font-medium">Normal</th>
                        <th className="px-3 py-2 text-right font-medium">Muaf</th>
                        <th className="px-3 py-2 text-right font-medium">Aylık tahakkuk</th>
                        <th className="px-3 py-2 text-right font-medium">Son ödeme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewLoading ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-muted">
                            Önizleme hesaplanıyor…
                          </td>
                        </tr>
                      ) : assessmentPreview ? (
                        assessmentPreview.periods.map((period) => (
                          <tr key={`${period.periodYear}-${period.periodMonth}`} className="border-t border-line">
                            <td className="px-3 py-2 font-medium text-ink">{period.periodLabel}</td>
                            <td className="px-3 py-2">
                              {period.status === "EXISTS" ? (
                                <span className="text-warning">Zaten borçlandırılmış</span>
                              ) : (
                                <span className="text-success">Oluşturulacak</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {period.status === "EXISTS" ? "—" : period.normalChargeCount}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {period.status === "EXISTS" ? "—" : period.exemptCount}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {period.status === "EXISTS"
                                ? "—"
                                : formatMoney(period.totalChargeAmount)}
                            </td>
                            <td className="px-3 py-2 text-right">{formatDateTr(period.dueDate)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-muted">
                            Önizleme yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <dl className="space-y-2 rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
                  <SummaryRow
                    label="Oluşturulacak dönem"
                    value={previewLoading ? "…" : String(assessmentPreview?.createPeriodCount ?? 0)}
                  />
                  <SummaryRow
                    label="Oluşturulacak borç"
                    value={previewLoading ? "…" : String(assessmentPreview?.totalDebtCount ?? 0)}
                  />
                  <SummaryRow
                    label="Muaf tutulan dönem/daire satırı"
                    value={previewLoading ? "…" : String(assessmentPreview?.totalExemptRows ?? 0)}
                  />
                  <SummaryRow
                    label="Toplam tahakkuk"
                    value={
                      previewLoading
                        ? "…"
                        : formatMoney(assessmentPreview?.totalChargeAmount ?? "0")
                    }
                    strong
                  />
                </dl>
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="space-y-1 text-[13px] text-danger">
            <p>{error}</p>
            {existingDuesId ? (
              <Link
                href={`/app/muhasebe/aidatlar/${existingDuesId}`}
                className="font-medium text-brand hover:underline"
              >
                Mevcut Aidatı Gör
              </Link>
            ) : null}
          </div>
        ) : null}
      </form>
    </FormModal>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "text-right font-semibold text-ink" : "text-right font-medium text-ink"}>
        {value}
      </dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}
