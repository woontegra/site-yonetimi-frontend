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
        "box-border h-10 w-full min-w-0 max-w-full rounded-md border bg-surface px-3 text-sm font-normal text-ink",
        "ring-2 ring-transparent transition-[border-color,box-shadow,background-color] duration-micro",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/15"
          : "border-line hover:border-slate-300 focus:border-accent focus:ring-accent/20",
        "focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-canvas",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
