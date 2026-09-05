import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid = false, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "box-border min-h-[64px] w-full min-w-0 max-w-full resize-y rounded-md border bg-surface px-2.5 py-2 text-[13px] font-normal leading-[1.4] text-ink placeholder:text-muted/80",
        "ring-2 ring-transparent transition-[border-color,box-shadow,background-color] duration-micro",
        invalid
          ? "border-danger focus:border-danger focus:ring-danger/15"
          : "border-line hover:border-slate-300 focus:border-accent focus:ring-accent/20",
        "focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-canvas",
        className,
      )}
      {...props}
    />
  );
}
