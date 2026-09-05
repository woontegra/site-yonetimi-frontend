"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useActiveSite } from "@/lib/active-site-context";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type SiteSelectorProps = {
  compact?: boolean;
  className?: string;
};

export function SiteSelector({ compact = false, className }: SiteSelectorProps) {
  const { ready, sites, site, siteId, setSiteId, hasSites } = useActiveSite();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!ready || !hasSites) {
    return null;
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas",
          compact ? "max-w-[220px]" : "max-w-[min(100%,280px)]",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Aktif site"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">
            {site?.name ?? "Site seç"}
          </span>
          {!compact ? (
            <span className="hidden truncate text-[11px] text-muted sm:block">Aktif site</span>
          ) : null}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1 w-[min(320px,calc(100vw-2rem))] min-w-0 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface py-1 shadow-menu"
        >
          {sites.map((item) => {
            const selected = item.id === siteId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-ink hover:bg-canvas"
                onClick={() => {
                  if (item.id !== siteId) {
                    setSiteId(item.id);
                    showToast("Aktif site değiştirildi.");
                  }
                  setOpen(false);
                }}
              >
                <span className="w-4 shrink-0">
                  {selected ? <Check className="size-4 text-accent" /> : null}
                </span>
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
          <div className="my-1 border-t border-line" />
          <Link
            href="/app/siteler"
            className="block px-3 py-2 pl-9 text-sm text-muted hover:bg-canvas hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Siteleri Yönet
          </Link>
        </div>
      ) : null}
    </div>
  );
}
