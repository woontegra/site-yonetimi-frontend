"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MONTH_LABELS, formatMoney } from "@/lib/money";

type AccountingChartPanelProps = {
  title: string;
  subtitle: string;
  tone: "income" | "expense";
  icon: LucideIcon;
  action?: ReactNode;
  emptyLabel?: string;
  children?: ReactNode;
};

export function AccountingChartPanel({
  title,
  subtitle,
  tone,
  icon: Icon,
  action,
  emptyLabel = "Grafik verisi henüz bulunmuyor.",
  children,
}: AccountingChartPanelProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              tone === "income" ? "bg-emerald-100 text-success" : "bg-rose-100 text-danger",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{title}</p>
            <p className="text-[12px] text-muted">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="flex h-[160px] items-center justify-center px-4">
        {children ?? <p className="text-sm text-muted">{emptyLabel}</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
        <span
          className={cn("size-2 rounded-full", tone === "income" ? "bg-success" : "bg-danger")}
        />
        <span className="text-[12px] text-muted">{tone === "income" ? "Gelir" : "Gider"}</span>
      </div>
    </div>
  );
}

type MonthlyBarChartProps = {
  months: Array<{ month: number; total: string }>;
  tone?: "income" | "expense";
};

export function MonthlyBarChart({ months, tone = "income" }: MonthlyBarChartProps) {
  const values = months.map((item) => Number(item.total));
  const max = Math.max(...values, 0);
  const hasData = values.some((value) => value > 0);

  if (!hasData) {
    return <p className="text-sm text-muted">Grafik verisi henüz bulunmuyor.</p>;
  }

  return (
    <div className="flex h-full w-full items-end gap-1.5 pb-1 pt-4">
      {months.map((item) => {
        const value = Number(item.total);
        const height = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 2) : 2;
        return (
          <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                "w-full rounded-t",
                tone === "income" ? "bg-success/80" : "bg-danger/80",
              )}
              style={{ height: `${height}%` }}
              title={`${MONTH_LABELS[item.month - 1]}: ${formatMoney(item.total)}`}
            />
            <span className="text-[10px] text-muted">
              {MONTH_LABELS[item.month - 1].slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
