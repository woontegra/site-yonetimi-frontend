import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 max-w-full rounded-lg border border-line bg-surface shadow-panel", className)}>
      <div className="overflow-x-auto overscroll-x-contain">{children}</div>
    </div>
  );
}

export function TableElement({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("min-w-full border-collapse text-left text-sm", className)}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-canvas/90 text-caption font-medium uppercase tracking-[0.04em] text-muted">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="bg-surface text-ink">{children}</tbody>;
}

export function TR({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-line/70 last:border-b-0 transition-colors duration-micro hover:bg-canvas/80",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("whitespace-nowrap px-3 py-3 font-medium sm:px-4", className)} {...props}>
      {children}
    </th>
  );
}

export function TD({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-3.5 text-sm font-normal sm:px-4", className)} {...props}>
      {children}
    </td>
  );
}

export function TableFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-line px-4 py-3", className)}>{children}</div>
  );
}
