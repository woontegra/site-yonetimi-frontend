import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { cardTone, type CardTone } from "@/lib/card-tones";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  tone?: CardTone;
  compact?: boolean;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  tone = "neutral",
  compact = false,
}: EmptyStateProps) {
  const tones = cardTone(tone);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg text-center",
        tones.empty,
        compact ? "px-3 py-4" : "px-4 py-7",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mb-2.5 flex size-9 items-center justify-center rounded-md",
            tones.icon,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}
      <p className="break-words text-[13px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-0.5 max-w-md break-words px-1 text-[12px] font-normal leading-[1.35] text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="action-stack mt-3 justify-center">{action}</div> : null}
    </div>
  );
}
