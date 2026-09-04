import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { cardTone, type CardTone } from "@/lib/card-tones";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
  tone?: CardTone;
  /** Soft lift on hover — only for interactive cards */
  interactive?: boolean;
};

const paddingClass = {
  none: "",
  sm: "px-5 py-4",
  md: "p-5 sm:p-6",
};

export function SurfaceCard({
  children,
  className,
  padding = "md",
  tone = "neutral",
  interactive = false,
}: SurfaceCardProps) {
  const tones = cardTone(tone);
  return (
    <div
      className={cn(
        "rounded-lg transition-[box-shadow,transform,border-color] duration-micro",
        tones.surface,
        paddingClass[padding],
        interactive &&
          "hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel-hover)]",
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
  tone?: CardTone;
  icon?: LucideIcon;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  tone = "neutral",
  icon: Icon,
}: SectionCardProps) {
  const tones = cardTone(tone);
  return (
    <SurfaceCard padding="none" tone={tone} className={cn("flex h-full flex-col", className)}>
      <div
        className={cn(
          "flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6",
          tones.header,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              className={cn(
                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-11",
                tones.icon,
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="break-words text-section text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 break-words text-sm text-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? (
          <div className={cn("action-stack shrink-0 sm:max-w-[min(100%,28rem)]", tones.link)}>
            {action}
          </div>
        ) : null}
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
  tone?: CardTone;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  tone = "neutral",
  onClick,
}: StatCardProps) {
  const tones = cardTone(tone);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium text-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11",
              tones.icon,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-3 break-words text-[1.35rem] font-semibold leading-tight tracking-tight text-ink sm:text-[1.5rem] sm:leading-none">
        {value}
      </p>
      {hint ? <p className="mt-1.5 break-words text-caption text-muted">{hint}</p> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "min-w-0 rounded-xl border text-left transition-colors",
          tones.surface,
          tones.hover,
          "px-4 py-3",
          className,
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <SurfaceCard padding="sm" tone={tone} className={cn("min-w-0", className)}>
      {body}
    </SurfaceCard>
  );
}

type MetricTileProps = {
  label: string;
  value: string;
  tone?: CardTone;
  className?: string;
};

/** Compact colored metric block inside a parent section card. */
export function MetricTile({ label, value, tone = "neutral", className }: MetricTileProps) {
  const tones = cardTone(tone);
  return (
    <div className={cn("min-w-0 rounded-lg px-3 py-2.5", tones.metric, className)}>
      <p className="text-caption font-medium text-muted">{label}</p>
      <p className="mt-1 min-w-0 break-words text-sm font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}
