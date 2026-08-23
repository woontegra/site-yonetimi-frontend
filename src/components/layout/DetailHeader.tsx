import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type DetailHeaderProps = {
  backHref: string;
  backLabel: string;
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
};

export function DetailHeader({
  backHref,
  backLabel,
  title,
  description,
  status,
  actions,
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
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-page text-ink">{title}</h1>
            {status}
          </div>
          {description ? <div className="mt-1 min-w-0 break-words text-sm text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="action-stack">{actions}</div> : null}
      </div>
    </div>
  );
}

type DetailTabsProps<T extends string> = {
  tabs: ReadonlyArray<{ id: T; label: string }>;
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
            "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors duration-micro",
            value === item.id
              ? "border-accent font-medium text-accent"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
