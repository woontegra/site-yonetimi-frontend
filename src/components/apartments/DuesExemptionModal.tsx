"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Apartment } from "@/lib/apartments-api";
import {
  EXEMPTION_REASON_LABELS,
  EXEMPTION_TYPE_LABELS,
  createApartmentDuesExemption,
  updateApartmentDuesExemption,
  type CreateExemptionPayload,
} from "@/lib/apartment-dues-exemptions-api";
import { ApiError } from "@/lib/http";
import { toDateInputValue } from "@/lib/money";

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

type DuesExemptionModalProps = {
  open: boolean;
  mode: "create" | "edit";
  apartment: Apartment | null;
  siteName?: string;
  auth: AuthContext | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  exemptionType: CreateExemptionPayload["exemptionType"];
  value: string;
  startDate: string;
  endDate: string;
  indefinite: boolean;
  reason: CreateExemptionPayload["reason"];
  note: string;
};

function emptyForm(): FormState {
  const today = toDateInputValue(new Date().toISOString());
  return {
    exemptionType: "FULL",
    value: "",
    startDate: today,
    endDate: "",
    indefinite: false,
    reason: "MANAGER",
    note: "",
  };
}

export function DuesExemptionModal({
  open,
  mode,
  apartment,
  siteName,
  auth,
  onClose,
  onSaved,
}: DuesExemptionModalProps) {
  const [values, setValues] = useState<FormState>(emptyForm());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !apartment) return;
    const exemption = apartment.duesStatus?.exemption;
    if (mode === "edit" && exemption) {
      setValues({
        exemptionType: exemption.exemptionType,
        value: exemption.value ?? "",
        startDate: toDateInputValue(exemption.startDate),
        endDate: exemption.endDate ? toDateInputValue(exemption.endDate) : "",
        indefinite: !exemption.endDate,
        reason: exemption.reason,
        note: exemption.note ?? "",
      });
    } else {
      setValues(emptyForm());
    }
    setError("");
  }, [open, mode, apartment]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth || !apartment || pending) return;
    setPending(true);
    setError("");
    try {
      const payload: CreateExemptionPayload = {
        exemptionType: values.exemptionType,
        startDate: values.startDate,
        indefinite: values.indefinite,
        endDate: values.indefinite ? null : values.endDate || null,
        reason: values.reason,
        note: values.note.trim() || null,
        ...(values.exemptionType === "FULL"
          ? { value: null }
          : { value: Number(String(values.value).replace(",", ".")) }),
      };
      if (mode === "edit" && apartment.duesStatus?.exemption?.id) {
        await updateApartmentDuesExemption(auth, apartment.duesStatus.exemption.id, payload);
      } else {
        await createApartmentDuesExemption(auth, apartment.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Muafiyet kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Aidat Muafiyetini Düzenle" : "Aidat Muafiyeti Tanımla"}
      description="Muafiyet yalnızca seçilen tarihler arasındaki yeni aidat borçlandırmalarında uygulanır."
      size="md"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={() => void handleSubmit({ preventDefault() {} } as FormEvent)} disabled={pending}>
            {pending ? "Kaydediliyor..." : "Muafiyeti Kaydet"}
          </Button>
        </>
      }
    >
      {apartment ? (
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-canvas px-3 py-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Site</dt>
              <dd className="font-medium">{siteName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Bina</dt>
              <dd className="font-medium">{apartment.building.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Daire</dt>
              <dd className="font-medium">{apartment.number}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Malik</dt>
              <dd className="font-medium">{apartment.ownerLabel ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Oturan</dt>
              <dd className="font-medium">{apartment.residentLabel ?? "—"}</dd>
            </div>
          </dl>

          <FormField label="Muafiyet türü" htmlFor="ex-type" required>
            <Select
              id="ex-type"
              value={values.exemptionType}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  exemptionType: event.target.value as FormState["exemptionType"],
                }))
              }
            >
              {Object.entries(EXEMPTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>

          {values.exemptionType !== "FULL" ? (
            <FormField
              label={values.exemptionType === "PERCENT" ? "İndirim yüzdesi" : "İndirim tutarı (TL)"}
              htmlFor="ex-value"
              required
            >
              <Input
                id="ex-value"
                value={values.value}
                onChange={(event) => setValues((prev) => ({ ...prev, value: event.target.value }))}
                placeholder={values.exemptionType === "PERCENT" ? "Örn. 50" : "Örn. 500"}
              />
            </FormField>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Başlangıç tarihi" htmlFor="ex-start" required>
              <Input
                id="ex-start"
                type="date"
                value={values.startDate}
                onChange={(event) => setValues((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </FormField>
            <FormField label="Bitiş tarihi" htmlFor="ex-end">
              <Input
                id="ex-end"
                type="date"
                disabled={values.indefinite}
                value={values.endDate}
                onChange={(event) => setValues((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={values.indefinite}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  indefinite: event.target.checked,
                  endDate: event.target.checked ? "" : prev.endDate,
                }))
              }
            />
            Süresiz
          </label>

          <FormField label="Muafiyet nedeni" htmlFor="ex-reason" required>
            <Select
              id="ex-reason"
              value={values.reason}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  reason: event.target.value as FormState["reason"],
                }))
              }
            >
              {Object.entries(EXEMPTION_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Açıklama / not" htmlFor="ex-note">
            <Textarea
              id="ex-note"
              rows={3}
              value={values.note}
              onChange={(event) => setValues((prev) => ({ ...prev, note: event.target.value }))}
            />
          </FormField>

          <div className="space-y-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-ink">
            <p>Muafiyet, seçilen tarihler arasındaki yeni aidat borçlandırmalarında uygulanır.</p>
            <p>Bu işlem daha önce oluşturulmuş borçları değiştirmez.</p>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>
      ) : null}
    </Modal>
  );
}
