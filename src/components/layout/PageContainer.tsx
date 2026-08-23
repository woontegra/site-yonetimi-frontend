import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageContainer({
  children,
  className,
  width = "full",
}: {
  children: ReactNode;
  className?: string;
  width?: "default" | "wide" | "full";
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 px-4 py-6 lg:px-6 xl:px-8",
        width === "default" && "mx-auto max-w-[1120px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
