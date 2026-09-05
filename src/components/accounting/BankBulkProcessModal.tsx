"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  previewBankProcessBatch,
  processBankTransactionBatch,
  type BankApartmentGroupPreview,
  type BankProcessPreviewResponse,
} from "@/lib/banks-api";
import { formatMoney } from "@/lib/money";
import { normalizeApiError } from "@/lib/api-error";

type AuthCtx = { token: string; tenantId: string; siteId?: string | null };

type BankBulkProcessModalProps = {
  open: boolean;
  auth: AuthCtx | null;
  ids: string[];
  onClose: () => void;
  onDone: (summary: { processed: number; skipped: number; failed: number }) => void;
};

export function BankBulkProcessModal({
  open,
  auth,
  ids,
  onClose,
  onDone,
}: BankBulkProcessModalProps) {
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<BankProcessPreviewResponse | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !auth || ids.length === 0) {
      setPreview(null);
      setError("");
      setExpandedGroupId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void previewBankProcessBatch(auth, ids)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeApiError(err, "Önizleme alınamadı.").userMessage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth, ids]);

  const groups = preview?.apartmentGroups ?? [];

  const actionableIds = useMemo(() => {
    if (!preview) return [];
    return preview.items.filter((item) => item.eligible && item.bulkSafe).map((item) => item.id);
  }, [preview]);

  const overpaymentGroups = groups.filter((g) => g.status === "OVERPAYMENT");

  async function handleConfirm() {
    if (!auth || actionableIds.length === 0 || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await processBankTransactionBatch(auth, actionableIds, {
        includeRisky: true,
      });
      onDone(result.summary);
      onClose();
    } catch (err) {
      setError(normalizeApiError(err, "Toplu tahsilat başarısız.").userMessage);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Tahsilatları kaydet"
      description="Aynı daireye gelen ödemeler toplanır ve en eski açık borçlardan başlanarak dağıtılır."
      size="workspace"
      variant="confirm"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            disabled={pending || loading || actionableIds.length === 0}
            onClick={() => void handleConfirm()}
          >
            {pending ? "Kaydediliyor…" : "Tahsilatları Kaydet"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
        {loading ? <p className="text-sm text-muted">Dağıtım önizlemesi hazırlanıyor…</p> : null}

        {preview ? (
          <>
            {overpaymentGroups.length > 0 ? (
              <AlertBanner tone="warning" title="Dağıtılamayan bakiye">
                {overpaymentGroups.map((g) => (
                  <p key={g.apartmentId}>
                    Daire {g.apartment?.number ?? "?"}: {g.warning ?? "Fazla tutar açık borçları aşıyor."}
                  </p>
                ))}
              </AlertBanner>
            ) : null}

            <div className="max-h-[55vh] space-y-2 overflow-auto">
              {groups.length > 0
                ? groups.map((group) => (
                    <ApartmentFifoCard
                      key={group.apartmentId}
                      group={group}
                      expanded={expandedGroupId === group.apartmentId}
                      onToggleExpand={() =>
                        setExpandedGroupId((cur) =>
                          cur === group.apartmentId ? null : group.apartmentId,
                        )
                      }
                      included={group.transactionIds.some((id) => actionableIds.includes(id))}
                    />
                  ))
                : (
                  <p className="text-sm text-muted">Dağıtılabilir daire grubu yok.</p>
                )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function ApartmentFifoCard({
  group,
  expanded,
  onToggleExpand,
  included,
}: {
  group: BankApartmentGroupPreview;
  expanded: boolean;
  onToggleExpand: () => void;
  included: boolean;
}) {
  const aptLabel = group.apartment
    ? `${group.apartment.building.name} · Daire ${group.apartment.number}`
    : "Daire";
  const senders =
    (group.senderLabels && group.senderLabels.length > 0
      ? group.senderLabels.join(" + ")
      : null) ??
    group.ownerLabel ??
    "Gönderen";

  return (
    <div
      className={`rounded-xl border border-line px-3 py-2.5 ${included ? "" : "opacity-70"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold text-ink">{aptLabel}</p>
        <p className="text-[13px] font-medium text-ink">{formatMoney(group.totalIncoming)}</p>
      </div>
      <p className="text-sm text-muted">{senders}</p>
      <p className="text-xs text-muted">
        {group.transactionCount} banka hareketi
        {group.status === "READY" && group.debtsCovered
          ? ` · en eski ${group.debtsCovered} açık borç`
          : ""}
      </p>

      {group.summaryLine ? (
        <p className="mt-2 text-sm text-ink">{group.summaryLine}</p>
      ) : null}

      {group.unifiedAllocations.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-sm">
          {group.unifiedAllocations.map((a) => (
            <li key={a.apartmentDebtId} className="flex justify-between gap-2">
              <span>{a.title}</span>
              <span className="tabular-nums">{formatMoney(a.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {Number(group.remainderTotal) > 0 ? (
        <p className="mt-1 text-xs text-amber-800">
          Dağıtılamayan bakiye: {formatMoney(group.remainderTotal)}
        </p>
      ) : null}

      <button
        type="button"
        className="mt-2 text-xs text-muted underline-offset-2 hover:underline"
        onClick={onToggleExpand}
      >
        {expanded ? "Ödemeleri Gizle" : "Ödemeleri Gör"}
      </button>

      {expanded ? (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
          {group.transactionPlans.map((plan) => (
            <li key={plan.transactionId}>
              <span className="font-medium text-ink">
                {formatMoney(plan.allocatedTotal)}
                {Number(plan.remainder) > 0 ? ` (+${formatMoney(plan.remainder)} kalan)` : ""}
              </span>
              <ul className="ml-3 list-disc">
                {plan.allocations.map((a) => (
                  <li key={a.apartmentDebtId}>
                    {a.title}: {formatMoney(a.amount)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
