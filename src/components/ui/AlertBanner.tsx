"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { cardTone, type CardTone } from "@/lib/card-tones";

export type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_MAP: Record<
  AlertTone,
  { card: CardTone; icon: typeof Info; titleDefault: string }
> = {
  info: { card: "blue", icon: Info, titleDefault: "Bilgi" },
  success: { card: "green", icon: CheckCircle2, titleDefault: "Başarılı" },
  warning: { card: "amber", icon: AlertTriangle, titleDefault: "Dikkat" },
  danger: { card: "rose", icon: XCircle, titleDefault: "Uyarı" },
};

type AlertBannerProps = {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

/**
 * Persistent in-page alert — not a toast.
 * Use for decisions and rules the user must see before continuing.
 */
export function AlertBanner({
  tone = "info",
  title,
  children,
  className,
  action,
}: AlertBannerProps) {
  const config = ALERT_MAP[tone];
  const tones = cardTone(config.card);
  const Icon = config.icon;

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-3.5 py-3",
        tones.metric,
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
          tones.icon,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title ?? config.titleDefault}</p>
        <div className="mt-0.5 text-sm text-muted">{children}</div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
