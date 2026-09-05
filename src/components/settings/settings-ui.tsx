"use client";

import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

/** Ayarlar sayfasına özel kompakt tipografi / kontrol sınıfları (global bileşenleri bozmaz). */
export const settingsUi = {
  pageTitle: "text-[20px] font-semibold leading-[1.25] tracking-tight text-ink",
  pageDesc: "mt-0.5 text-[12px] font-normal leading-[1.35] text-muted",
  cardTitle: "text-[14px] font-semibold leading-[1.25] text-ink",
  cardDesc: "mt-0.5 text-[12px] font-normal leading-[1.35] text-muted",
  sectionTitle: "text-[13px] font-semibold leading-[1.25] text-ink",
  label: "text-[12px] font-medium leading-[1.25] text-ink",
  body: "text-[13px] font-normal leading-[1.4] text-ink",
  help: "text-[11px] font-normal leading-[1.35] text-muted",
  tableHead: "text-[11px] font-semibold tracking-normal text-muted",
  tableCell: "text-[12px] leading-[1.35] text-ink",
  rowAction: "text-[12px] font-medium text-accent hover:underline",
  rowActionMuted: "text-[12px] font-medium text-muted hover:text-ink hover:underline",
  rowActionDanger: "text-[12px] font-medium text-danger hover:underline",
  control:
    "h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-normal text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink/80",
  textarea:
    "min-h-[64px] rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] font-normal leading-[1.4] text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-canvas",
  btnPrimary:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
  btnSecondary:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50",
  btnSm:
    "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50",
  iconBtn:
    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-ink",
  stack: "space-y-3",
  formGap: "gap-3",
  cardsGap: "space-y-3",
} as const;

type SettingsCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** İnce sol vurgu (pastel kart boyaması yerine). */
  accent?: "neutral" | "teal" | "violet" | "amber" | "cyan" | "blue" | "green";
};

const accentBorder: Record<NonNullable<SettingsCardProps["accent"]>, string> = {
  neutral: "",
  teal: "border-l-[3px] border-l-[color:var(--tone-teal-accent)]",
  violet: "border-l-[3px] border-l-[color:var(--tone-violet-accent)]",
  amber: "border-l-[3px] border-l-[color:var(--tone-amber-accent)]",
  cyan: "border-l-[3px] border-l-[color:var(--tone-cyan-accent)]",
  blue: "border-l-[3px] border-l-[color:var(--tone-blue-accent)]",
  green: "border-l-[3px] border-l-[color:var(--tone-green-accent)]",
};

export function SettingsCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  accent = "neutral",
}: SettingsCardProps) {
  const hasBody = children != null && children !== false;

  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-surface shadow-sm",
        accentBorder[accent],
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-3.5 py-3 sm:px-4",
          hasBody && "border-b border-line/80",
        )}
      >
        <div className="min-w-0">
          <h2 className={settingsUi.cardTitle}>{title}</h2>
          {description ? <p className={settingsUi.cardDesc}>{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {hasBody ? <div className={cn("px-3.5 py-3.5 sm:px-4", bodyClassName)}>{children}</div> : null}
    </section>
  );
}

type SettingsFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function SettingsField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className,
}: SettingsFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className={settingsUi.label}>
        {label}
        {required ? (
          <span className="ml-0.5 text-[11px] font-medium text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-[11px] leading-[1.35] text-danger">
          <CircleAlert className="mt-px size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className={settingsUi.help}>{hint}</p>
      ) : null}
    </div>
  );
}

export function SettingsInput({
  className,
  invalid = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "box-border w-full min-w-0 max-w-full",
        settingsUi.control,
        invalid && "border-danger focus:border-danger focus:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}

export function SettingsTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("box-border w-full min-w-0 max-w-full resize-y", settingsUi.textarea, className)}
      {...props}
    />
  );
}

export function SettingsSelect({
  className,
  invalid = false,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "box-border w-full min-w-0 max-w-full",
        settingsUi.control,
        invalid && "border-danger focus:border-danger focus:ring-danger/15",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SettingsPasswordInput({
  className,
  invalid,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <input
        {...props}
        type={visible ? "text" : "password"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={invalid || undefined}
        className={cn(
          "box-border min-w-0 flex-1",
          settingsUi.control,
          invalid && "border-danger focus:border-danger focus:ring-danger/15",
          className,
        )}
      />
      <button
        type="button"
        className={settingsUi.iconBtn}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        {visible ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
      </button>
    </div>
  );
}

export function SettingsActionRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line/70 pt-3", className)}>
      {children}
    </div>
  );
}

export function SettingsInfoGrid({
  items,
  columns = "auto",
}: {
  items: Array<{ label: string; value: ReactNode; hint?: ReactNode }>;
  columns?: "auto" | 4 | 5 | 6;
}) {
  const gridClass =
    columns === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : columns === 5
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        : columns === 6
          ? "grid-cols-2 sm:grid-cols-3"
          : items.length <= 4
            ? "grid-cols-2 sm:grid-cols-4"
            : items.length === 5
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              : "grid-cols-2 sm:grid-cols-3";

  return (
    <dl className={cn("grid gap-x-4 gap-y-2.5", gridClass)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className={settingsUi.help}>{item.label}</dt>
          <dd className={cn(settingsUi.body, "mt-0.5 truncate")}>{item.value}</dd>
          {item.hint ? <div className="mt-0.5">{item.hint}</div> : null}
        </div>
      ))}
    </dl>
  );
}

type SettingsTabsProps<T extends string> = {
  tabs: ReadonlyArray<{ id: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

export function SettingsTabs<T extends string>({ tabs, value, onChange, className }: SettingsTabsProps<T>) {
  return (
    <div
      className={cn(
        "-mx-1 mb-3 flex min-w-0 gap-0.5 overflow-x-auto overscroll-x-contain border-b border-line px-1 pb-px",
        className,
      )}
      role="tablist"
    >
      {tabs.map((item) => {
        const active = value === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors",
              active
                ? "bg-accent-subtle font-medium text-accent"
                : "font-normal text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {Icon ? <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <h1 className={settingsUi.pageTitle}>{title}</h1>
      {description ? <p className={settingsUi.pageDesc}>{description}</p> : null}
    </div>
  );
}
