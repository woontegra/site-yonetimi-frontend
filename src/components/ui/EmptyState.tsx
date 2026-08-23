import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-canvas/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-surface text-muted shadow-panel">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="break-words text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md break-words px-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="action-stack mt-4 justify-center">{action}</div> : null}
    </div>
  );
}
