"use client";

import type { LucideIcon } from "lucide-react";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { cn } from "@/lib/cn";

const tones = {
  success: "bg-emerald-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-rose-50 text-danger",
  brand: "bg-brand-soft text-brand",
  neutral: "bg-canvas text-muted",
} as const;

type FinanceMetricCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
};

export function FinanceMetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: FinanceMetricCardProps) {
  return (
    <SurfaceCard padding="sm" className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-muted">{label}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            tones[tone],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-right break-words text-[1.2rem] font-medium leading-tight tracking-tight text-ink sm:text-[1.3rem]">
        {value}
      </p>
    </SurfaceCard>
  );
}
