import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type DetailHeaderProps = {
  backHref: string;
  backLabel: string;
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
};

export function DetailHeader({
  backHref,
  backLabel,
  title,
  description,
  status,
  actions,
  leading,
}: DetailHeaderProps) {
  return (
    <div className="mb-5">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-page text-ink">{title}</h1>
              {status}
            </div>
            {description ? (
              <div className="mt-1 min-w-0 break-words text-sm text-muted">{description}</div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="action-stack">{actions}</div> : null}
      </div>
    </div>
  );
}

type DetailTabsProps<T extends string> = {
  tabs: ReadonlyArray<{ id: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

export function DetailTabs<T extends string>({ tabs, value, onChange, className }: DetailTabsProps<T>) {
  return (
    <div className={cn("mb-4 -mx-1 flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain border-b border-line px-1", className)}>
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors duration-micro",
            value === item.id
              ? "border-accent bg-accent-subtle font-medium text-accent"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.icon ? <item.icon className="size-3.5 shrink-0" aria-hidden /> : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}
