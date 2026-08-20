import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

type TableEmptyStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function TableEmptyState({
  title = "Henüz kayıt bulunmuyor.",
  description,
  className,
}: TableEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <Inbox className="mb-3 size-8 text-slate-300" aria-hidden />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}
