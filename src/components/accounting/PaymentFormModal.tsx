"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Wallet } from "lucide-react";
import { ApartmentCombobox } from "@/components/apartments/ApartmentCombobox";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Badge } from "@/components/ui/Badge";
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
import { getApartmentOccupantView } from "@/lib/apartment-labels";
import { listApartmentDebts, type ApartmentDebt } from "@/lib/debts-api";
import { formatDateTr, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/money";
import { RELATION_TYPE_LABELS, todayInputValue } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import type { PaymentMethod, PaymentPayload, FinanceCheckResult } from "@/lib/payments-api";
import { previewPayment } from "@/lib/payments-api";
import {
  FinanceCheckPanel,
  hasUnresolvedFinanceBlocks,
  hasUnresolvedFinanceWarnings,
} from "@/components/accounting/FinanceCheckPanel";
import { listRelations } from "@/lib/relations-api";

const OTHER_PAYER = "__other__";

export type PaymentFormValues = {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod | "";
  personId: string;
  payerChoice: string;
  otherPayerName: string;
  referenceNo: string;
  description: string;
  allocations: Record<string, string>;
};

export type PaymentApartmentContext = {
  siteId: string;
  label: string;
};

type RelatedPerson = {
  id: string;
  fullName: string;
  roleLabel: string;
};

type PaymentFormModalProps = {
  open: boolean;
  mode: "single" | "multi";
  debts?: ApartmentDebt[];
  persons?: PersonListItem[];
  relatedPersons?: RelatedPerson[];
  /** When set, hierarchy is locked and debts/persons come from props. */
  apartmentContext?: PaymentApartmentContext | null;
  apartmentLabel?: string;
  openDebtTotal?: string;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (payload: PaymentPayload, siteId: string) => Promise<void>;
};

function autoDistribute(amount: number, debts: ApartmentDebt[]): Record<string, string> {
  const sorted = [...debts].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  let left = amount;
  const next: Record<string, string> = {};
  for (const debt of sorted) {
    if (left <= 0) {
      next[debt.id] = "0";
      continue;
    }
    const remaining = Number(debt.remainingAmount);
    const take = Math.min(remaining, left);
    next[debt.id] = take > 0 ? take.toFixed(2) : "0";
    left = Number((left - take).toFixed(2));
  }
  return next;
}

function shortRoleLabel(roleLabel: string): string {
  if (roleLabel.toLocaleLowerCase("tr").includes("kiracı")) return "Kiracı";
  if (roleLabel.toLocaleLowerCase("tr").includes("malik") || roleLabel.toLocaleLowerCase("tr").includes("mülk")) {
    return "Malik";
  }
  return roleLabel;
}

export function PaymentFormModal({
  open,
  mode,
  debts: debtsProp,
  persons: personsProp,
  relatedPersons: relatedProp = [],
  apartmentContext = null,
  apartmentLabel,
  openDebtTotal,
  pending,
  error,
  onClose,
  onSubmit,
}: PaymentFormModalProps) {
  const auth = useApiAuth({ requireSite: false });
  const { siteId: activeSiteId } = useActiveSite();
  const locked = Boolean(apartmentContext);

  const [siteId, setSiteId] = useState(apartmentContext?.siteId || activeSiteId || "");
  const [buildingId, setBuildingId] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [loadedDebts, setLoadedDebts] = useState<ApartmentDebt[]>([]);
  const [loadedPersons, setLoadedPersons] = useState<PersonListItem[]>([]);
  const [loadedRelated, setLoadedRelated] = useState<RelatedPerson[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [financeCheck, setFinanceCheck] = useState<FinanceCheckResult | null>(null);
  const [confirmedWarningCodes, setConfirmedWarningCodes] = useState<string[]>([]);
  const [previewPending, setPreviewPending] = useState(false);

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings, loading: buildingsLoading } = useBuildingsForSite(
    auth,
    !locked ? siteId || null : null,
  );
  const { apartments, loading: apartmentsLoading } = useApartmentsForBuilding(
    auth,
    !locked ? siteId || null : null,
    !locked ? buildingId || null : null,
  );

  const debts = locked ? (debtsProp ?? []) : loadedDebts;
  const persons = locked ? (personsProp ?? []) : loadedPersons;
  const relatedPersons = locked ? relatedProp : loadedRelated;

  const selectedApartment = useMemo(
    () => apartments.find((item) => item.id === apartmentId) ?? null,
    [apartments, apartmentId],
  );
  const selectedView = selectedApartment ? getApartmentOccupantView(selectedApartment) : null;

  const openDebts = useMemo(
    () =>
      [...debts]
        .filter((item) => item.status === "OPEN" && Number(item.remainingAmount) > 0)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [debts],
  );

  const maxAmount = useMemo(
    () => openDebts.reduce((sum, item) => sum + Number(item.remainingAmount), 0),
    [openDebts],
  );

  const overdueTotal = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return openDebts.reduce((sum, debt) => {
      const due = new Date(debt.dueDate);
      if (Number.isNaN(due.getTime()) || due >= today) return sum;
      return sum + Number(debt.remainingAmount);
    }, 0);
  }, [openDebts]);

  const [values, setValues] = useState<PaymentFormValues>({
    amount: "",
    paymentDate: todayInputValue(),
    paymentMethod: "CASH",
    personId: "",
    payerChoice: "",
    otherPayerName: "",
    referenceNo: "",
    description: "",
    allocations: {},
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (locked) {
      setSiteId(apartmentContext?.siteId || activeSiteId || "");
    } else {
      setSiteId(activeSiteId || "");
      setBuildingId("");
      setApartmentId("");
      setLoadedDebts([]);
      setLoadedPersons([]);
      setLoadedRelated([]);
    }
  }, [open, locked, apartmentContext?.siteId, activeSiteId]);

  useEffect(() => {
    if (!open || locked || !auth || !siteId || !apartmentId) {
      if (!locked) {
        setLoadedDebts([]);
        setLoadedRelated([]);
      }
      return;
    }
    let cancelled = false;
    setLoadingContext(true);
    void Promise.all([
      listApartmentDebts(
        { ...auth, siteId },
        { apartmentId, status: "OPEN", perPage: 100 },
      ),
      listPersons({ ...auth, siteId }, { status: "aktif", perPage: 100 }),
      listRelations({ ...auth, siteId }, { apartmentId, active: true, perPage: 50 }),
    ])
      .then(([debtResult, personResult, relationResult]) => {
        if (cancelled) return;
        setLoadedDebts(debtResult.items);
        setLoadedPersons(personResult.items);
        setLoadedRelated(
          relationResult.items.map((item) => ({
            id: item.person.id,
            fullName: item.person.fullName,
            roleLabel: shortRoleLabel(RELATION_TYPE_LABELS[item.relationType]),
          })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedDebts([]);
        setLoadedPersons([]);
        setLoadedRelated([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, locked, auth, siteId, apartmentId]);

  useEffect(() => {
    if (!open) return;
    if (!locked && !apartmentId) {
      setValues({
        amount: "",
        paymentDate: todayInputValue(),
        paymentMethod: "CASH",
        personId: "",
        payerChoice: "",
        otherPayerName: "",
        referenceNo: "",
        description: "",
        allocations: {},
      });
      setErrors({});
      return;
    }
    const defaultPayer = relatedPersons[0]?.id ?? "";
    const defaultAmount =
      mode === "single" && openDebts[0] ? openDebts[0].remainingAmount : maxAmount.toFixed(2);
    const amountNum = Number(defaultAmount);
    setValues({
      amount: openDebts.length > 0 ? defaultAmount : "",
      paymentDate: todayInputValue(),
      paymentMethod: "CASH",
      personId: defaultPayer,
      payerChoice: defaultPayer,
      otherPayerName: "",
      referenceNo: "",
      description: "",
      allocations:
        mode === "single" && openDebts[0]
          ? { [openDebts[0].id]: openDebts[0].remainingAmount }
          : autoDistribute(amountNum, openDebts),
    });
    setErrors({});
  }, [open, mode, openDebts, maxAmount, relatedPersons, locked, apartmentId]);

  const otherPersonOptions = useMemo(() => {
    const relatedIds = new Set(relatedPersons.map((person) => person.id));
    return persons.filter((person) => !relatedIds.has(person.id));
  }, [persons, relatedPersons]);

  function setAmount(amount: string) {
    const num = Number(amount.replace(",", "."));
    setValues((current) => ({
      ...current,
      amount,
      allocations:
        mode === "single" && openDebts[0]
          ? { [openDebts[0].id]: amount }
          : Number.isFinite(num)
            ? autoDistribute(num, openDebts)
            : current.allocations,
    }));
  }

  function handleAutoDistribute() {
    const num = Number(values.amount.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return;
    setValues((current) => ({
      ...current,
      allocations: autoDistribute(num, openDebts),
    }));
  }

  function onPayerChoiceChange(choice: string) {
    if (choice === OTHER_PAYER) {
      setValues((current) => ({
        ...current,
        payerChoice: OTHER_PAYER,
        personId: "",
      }));
      return;
    }
    setValues((current) => ({
      ...current,
      payerChoice: choice,
      personId: choice,
      otherPayerName: "",
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const resolvedSiteId = apartmentContext?.siteId || siteId;
    const nextErrors: Record<string, string> = {};
    if (!resolvedSiteId) nextErrors.siteId = "Site seçimi zorunludur.";
    if (!locked) {
      if (!buildingId) nextErrors.buildingId = "Bina seçimi zorunludur.";
      if (!apartmentId) nextErrors.apartmentId = "Daire seçimi zorunludur.";
    }

    if (openDebts.length === 0) {
      nextErrors.amount = "Bu dairenin açık borcu bulunmuyor. Tahsilat kaydedilemez.";
    }

    const amount = Number(values.amount.replace(",", "."));
    if (!values.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      nextErrors.amount = "Ödeme tutarı zorunludur.";
    } else if (amount > maxAmount + 0.0001) {
      nextErrors.amount =
        "Ödeme tutarı kalan borç tutarını aşamaz. Devreden fazla ödeme bu sürümde desteklenmiyor.";
    }
    if (!values.paymentDate) nextErrors.paymentDate = "Ödeme tarihi zorunludur.";
    if (!values.paymentMethod) nextErrors.paymentMethod = "Ödeme yöntemi zorunludur.";

    let resolvedPersonId = values.personId;
    if (values.payerChoice === OTHER_PAYER) {
      if (!values.personId && !values.otherPayerName.trim()) {
        nextErrors.personId = "Başka kişi için ad girin veya listeden seçin.";
      }
      resolvedPersonId = values.personId;
    }

    const allocations = openDebts
      .map((debt) => ({
        apartmentDebtId: debt.id,
        amount: Number((values.allocations[debt.id] ?? "0").replace(",", ".")),
      }))
      .filter((item) => item.amount > 0);

    if (openDebts.length > 0 && allocations.length === 0) {
      nextErrors.allocations = "En az bir borç dağılımı gerekli.";
    }

    const allocSum = allocations.reduce((sum, item) => sum + item.amount, 0);
    if (!nextErrors.amount && allocations.length > 0 && Math.abs(allocSum - amount) > 0.01) {
      nextErrors.allocations = "Dağıtım tutarları ödeme tutarına eşit olmalıdır.";
    }

    for (const allocation of allocations) {
      const debt = openDebts.find((item) => item.id === allocation.apartmentDebtId);
      if (debt && allocation.amount > Number(debt.remainingAmount) + 0.0001) {
        nextErrors.allocations = "Ödeme tutarı kalan borç tutarını aşamaz.";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const resolvedApartmentId = locked ? openDebts[0]?.apartment.id : apartmentId;
    if (!resolvedApartmentId || !resolvedSiteId) return;

    const otherNote = values.otherPayerName.trim();
    const baseDescription = values.description.trim();
    const description =
      values.payerChoice === OTHER_PAYER && otherNote && !resolvedPersonId
        ? [baseDescription, `Ödeyen: ${otherNote}`].filter(Boolean).join(" — ")
        : baseDescription;

    await onSubmit(
      {
        apartmentId: resolvedApartmentId,
        amount,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod as PaymentMethod,
        ...(resolvedPersonId ? { personId: resolvedPersonId } : {}),
        ...(values.referenceNo.trim() ? { referenceNo: values.referenceNo.trim() } : {}),
        ...(description ? { description } : {}),
        allocations,
        ...(confirmedWarningCodes.length > 0 ? { confirmedWarningCodes } : {}),
        ...(financeCheck?.debtSnapshot?.length
          ? {
              expectedRemainings: financeCheck.debtSnapshot.map((item) => ({
                apartmentDebtId: item.apartmentDebtId,
                remainingAmount: Number(item.remainingAmount),
              })),
            }
          : {}),
      },
      resolvedSiteId,
    );
  }

  const contextLabel = apartmentContext?.label || apartmentLabel || "—";
  const showApartmentDetails = locked || Boolean(apartmentId);
  const ownerNames =
    selectedView?.owners.map((person) => person.fullName).join(", ") ||
    relatedPersons
      .filter((person) => person.roleLabel === "Malik")
      .map((person) => person.fullName)
      .join(", ") ||
    "—";
  const tenantNames =
    selectedView?.tenants.map((person) => person.fullName).join(", ") ||
    relatedPersons
      .filter((person) => person.roleLabel === "Kiracı")
      .map((person) => person.fullName)
      .join(", ") ||
    "—";

  const allocationPreview = useMemo(() => {
    return openDebts
      .map((debt) => {
        const allocated = Number((values.allocations[debt.id] ?? "0").replace(",", "."));
        return { debt, allocated: Number.isFinite(allocated) ? allocated : 0 };
      })
      .filter((item) => item.allocated > 0);
  }, [openDebts, values.allocations]);

  useEffect(() => {
    if (!open) {
      setFinanceCheck(null);
      setConfirmedWarningCodes([]);
      return;
    }
    const resolvedApartmentId = locked ? openDebts[0]?.apartment.id : apartmentId;
    const resolvedSiteId = apartmentContext?.siteId || siteId;
    const amount = Number(values.amount.replace(",", "."));
    if (
      !auth ||
      !resolvedSiteId ||
      !resolvedApartmentId ||
      !values.paymentDate ||
      !values.paymentMethod ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setFinanceCheck(null);
      return;
    }

    const allocations = openDebts
      .map((debt) => ({
        apartmentDebtId: debt.id,
        amount: Number((values.allocations[debt.id] ?? "0").replace(",", ".")),
      }))
      .filter((item) => item.amount > 0);

    const timer = window.setTimeout(() => {
      setPreviewPending(true);
      void previewPayment(
        { ...auth, siteId: resolvedSiteId },
        {
          apartmentId: resolvedApartmentId,
          amount,
          paymentDate: values.paymentDate,
          paymentMethod: values.paymentMethod as PaymentMethod,
          ...(values.personId ? { personId: values.personId } : {}),
          ...(values.referenceNo.trim() ? { referenceNo: values.referenceNo.trim() } : {}),
          ...(allocations.length > 0 ? { allocations } : {}),
          confirmedWarningCodes,
        },
      )
        .then((result) => setFinanceCheck(result.check))
        .catch(() => setFinanceCheck(null))
        .finally(() => setPreviewPending(false));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    open,
    auth,
    locked,
    openDebts,
    apartmentId,
    apartmentContext?.siteId,
    siteId,
    values.amount,
    values.paymentDate,
    values.paymentMethod,
    values.personId,
    values.referenceNo,
    values.allocations,
    confirmedWarningCodes,
  ]);

  const financeBlocked = hasUnresolvedFinanceBlocks(financeCheck);
  const financeNeedsConfirm = hasUnresolvedFinanceWarnings(financeCheck, confirmedWarningCodes);

  return (
    <FormModal
      open={open}
      title="Ödeme Al"
      description={
        mode === "multi"
          ? "Dairenin açık borçlarına tahsilatı dağıtın."
          : "Bu borç için yapılan tahsilatı kaydedin."
      }
      icon={Wallet}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={
              pending ||
              previewPending ||
              openDebts.length === 0 ||
              loadingContext ||
              financeBlocked ||
              financeNeedsConfirm
            }
          >
            {pending ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                {allocationPreview.length > 1
                  ? `Tahsilatı Kaydet (${allocationPreview.length} borca dağıt)`
                  : "Tahsilatı Kaydet"}
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <FormSection title="Kapsam">
          {locked ? (
            <SiteContextField
              label="Konum"
              value={contextLabel}
              hint="Tahsilat bu daire kapsamında kaydedilir."
            />
          ) : (
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <SiteSelect
                value={siteId}
                onChange={(next) => {
                  setSiteId(next);
                  setBuildingId("");
                  setApartmentId("");
                  setErrors((current) => {
                    const nextErrors = { ...current };
                    delete nextErrors.siteId;
                    delete nextErrors.buildingId;
                    delete nextErrors.apartmentId;
                    return nextErrors;
                  });
                }}
                error={errors.siteId}
                autoFocus
              />
              <FormField label="Bina" htmlFor="pay-building" required error={errors.buildingId}>
                <Select
                  id="pay-building"
                  value={buildingId}
                  invalid={Boolean(errors.buildingId)}
                  disabled={!siteId || buildingsLoading}
                  onChange={(event) => {
                    setBuildingId(event.target.value);
                    setApartmentId("");
                  }}
                >
                  <option value="">
                    {buildingsLoading ? "Binalar yükleniyor…" : siteId ? "Bina seçin" : "Önce site seçin"}
                  </option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Daire"
                htmlFor="pay-apartment"
                required
                error={errors.apartmentId}
                className="md:col-span-2"
                hint="Daire no, malik veya kiracı adıyla arayabilirsiniz."
              >
                <ApartmentCombobox
                  id="pay-apartment"
                  apartments={apartments}
                  value={apartmentId}
                  loading={apartmentsLoading}
                  disabled={!buildingId || apartmentsLoading}
                  invalid={Boolean(errors.apartmentId)}
                  onChange={setApartmentId}
                />
              </FormField>
            </div>
          )}
        </FormSection>

        {showApartmentDetails ? (
          <div className="space-y-3 rounded-md border border-line bg-canvas/60 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Seçilen Daire</p>
                <p className="text-sm text-ink">
                  {locked
                    ? contextLabel
                    : selectedView
                      ? `${selectedView.buildingName} · Daire ${selectedView.apartmentNumber}`
                      : apartmentId
                        ? "Daire seçildi"
                        : "—"}
                </p>
              </div>
              {loadingContext ? (
                <Badge tone="neutral">Yükleniyor…</Badge>
              ) : openDebts.length > 0 ? (
                <Badge tone="warning">Açık borç var</Badge>
              ) : (
                <Badge tone="neutral">Açık borç yok</Badge>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Malik</dt>
                <dd className="font-medium text-ink">{ownerNames}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Kiracı / Oturan</dt>
                <dd className="font-medium text-ink">{tenantNames}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Açık borç</dt>
                <dd className="font-medium text-ink">
                  {loadingContext
                    ? "…"
                    : formatMoney(openDebtTotal ?? maxAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Vadesi geçmiş</dt>
                <dd className="font-medium text-ink">
                  {loadingContext ? "…" : formatMoney(overdueTotal)}
                </dd>
              </div>
            </dl>

            {loadingContext ? (
              <p className="text-sm text-muted">Borçlar yükleniyor…</p>
            ) : openDebts.length === 0 ? (
              <p className="text-sm text-muted">Bu dairenin açık borcu bulunmuyor.</p>
            ) : (
              <ul className="space-y-2 border-t border-line pt-3">
                {openDebts.map((debt) => {
                  const paid = Number(debt.originalAmount) - Number(debt.remainingAmount);
                  return (
                    <li
                      key={debt.id}
                      className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-ink">{debt.title}</p>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted sm:grid-cols-4">
                        <span>Borç: {formatMoney(debt.originalAmount)}</span>
                        <span>Ödenen: {formatMoney(paid > 0 ? paid : 0)}</span>
                        <span>Kalan: {formatMoney(debt.remainingAmount)}</span>
                        <span>Son ödeme: {formatDateTr(debt.dueDate)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <FormSection title="Ödeme">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Ödeme Tutarı" htmlFor="pay-amount" required error={errors.amount}>
              <Input
                id="pay-amount"
                data-modal-autofocus={locked || undefined}
                inputMode="decimal"
                value={values.amount}
                invalid={Boolean(errors.amount)}
                disabled={openDebts.length === 0}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FormField>
            <FormField label="Ödeme Tarihi" htmlFor="pay-date" required error={errors.paymentDate}>
              <Input
                id="pay-date"
                type="date"
                value={values.paymentDate}
                invalid={Boolean(errors.paymentDate)}
                onChange={(event) => setValues((c) => ({ ...c, paymentDate: event.target.value }))}
              />
            </FormField>
            <FormField
              label="Ödeme Yöntemi"
              htmlFor="pay-method"
              required
              error={errors.paymentMethod}
            >
              <Select
                id="pay-method"
                value={values.paymentMethod}
                invalid={Boolean(errors.paymentMethod)}
                onChange={(event) =>
                  setValues((c) => ({
                    ...c,
                    paymentMethod: event.target.value as PaymentMethod | "",
                  }))
                }
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Ödemeyi yapan"
              htmlFor="pay-person"
              error={errors.personId}
              hint="Daire seçimi borç kaydını kişiyi bağlamaz; ödeyen ayrı kaydedilir."
            >
              <Select
                id="pay-person"
                value={values.payerChoice}
                invalid={Boolean(errors.personId)}
                onChange={(event) => onPayerChoiceChange(event.target.value)}
              >
                <option value="">Seçilmedi</option>
                {relatedPersons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName} — {person.roleLabel}
                  </option>
                ))}
                <option value={OTHER_PAYER}>Başka kişi</option>
              </Select>
            </FormField>
            {values.payerChoice === OTHER_PAYER ? (
              <>
                <FormField label="Kayıtlı kişi seç (opsiyonel)" htmlFor="pay-other-person">
                  <Select
                    id="pay-other-person"
                    value={values.personId}
                    onChange={(event) =>
                      setValues((c) => ({ ...c, personId: event.target.value }))
                    }
                  >
                    <option value="">Listeden seçilmedi</option>
                    {otherPersonOptions.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Ödeyen adı (serbest)"
                  htmlFor="pay-other-name"
                  hint="Person seçilmezse açıklamaya yazılır; geçmiş kayıt bu metni korur."
                >
                  <Input
                    id="pay-other-name"
                    value={values.otherPayerName}
                    onChange={(event) =>
                      setValues((c) => ({ ...c, otherPayerName: event.target.value }))
                    }
                    placeholder="Ad Soyad"
                  />
                </FormField>
              </>
            ) : null}
            <FormField label="Referans / Dekont No" htmlFor="pay-ref" className="md:col-span-2">
              <Input
                id="pay-ref"
                value={values.referenceNo}
                onChange={(event) => setValues((c) => ({ ...c, referenceNo: event.target.value }))}
              />
            </FormField>
          </div>
        </FormSection>

        {mode === "multi" ? (
          <FormSection title="Borç dağılımı">
            <div className="mb-2 flex justify-end">
              <Button type="button" size="sm" variant="secondary" onClick={handleAutoDistribute}>
                Otomatik Dağıt
              </Button>
            </div>
            {openDebts.length === 0 ? (
              <p className="text-sm text-muted">
                {locked || apartmentId
                  ? "Seçilen dairede açık borç bulunmuyor."
                  : "Önce daire seçin."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-[10px] border border-line">
                  <table className="min-w-full text-sm">
                    <thead className="bg-canvas/70 text-left text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Borç</th>
                        <th className="px-3 py-2 font-medium">Vade</th>
                        <th className="px-3 py-2 text-right font-medium">Kalan</th>
                        <th className="px-3 py-2 text-right font-medium">Bu Ödemeden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openDebts.map((debt) => (
                        <tr key={debt.id} className="border-t border-line">
                          <td className="px-3 py-2 text-ink">{debt.title}</td>
                          <td className="px-3 py-2 text-ink">{formatDateTr(debt.dueDate)}</td>
                          <td className="px-3 py-2 text-right text-ink">
                            {formatMoney(debt.remainingAmount)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="ml-auto h-9 w-[110px] text-right"
                              inputMode="decimal"
                              value={values.allocations[debt.id] ?? "0"}
                              onChange={(event) =>
                                setValues((current) => ({
                                  ...current,
                                  allocations: {
                                    ...current.allocations,
                                    [debt.id]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {allocationPreview.length > 0 ? (
                  <div className="mt-3 rounded-md border border-accent/20 bg-accent-subtle/40 px-3 py-2 text-sm">
                    <p className="font-medium text-ink">Dağıtım önizlemesi</p>
                    <ul className="mt-1 space-y-1 text-muted">
                      {allocationPreview.map(({ debt, allocated }) => (
                        <li key={debt.id}>
                          {debt.title}: {formatMoney(allocated)}
                          {allocated >= Number(debt.remainingAmount) - 0.001
                            ? " → kapanacak"
                            : " → kısmi"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
            {errors.allocations ? (
              <p className="mt-2 text-[13px] text-danger">{errors.allocations}</p>
            ) : null}
          </FormSection>
        ) : null}

        <FormSection title="Ek bilgi">
          <FormField label="Açıklama" htmlFor="pay-note">
            <Textarea
              id="pay-note"
              rows={3}
              className="min-h-[76px]"
              value={values.description}
              onChange={(event) => setValues((c) => ({ ...c, description: event.target.value }))}
            />
          </FormField>
        </FormSection>

        <FinanceCheckPanel
          check={financeCheck}
          confirmedCodes={confirmedWarningCodes}
          hideAllocationPlan
          onConfirmCode={(code, confirmed) => {
            setConfirmedWarningCodes((current) =>
              confirmed
                ? current.includes(code)
                  ? current
                  : [...current, code]
                : current.filter((item) => item !== code),
            );
          }}
        />
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
