"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { ApartmentCombobox } from "@/components/apartments/ApartmentCombobox";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import type { Apartment } from "@/lib/apartments-api";
import type { BankMatchPayload, BankProcessPayload, BankTransaction } from "@/lib/banks-api";
import type { Building } from "@/lib/buildings-api";
import type { ApartmentDebt } from "@/lib/debts-api";
import {
  BANK_DIRECTION_LABELS,
  formatDateTr,
  formatMoney,
} from "@/lib/money";
import type { PersonListItem } from "@/lib/persons-api";

export type RelatedPerson = {
  id: string;
  fullName: string;
  roleLabel: string;
};

type BankMatchModalProps = {
  open: boolean;
  transaction: BankTransaction | null;
  /** Hesabın ait olduğu site adı (read-only bağlam). */
  siteLabel: string;
  buildings: Building[];
  apartments: Apartment[];
  debts: ApartmentDebt[];
  persons: PersonListItem[];
  relatedPersons: RelatedPerson[];
  pending: boolean;
  error?: string;
  onClose: () => void;
  onBuildingChange: (buildingId: string) => void;
  onApartmentChange: (apartmentId: string) => void;
  onMatch: (payload: BankMatchPayload) => Promise<void>;
  onProcess: (matchPayload: BankMatchPayload, processPayload: BankProcessPayload) => Promise<void>;
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

export function BankMatchModal({
  open,
  transaction,
  siteLabel,
  buildings,
  apartments,
  debts,
  persons,
  relatedPersons,
  pending,
  error,
  onClose,
  onBuildingChange,
  onApartmentChange,
  onMatch,
  onProcess,
}: BankMatchModalProps) {
  const openDebts = useMemo(
    () => debts.filter((item) => item.status === "OPEN" && Number(item.remainingAmount) > 0),
    [debts],
  );

  const [buildingId, setBuildingId] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [personId, setPersonId] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [createRule, setCreateRule] = useState(false);
  const [containsText, setContainsText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState("");

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  useEffect(() => {
    if (!open || !transaction) return;
    const matchedBuildingId = transaction.matchedApartment?.building.id ?? "";
    const matchedApartmentId = transaction.matchedApartment?.id ?? "";
    const matchedPersonId = transaction.matchedPerson?.id ?? "";
    setBuildingId(matchedBuildingId);
    setApartmentId(matchedApartmentId);
    setPersonId(matchedPersonId);
    setCreateRule(false);
    setContainsText(transaction.description.slice(0, 80));
    setErrors({});
    setLocalError("");
    if (matchedBuildingId) onBuildingChange(matchedBuildingId);
    if (matchedApartmentId) onApartmentChange(matchedApartmentId);
  }, [open, transaction]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !transaction) return;
    const amount = Number(transaction.amount);
    setAllocations(autoDistribute(Number.isFinite(amount) ? amount : 0, openDebts));
  }, [open, transaction, openDebts]);

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

  function handleAutoDistribute() {
    if (!transaction) return;
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setAllocations(autoDistribute(amount, openDebts));
    setLocalError("");
  }

  function buildMatchPayload(): BankMatchPayload | null {
    if (!apartmentId) {
      setErrors({ apartmentId: "Daire seçimi zorunludur." });
      return null;
    }
    if (createRule && !containsText.trim()) {
      setErrors({ containsText: "Kural için eşleşme ifadesi zorunludur." });
      return null;
    }
    setErrors({});
    return {
      apartmentId,
      ...(personId ? { personId } : {}),
      createRule,
      ...(createRule && containsText.trim()
        ? { containsText: containsText.trim(), ruleName: `Kural: ${containsText.trim()}` }
        : {}),
    };
  }

  function buildAllocations(): Array<{ apartmentDebtId: string; amount: number }> | null {
    if (!transaction) return null;
    const txAmount = Number(transaction.amount);
    const items = openDebts
      .map((debt) => ({
        apartmentDebtId: debt.id,
        amount: Number((allocations[debt.id] ?? "0").replace(",", ".")),
      }))
      .filter((item) => item.amount > 0);

    if (items.length === 0) {
      setLocalError("En az bir borç dağılımı gerekli.");
      return null;
    }

    const sum = items.reduce((total, item) => total + item.amount, 0);
    if (Math.abs(sum - txAmount) > 0.01) {
      setLocalError(
        `Dağıtım toplamı (${formatMoney(sum)}) hareket tutarına (${formatMoney(txAmount)}) eşit olmalıdır.`,
      );
      return null;
    }

    for (const item of items) {
      const debt = openDebts.find((row) => row.id === item.apartmentDebtId);
      if (debt && item.amount > Number(debt.remainingAmount) + 0.0001) {
        setLocalError("Dağıtım tutarı kalan borç tutarını aşamaz.");
        return null;
      }
    }

    setLocalError("");
    return items;
  }

  async function handleMatch() {
    if (pending) return;
    const payload = buildMatchPayload();
    if (!payload) return;
    await onMatch(payload);
  }

  async function handleProcess() {
    if (pending || !transaction) return;
    if (transaction.direction !== "CREDIT") {
      setLocalError("Yalnızca gelen (CREDIT) hareketler tahsilata dönüştürülebilir.");
      return;
    }
    const matchPayload = buildMatchPayload();
    if (!matchPayload) return;
    const alloc = buildAllocations();
    if (!alloc) return;
    await onProcess(matchPayload, {
      ...(personId ? { personId } : {}),
      allocations: alloc,
    });
  }

  if (!transaction) return null;

  const canProcess = transaction.direction === "CREDIT";

  return (
    <FormModal
      open={open}
      title="Banka Hareketini Eşleştir"
      description="Hareketi daire ve borçlarla eşleştirin."
      icon={Link2}
      size="lg"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button variant="secondary" onClick={() => void handleMatch()} disabled={pending}>
            {pending ? "İşleniyor..." : "Eşleştir"}
          </Button>
          <Button onClick={() => void handleProcess()} disabled={pending || !canProcess}>
            {pending ? (
              "İşleniyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Tahsilata Dönüştür
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-[10px] border border-line bg-canvas/50 px-3 py-2 text-sm">
          <p className="font-medium text-ink">{formatMoney(transaction.amount)}</p>
          <p className="text-muted">{transaction.description}</p>
          <p className="text-muted">
            {formatDateTr(transaction.transactionDate)} ·{" "}
            {BANK_DIRECTION_LABELS[transaction.direction]}
          </p>
        </div>

        <FormSection title="Eşleştirme">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <SiteContextField
              className="md:col-span-2"
              value={siteLabel || "—"}
              hint="Eşleştirme yalnızca bu hesabın sitesindeki bina ve dairelerle yapılabilir."
            />
            <FormField label="Bina" htmlFor="bm-building" required>
              <Select
                id="bm-building"
                data-modal-autofocus
                value={buildingId}
                onChange={(event) => {
                  const next = event.target.value;
                  setBuildingId(next);
                  setApartmentId("");
                  setPersonId("");
                  onBuildingChange(next);
                }}
              >
                <option value="">Bina seçin</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Daire"
              htmlFor="bm-apartment"
              required
              error={errors.apartmentId}
            >
              <ApartmentCombobox
                id="bm-apartment"
                apartments={apartments}
                value={apartmentId}
                disabled={!buildingId}
                invalid={Boolean(errors.apartmentId)}
                onChange={(next) => {
                  setApartmentId(next);
                  setPersonId("");
                  onApartmentChange(next);
                }}
              />
            </FormField>
            <FormField label="Kişi" htmlFor="bm-person" className="md:col-span-2">
              <Select
                id="bm-person"
                value={personId}
                disabled={!apartmentId}
                onChange={(event) => setPersonId(event.target.value)}
              >
                <option value="">Seçilmedi</option>
                {personOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </FormSection>

        {canProcess ? (
          <FormSection title="Borç dağılımı">
            <div className="mb-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAutoDistribute}
                disabled={openDebts.length === 0}
              >
                Otomatik Dağıt
              </Button>
            </div>
            {openDebts.length === 0 ? (
              <p className="text-sm text-muted">Seçilen dairede açık borç bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-line">
                <table className="min-w-full text-sm">
                  <thead className="bg-canvas/70 text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Borç</th>
                      <th className="px-3 py-2 font-medium">Vade</th>
                      <th className="px-3 py-2 text-right font-medium">Kalan</th>
                      <th className="px-3 py-2 text-right font-medium">Bu ödemeden</th>
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
                            value={allocations[debt.id] ?? "0"}
                            onChange={(event) =>
                              setAllocations((current) => ({
                                ...current,
                                [debt.id]: event.target.value,
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
          </FormSection>
        ) : null}

        <FormSection title="Kural">
          <label className="mb-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-line"
              checked={createRule}
              onChange={(event) => setCreateRule(event.target.checked)}
            />
            Bu eşleşme için kural oluştur
          </label>
          {createRule ? (
            <FormField
              label="İçeren metin"
              htmlFor="bm-contains"
              required
              error={errors.containsText}
            >
              <Input
                id="bm-contains"
                value={containsText}
                invalid={Boolean(errors.containsText)}
                onChange={(event) => setContainsText(event.target.value)}
              />
            </FormField>
          ) : null}
        </FormSection>

        {localError || error ? (
          <p className="text-[13px] text-danger">{localError || error}</p>
        ) : null}
        {!canProcess ? (
          <p className="text-[13px] text-muted">
            Giden hareketler tahsilata dönüştürülemez; yalnızca eşleştirilebilir.
          </p>
        ) : null}
      </div>
    </FormModal>
  );
}

