"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ASSET_STATUS_LABELS, type AssetStatus } from "@/lib/assets-api";

type AssetStatusModalProps = {
  open: boolean;
  currentStatus: AssetStatus;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (payload: { status: AssetStatus; note?: string }) => Promise<void>;
};

export function AssetStatusModal({
  open,
  currentStatus,
  pending,
  error,
  onClose,
  onSubmit,
}: AssetStatusModalProps) {
  const [status, setStatus] = useState<AssetStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus(currentStatus);
    setNote("");
    setFieldError("");
  }, [open, currentStatus]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!status) {
      setFieldError("Durum seçimi zorunludur.");
      return;
    }
    if (status === currentStatus) {
      setFieldError("Yeni durum mevcut durumdan farklı olmalıdır.");
      return;
    }
    await onSubmit({
      status,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <FormModal
      open={open}
      title="Durumu Değiştir"
      description="Demirbaş durumunu güncelleyin."
      size="sm"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="asset-status-form" disabled={pending}>
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
      <form id="asset-status-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <FormField label="Yeni Durum" htmlFor="asset-status-select" required error={fieldError}>
          <Select
            id="asset-status-select"
            data-modal-autofocus
            value={status}
            invalid={Boolean(fieldError)}
            onChange={(event) => {
              setStatus(event.target.value as AssetStatus);
              setFieldError("");
            }}
          >
            {(Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((item) => (
              <option key={item} value={item}>
                {ASSET_STATUS_LABELS[item]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Not" htmlFor="asset-status-note">
          <Textarea
            id="asset-status-note"
            rows={3}
            className="min-h-[76px]"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
