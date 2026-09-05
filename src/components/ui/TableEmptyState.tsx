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
    <div className={cn("flex flex-col items-center justify-center px-4 py-8 text-center", className)}>
      <Inbox className="mb-2 size-6 text-slate-300" aria-hidden />
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-0.5 max-w-md text-[12px] font-normal leading-[1.35] text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}
