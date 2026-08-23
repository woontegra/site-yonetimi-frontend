import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  search?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  chips?: ReactNode;
};

export function PageHeader({ title, description, search, actions, meta, chips }: PageHeaderProps) {
  const hasToolbar = Boolean(search || meta || chips);

  return (
    <div className="mb-5 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-page text-ink">{title}</h1>
          {description ? <p className="mt-1 break-words text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="action-stack">{actions}</div> : null}
      </div>

      {hasToolbar ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-panel sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {meta ? <div className="text-caption text-muted">{meta}</div> : null}
            {chips}
          </div>
          {search ? <div className="w-full min-w-0 sm:max-w-xs">{search}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
