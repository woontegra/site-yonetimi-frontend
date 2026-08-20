import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="w-full px-4 py-6 sm:px-6">{children}</div>;
}
