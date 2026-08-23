"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Wallet } from "lucide-react";
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
import { listApartmentDebts, type ApartmentDebt } from "@/lib/debts-api";
import { formatDateTr, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/money";
import { RELATION_TYPE_LABELS } from "@/lib/person-constants";
import { todayInputValue } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import type { PaymentMethod, PaymentPayload } from "@/lib/payments-api";
import { listRelations } from "@/lib/relations-api";

export type PaymentFormValues = {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod | "";
  personId: string;
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

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(auth, !locked ? siteId || null : null);
  const { apartments } = useApartmentsForBuilding(
    auth,
    !locked ? siteId || null : null,
    !locked ? buildingId || null : null,
  );

  const debts = locked ? (debtsProp ?? []) : loadedDebts;
  const persons = locked ? (personsProp ?? []) : loadedPersons;
  const relatedPersons = locked ? relatedProp : loadedRelated;

  const openDebts = useMemo(
    () => debts.filter((item) => item.status === "OPEN" && Number(item.remainingAmount) > 0),
    [debts],
  );

  const maxAmount = useMemo(
    () => openDebts.reduce((sum, item) => sum + Number(item.remainingAmount), 0),
    [openDebts],
  );

  const [values, setValues] = useState<PaymentFormValues>({
    amount: "",
    paymentDate: todayInputValue(),
    paymentMethod: "CASH",
    personId: "",
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
      listRelations(
        { ...auth, siteId },
        { apartmentId, active: true, perPage: 50 },
      ),
    ])
      .then(([debtResult, personResult, relationResult]) => {
        if (cancelled) return;
        setLoadedDebts(debtResult.items);
        setLoadedPersons(personResult.items);
        setLoadedRelated(
          relationResult.items.map((item) => ({
            id: item.person.id,
            fullName: item.person.fullName,
            roleLabel: RELATION_TYPE_LABELS[item.relationType],
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
        referenceNo: "",
        description: "",
        allocations: {},
      });
      setErrors({});
      return;
    }
    const defaultAmount =
      mode === "single" && openDebts[0] ? openDebts[0].remainingAmount : maxAmount.toFixed(2);
    const amountNum = Number(defaultAmount);
    setValues({
      amount: defaultAmount,
      paymentDate: todayInputValue(),
      paymentMethod: "CASH",
      personId: relatedPersons[0]?.id ?? "",
      referenceNo: "",
      description: "",
      allocations:
        mode === "single" && openDebts[0]
          ? { [openDebts[0].id]: openDebts[0].remainingAmount }
          : autoDistribute(amountNum, openDebts),
    });
    setErrors({});
  }, [open, mode, openDebts, maxAmount, relatedPersons, locked, apartmentId]);

  const personOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const person of relatedPersons) {
      map.set(person.id, { id: person.id, label: `${person.fullName} — ${person.roleLabel}` });
    }
    for (const person of persons) {
      if (!map.has(person.id)) {
        map.set(person.id, { id: person.id, label: person.fullName });
      }
    }
    return Array.from(map.values());
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

    const amount = Number(values.amount.replace(",", "."));
    if (!values.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      nextErrors.amount = "Ödeme tutarı zorunludur.";
    } else if (amount > maxAmount + 0.0001) {
      nextErrors.amount = "Ödeme tutarı kalan borç tutarını aşamaz.";
    }
    if (!values.paymentDate) nextErrors.paymentDate = "Ödeme tarihi zorunludur.";
    if (!values.paymentMethod) nextErrors.paymentMethod = "Ödeme yöntemi zorunludur.";

    const allocations = openDebts
      .map((debt) => ({
        apartmentDebtId: debt.id,
        amount: Number((values.allocations[debt.id] ?? "0").replace(",", ".")),
      }))
      .filter((item) => item.amount > 0);

    if (allocations.length === 0) nextErrors.allocations = "En az bir borç dağılımı gerekli.";

    const allocSum = allocations.reduce((sum, item) => sum + item.amount, 0);
    if (!nextErrors.amount && Math.abs(allocSum - amount) > 0.01) {
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

    await onSubmit(
      {
        apartmentId: resolvedApartmentId,
        amount,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod as PaymentMethod,
        ...(values.personId ? { personId: values.personId } : {}),
        ...(values.referenceNo.trim() ? { referenceNo: values.referenceNo.trim() } : {}),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        allocations,
      },
      resolvedSiteId,
    );
  }

  const contextLabel =
    apartmentContext?.label ||
    apartmentLabel ||
    "—";

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
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={pending || openDebts.length === 0 || loadingContext}
          >
            {pending ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Tahsilatı Kaydet
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
                  disabled={!siteId}
                  onChange={(event) => {
                    setBuildingId(event.target.value);
                    setApartmentId("");
                  }}
                >
                  <option value="">{siteId ? "Bina seçin" : "Önce site seçin"}</option>
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
              >
                <Select
                  id="pay-apartment"
                  value={apartmentId}
                  invalid={Boolean(errors.apartmentId)}
                  disabled={!buildingId}
                  onChange={(event) => setApartmentId(event.target.value)}
                >
                  <option value="">{buildingId ? "Daire seçin" : "Önce bina seçin"}</option>
                  {apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      Daire {apartment.number}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          )}
        </FormSection>

        {mode === "multi" && (locked || apartmentId) ? (
          <div className="rounded-[10px] border border-line bg-canvas/50 px-3 py-2 text-sm">
            <p className="font-medium text-ink">
              {locked ? apartmentLabel || contextLabel : `Daire seçildi`}
            </p>
            <p className="text-muted">
              {loadingContext
                ? "Borçlar yükleniyor..."
                : `Toplam Açık Borç: ${formatMoney(openDebtTotal ?? maxAmount)}`}
            </p>
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
            <FormField label="Ödeyen Kişi" htmlFor="pay-person">
              <Select
                id="pay-person"
                value={values.personId}
                onChange={(event) => setValues((c) => ({ ...c, personId: event.target.value }))}
              >
                <option value="">Seçilmedi</option>
                {personOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </Select>
            </FormField>
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

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
