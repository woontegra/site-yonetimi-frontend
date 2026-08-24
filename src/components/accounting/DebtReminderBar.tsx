"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isSmsFeatureEnabled } from "@/lib/messaging-channels";

type DebtReminderBarProps = {
  indebtedApartmentCount: number;
  onSendClick: () => void;
  onHistoryClick?: () => void;
};

export function DebtReminderBar({
  indebtedApartmentCount,
  onSendClick,
  onHistoryClick,
}: DebtReminderBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-white px-4 py-3 shadow-panel md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <MessageCircle className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Borç Hatırlatma Merkezi</p>
          <p className="mt-0.5 text-[13px] text-muted">
            Borcu olan dairelere tek tıkla toplu mesaj gönderin.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-ink">{indebtedApartmentCount} borçlu daire</p>
          <p className="text-[12px] text-muted">
            {isSmsFeatureEnabled() ? "WhatsApp / SMS gönderimi" : "WhatsApp gönderimi"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onHistoryClick ? (
            <Button variant="ghost" size="sm" onClick={onHistoryClick}>
              Geçmiş
            </Button>
          ) : null}
          <Button onClick={onSendClick}>Tek Tıkla Toplu Mesaj Gönder</Button>
        </div>
      </div>
    </div>
  );
}
