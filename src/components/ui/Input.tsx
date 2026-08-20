import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-[10px] border bg-white px-3 text-sm text-ink placeholder:text-muted",
        "transition-colors duration-micro",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/15"
          : "border-line hover:border-slate-300 focus:border-brand focus:ring-brand/20",
        "focus:outline-none focus-visible:outline-none focus:ring-2",
        "disabled:cursor-not-allowed disabled:bg-canvas",
        className,
      )}
      {...props}
    />
  );
}
