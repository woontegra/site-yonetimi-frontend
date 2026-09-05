"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Sidebar hariç kalan alanı dolduran admin detay kabuğu (max-width yok). */
export function AdminDetailShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 px-4 py-5 lg:px-6 xl:px-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function AdminDetailBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-slate-100 hover:text-accent"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

export function AdminDetailHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  badges,
  leading,
  actions,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: ReactNode;
  badges?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <AdminDetailBackLink href={backHref} label={backLabel} />
        <div className="flex min-w-0 items-start gap-2.5">
          {leading}
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold leading-snug tracking-tight text-ink sm:text-[19px]">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 break-words text-[12px] font-normal leading-[1.4] text-muted">
                {subtitle}
              </div>
            ) : null}
            {badges ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const STAT_TONES = {
  teal: "bg-teal-50 text-teal-700",
  blue: "bg-sky-50 text-sky-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
} as const;

export function AdminDetailStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <article className="flex min-h-[88px] min-w-0 items-start gap-3 rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {Icon ? (
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px]",
            STAT_TONES[tone],
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        <p className="mt-0.5 break-words text-[16px] font-semibold leading-tight tracking-tight text-ink sm:text-[17px]">
          {value}
        </p>
        {hint ? <p className="mt-0.5 break-words text-[11px] leading-[1.35] text-muted">{hint}</p> : null}
      </div>
    </article>
  );
}

export function AdminDetailStatsRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

export function AdminDetailPanel({
  title,
  description,
  children,
  className,
  bodyClassName,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-line/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-line/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-[1.4] text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={cn("px-4 py-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function AdminDetailQuickActions({
  description,
  children,
}: {
  description?: string;
  children: ReactNode;
}) {
  return (
    <AdminDetailPanel
      title="Hızlı İşlemler"
      description={description ?? "Bu kayıt için platform işlemlerini tek yerden yönetin."}
      bodyClassName="flex flex-wrap gap-2"
    >
      {children}
    </AdminDetailPanel>
  );
}

export function AdminDetailTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<{ id: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
      aria-label="Detay sekmeleri"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              active
                ? "border-teal-200/80 bg-teal-50 text-teal-800"
                : "border-transparent bg-transparent text-muted hover:bg-slate-100 hover:text-ink",
            )}
          >
            {Icon ? <Icon className="size-3.5" strokeWidth={1.75} aria-hidden /> : null}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function AdminDetailInfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[56px] min-w-0 rounded-[12px] border border-line/70 bg-slate-50/90 px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 break-words text-[12px] font-medium leading-[1.35] text-ink sm:text-[13px]">
        {value}
      </p>
    </div>
  );
}

export function AdminDetailInfoGrid({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2.5 sm:grid-cols-2",
        wide && "lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

export function AdminDangerZone({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-rose-200/70 bg-rose-50/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-[12px] font-medium text-rose-800">Tehlikeli İşlemler</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Kalıcı silme geri alınamaz. İlişkili kayıt varsa engellenir.
          </p>
        </div>
        <span className="text-[11px] text-muted">{open ? "Gizle" : "Göster"}</span>
      </button>
      {open ? <div className="border-t border-rose-100 px-4 py-3">{children}</div> : null}
    </section>
  );
}
