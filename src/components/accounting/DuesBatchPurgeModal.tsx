"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { AssessmentBatchResponse } from "@/lib/dues-api";
import { formatMoney, formatPeriod } from "@/lib/money";

type DuesBatchPurgeModalProps = {
  open: boolean;
  batch: AssessmentBatchResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (confirmName: string) => void;
};

export function DuesBatchPurgeModal({
  open,
  batch,
  pending,
  onClose,
  onConfirm,
}: DuesBatchPurgeModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const expected = batch ? `TOPLU-${batch.periodCount}` : "";
  const debtCount =
    batch?.items.reduce((sum, item) => sum + (item.chargedApartmentCount ?? 0), 0) ?? 0;
  const totalOriginal =
    batch?.items.reduce((sum, item) => sum + Number(item.totalOriginalAmount ?? 0), 0) ?? 0;
  const nameMatches = Boolean(batch && confirmName.trim() === expected);

  useEffect(() => {
    if (open) setConfirmName("");
  }, [open, batch?.assessmentBatchId]);

  return (
    <Modal
      open={open}
      title="Toplu borçlandırmayı sil"
      description={`Bu işlem gruptaki ${batch?.periodCount ?? 0} aidat dönemini ve ${debtCount} ödenmemiş daire borcunu kalıcı olarak silecektir.`}
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
            disabled={pending || !nameMatches || !batch?.canHardDelete}
            onClick={() => onConfirm(confirmName.trim())}
          >
            {pending
              ? "Siliniyor…"
              : `Toplu Borçlandırmayı Sil (${batch?.periodCount ?? 0} dönem)`}
          </Button>
        </>
      }
    >
      {batch ? (
        <div className="space-y-4">
          {!batch.canHardDelete ? (
            <p className="text-sm text-danger">
              {batch.blockedReason ??
                "Gruptaki en az bir döneme tahsilat uygulanmış; toplu silme yapılamaz."}
            </p>
          ) : null}
          <dl className="space-y-2 rounded-lg border border-line bg-canvas px-3 py-3 text-sm">
            <Row label="Dönem sayısı" value={String(batch.periodCount)} />
            <Row label="Borç sayısı" value={String(debtCount)} />
            <Row label="Toplam tahakkuk" value={formatMoney(totalOriginal)} />
          </dl>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line px-3 py-2 text-sm">
            {batch.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>{item.name}</span>
                <span className="text-muted">{formatPeriod(item.periodYear, item.periodMonth)}</span>
              </li>
            ))}
          </ul>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="batch-purge-confirm">
              Onay için {expected} yazın
            </label>
            <Input
              id="batch-purge-confirm"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={expected}
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
