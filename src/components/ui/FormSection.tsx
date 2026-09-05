import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FormSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex items-center gap-3">
        <h3 className="min-w-0 break-words text-[12px] font-medium tracking-normal text-ink">
          {title}
        </h3>
        <span className="h-px flex-1 bg-line/80" aria-hidden />
      </div>
      {children}
    </section>
  );
}
