import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FormSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3">
        <h3 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {title}
        </h3>
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>
      {children}
    </section>
  );
}
