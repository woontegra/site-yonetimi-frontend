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
    <table className={cn("min-w-full border-collapse text-left text-[13px]", className)}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-canvas/90 text-[11px] font-semibold tracking-normal text-muted">
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
    <th className={cn("whitespace-nowrap px-2.5 py-2 font-semibold sm:px-3", className)} {...props}>
      {children}
    </th>
  );
}

export function TD({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("whitespace-nowrap px-2.5 py-2.5 text-[13px] font-normal sm:px-3", className)} {...props}>
      {children}
    </td>
  );
}

export function TableFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-line px-3 py-2.5", className)}>{children}</div>
  );
}
