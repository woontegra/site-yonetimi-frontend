import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-[11px] font-semibold text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      <div className="min-h-[18px]">
        {error ? (
          <p className="flex items-start gap-1 text-[12px] leading-[18px] text-danger">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : hint ? (
          <p className="text-[12px] leading-[18px] text-muted">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
