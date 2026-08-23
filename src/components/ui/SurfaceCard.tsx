import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
};

const paddingClass = {
  none: "",
  sm: "px-5 py-4",
  md: "p-5 sm:p-6",
};

export function SurfaceCard({ children, className, padding = "md" }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-panel",
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <SurfaceCard padding="none" className={cn("flex h-full flex-col", className)}>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="break-words text-section text-ink">{title}</h2>
          {description ? <p className="mt-1 break-words text-sm text-muted">{description}</p> : null}
        </div>
        {action ? <div className="action-stack shrink-0 sm:max-w-[min(100%,28rem)]">{action}</div> : null}
      </div>
      <div className={cn("flex-1 px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
    </SurfaceCard>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({ label, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <SurfaceCard padding="sm" className={cn("min-w-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-muted">{label}</p>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-2 break-words text-[1.25rem] font-medium leading-tight tracking-tight text-ink sm:text-[1.375rem] sm:leading-none">
        {value}
      </p>
      {hint ? <p className="mt-1.5 break-words text-caption text-muted">{hint}</p> : null}
    </SurfaceCard>
  );
}
