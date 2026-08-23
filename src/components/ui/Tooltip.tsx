"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type TooltipProps = {
  label: string;
  side?: "right" | "bottom";
  children: ReactNode;
  className?: string;
};

export function Tooltip({ label, side = "right", children, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative flex w-full", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-white shadow-menu",
            side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
            side === "bottom" && "left-1/2 top-full mt-2 -translate-x-1/2",
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
