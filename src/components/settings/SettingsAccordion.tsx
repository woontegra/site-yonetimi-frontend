"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SettingsSectionId =
  | "site"
  | "finance"
  | "assets"
  | "feedback"
  | "bank-rules"
  | "message-templates"
  | "system";

type SettingsAccordionItemProps = {
  id: SettingsSectionId;
  title: string;
  description?: string;
  open: boolean;
  onToggle: (id: SettingsSectionId) => void;
  children: React.ReactNode;
};

export function SettingsAccordionItem({
  id,
  title,
  description,
  open,
  onToggle,
  children,
}: SettingsAccordionItemProps) {
  return (
    <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
      <button
        type="button"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-canvas/70 sm:px-5",
          open && "border-b border-line bg-canvas/40",
        )}
        onClick={() => onToggle(id)}
      >
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div> : null}
    </section>
  );
}
