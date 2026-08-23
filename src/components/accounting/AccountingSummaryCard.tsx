"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { SurfaceCard } from "@/components/ui/SurfaceCard";

type AccountingSummaryCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
  icon: LucideIcon;
  iconClassName?: string;
};

export function AccountingSummaryCard({
  label,
  value,
  valueClassName,
  icon: Icon,
  iconClassName,
}: AccountingSummaryCardProps) {
  return (
    <SurfaceCard padding="sm" className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-caption text-muted">{label}</p>
        <p className={cn("mt-1.5 break-words text-[1.25rem] font-medium leading-tight tracking-tight sm:text-[1.375rem] sm:leading-none", valueClassName)}>
          {value}
        </p>
      </div>
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          iconClassName ?? "bg-brand-soft text-brand",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
    </SurfaceCard>
  );
}
