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
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="break-words text-[12px] font-medium leading-[1.25] text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-[11px] font-medium text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-[11px] leading-[1.35] text-danger">
          <CircleAlert className="mt-px size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="break-words text-[11px] leading-[1.35] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
