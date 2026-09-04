"use client";

import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ChargePreview } from "@/lib/dues-api";
import { formatDateTr, formatMoney, formatPeriodLong } from "@/lib/money";

type DuesChargeModalProps = {
  preview: ChargePreview | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DuesChargeModal({ preview, pending, onClose, onConfirm }: DuesChargeModalProps) {
  const canCharge = Boolean(preview && preview.pendingChargeCount > 0);

  return (
    <Modal
      open={Boolean(preview)}
      title="Aidat Borçlandırması Oluştur"
      description="Onayladığınızda seçilen kapsamdaki aktif dairelere ayrı ayrı aidat borcu oluşturulur."
      variant="confirm"
      size="md"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={onConfirm} disabled={pending || !canCharge}>
            {pending
              ? "Borçlandırılıyor..."
              : `${preview?.pendingChargeCount ?? 0} Daireyi Borçlandır`}
          </Button>
        </>
      }
    >
      {preview ? (
        <div className="space-y-4">
          <dl className="space-y-2.5 rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
            <SummaryRow label="Aidat" value={preview.dues.name} />
            <SummaryRow
              label="Dönem"
              value={formatPeriodLong(preview.dues.periodYear, preview.dues.periodMonth)}
            />
            <SummaryRow label="Kapsam" value={preview.dues.building.name} />
            <SummaryRow label="Daire başına tutar" value={formatMoney(preview.dues.amount)} />
            <SummaryRow label="Son ödeme tarihi" value={formatDateTr(preview.dues.dueDate)} />
            <SummaryRow label="Toplam daire" value={String(preview.activeApartmentCount)} />
            <SummaryRow
              label="Normal borçlandırılacak"
              value={String(preview.normalChargeCount ?? preview.pendingChargeCount)}
            />
            <SummaryRow label="Muaf" value={String(preview.exemptCount ?? 0)} />
            <SummaryRow label="İndirimli" value={String(preview.discountedCount ?? 0)} />
            <SummaryRow
              label="Oluşacak toplam tahakkuk"
              value={formatMoney(preview.totalChargeAmount)}
              strong
            />
          </dl>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <CountBox label="Oluşturulacak" value={preview.pendingChargeCount} tone="accent" />
            <CountBox label="Zaten mevcut" value={preview.alreadyChargedCount} />
            <CountBox label="Aktif daire" value={preview.activeApartmentCount} />
          </div>

          {(preview.exemptCount ?? 0) > 0 ? (
            <AlertBanner tone="warning" title="Muafiyet">
              {preview.exemptCount} daire yönetici muafiyeti nedeniyle bu dönem borçlandırılmayacaktır.
            </AlertBanner>
          ) : null}

          {(preview.exemptApartments?.length ?? 0) > 0 ? (
            <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
              <p className="font-medium text-ink">Muaf daireler</p>
              <ul className="mt-2 space-y-2">
                {preview.exemptApartments!.map((item) => (
                  <li key={item.apartmentId} className="text-muted">
                    <span className="font-medium text-ink">{item.label}</span>
                    <span className="block text-xs">
                      {item.reasonLabel}
                      {" · "}
                      {formatDateTr(item.startDate)}
                      {"–"}
                      {item.endDate ? formatDateTr(item.endDate) : "Süresiz"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.pendingChargeCount > 0 ? (
            <p className="rounded-md border border-accent/30 bg-accent-subtle px-3 py-2 text-sm text-ink">
              Onayladığınızda {preview.pendingChargeCount} daire için ayrı ayrı aidat borcu
              oluşturulacaktır. Muaf daireler için borç oluşturulmaz.
            </p>
          ) : preview.alreadyChargedCount > 0 ? (
            <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-ink">
              Bu aidat tanımı için borçlandırılacak yeni aktif daire kalmadı. Mevcut borçlar
              korunur; aynı daireye ikinci borç oluşturulmaz.
            </p>
          ) : (
            <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-ink">
              Bu binada borçlandırılabilecek aktif daire bulunmuyor.
            </p>
          )}
        </div>
      ) : null}
    </Modal>
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

function CountBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "accent";
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-2 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={tone === "accent" ? "mt-0.5 text-base font-semibold text-accent" : "mt-0.5 text-base font-semibold text-ink"}>
        {value}
      </p>
    </div>
  );
}
