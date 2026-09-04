"use client";

import type { LucideIcon } from "lucide-react";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { cardTone, type CardTone } from "@/lib/card-tones";
import { cn } from "@/lib/cn";

const legacyToneMap = {
  success: "green",
  warning: "amber",
  danger: "rose",
  brand: "teal",
  neutral: "neutral",
} as const satisfies Record<string, CardTone>;

type FinanceMetricCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof legacyToneMap | CardTone;
};

export function FinanceMetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: FinanceMetricCardProps) {
  const resolved: CardTone =
    tone in legacyToneMap
      ? legacyToneMap[tone as keyof typeof legacyToneMap]
      : (tone as CardTone);
  const tones = cardTone(resolved);

  return (
    <SurfaceCard padding="sm" tone={resolved} className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium text-muted">{label}</p>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            tones.icon,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-right break-words text-[1.2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[1.3rem]">
        {value}
      </p>
    </SurfaceCard>
  );
}
