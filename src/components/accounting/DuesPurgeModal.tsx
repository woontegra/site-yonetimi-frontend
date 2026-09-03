"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { DuesDefinition, DuesPurgePreview } from "@/lib/dues-api";
import { formatMoney, formatPeriod } from "@/lib/money";

type DuesPurgeModalProps = {
  open: boolean;
  dues: DuesDefinition | null;
  preview: DuesPurgePreview | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (confirmName: string) => void;
};

export function DuesPurgeModal({
  open,
  dues,
  preview,
  pending,
  onClose,
  onConfirm,
}: DuesPurgeModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const debtCount = preview?.deletableDebtCount ?? dues?.chargedApartmentCount ?? 0;
  const nameMatches = Boolean(dues && confirmName.trim() === dues.name);

  useEffect(() => {
    if (open) setConfirmName("");
  }, [open, dues?.id]);

  return (
    <Modal
      open={open}
      title="Aidat borçlandırmasını sil"
      description={`Bu işlem aidat tanımını ve bu tanımdan oluşturulan ${debtCount} ödenmemiş daire borcunu kalıcı olarak silecektir. Bu işlem geri alınamaz.`}
      variant="confirm"
      size="md"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            disabled={pending || !nameMatches}
            onClick={() => onConfirm(confirmName.trim())}
          >
            {pending ? "Siliniyor…" : `Aidatı ve ${debtCount} Borcu Sil`}
          </Button>
        </>
      }
    >
      {dues ? (
        <div className="space-y-4">
          <dl className="space-y-2 rounded-lg border border-line bg-canvas px-3 py-3 text-sm">
            <Row label="Aidat" value={dues.name} />
            <Row label="Dönem" value={formatPeriod(dues.periodYear, dues.periodMonth)} />
            <Row label="Kapsam" value={dues.building.name} />
            <Row label="Borçlandırılan daire" value={String(debtCount)} />
            <Row
              label="Toplam tahakkuk"
              value={formatMoney(preview?.totalOriginalAmount ?? dues.totalOriginalAmount ?? "0")}
            />
            <Row
              label="Tahsil edilen"
              value={formatMoney(preview?.collectedAmount ?? dues.collectedAmount ?? "0")}
            />
            <Row label="Silinecek borç" value={String(debtCount)} />
          </dl>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="purge-confirm-name">
              Onay için aidat adını yazın
            </label>
            <Input
              id="purge-confirm-name"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={dues.name}
              disabled={pending}
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
