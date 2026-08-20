import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ className, invalid = false, children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-[10px] border bg-white px-3 text-sm text-ink",
        "transition-colors duration-micro",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/15"
          : "border-line hover:border-slate-300 focus:border-brand focus:ring-brand/20",
        "focus:outline-none focus-visible:outline-none focus:ring-2",
        "disabled:cursor-not-allowed disabled:bg-canvas",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
