"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { cardTone, type CardTone } from "@/lib/card-tones";
import { SurfaceCard } from "@/components/ui/SurfaceCard";

type AccountingSummaryCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
  icon: LucideIcon;
  iconClassName?: string;
  tone?: CardTone;
};

export function AccountingSummaryCard({
  label,
  value,
  valueClassName,
  icon: Icon,
  iconClassName,
  tone = "teal",
}: AccountingSummaryCardProps) {
  const tones = cardTone(tone);
  return (
    <SurfaceCard padding="sm" tone={tone} className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-caption font-medium text-muted">{label}</p>
        <p
          className={cn(
            "mt-1.5 break-words text-[1.25rem] font-semibold leading-tight tracking-tight sm:text-[1.375rem] sm:leading-none",
            valueClassName,
          )}
        >
          {value}
        </p>
      </div>
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          iconClassName ?? tones.icon,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
    </SurfaceCard>
  );
}
