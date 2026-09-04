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
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mb-3 flex size-10 items-center justify-center rounded-lg",
            tones.icon,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="break-words text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md break-words px-1 text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="action-stack mt-4 justify-center">{action}</div> : null}
    </div>
  );
}
