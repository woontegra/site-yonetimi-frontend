import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  search?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, search, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-none text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {search}
        {actions}
      </div>
    </div>
  );
}
