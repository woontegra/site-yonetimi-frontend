import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SetupStatus, Site } from "@/lib/sites-api";

export const SETUP_STATUS_LABELS: Record<SetupStatus, string> = {
  NOT_STARTED: "Kurulum başlamadı",
  IN_PROGRESS: "Kurulum devam ediyor",
  COMPLETED: "Kurulum tamamlandı",
  SKIPPED: "Kurulum atlandı",
};

export function siteLocation(site: Pick<Site, "city" | "district">): string {
  return [site.city, site.district].filter(Boolean).join(" / ");
}

export function siteAddressSummary(site: Pick<Site, "address" | "city" | "district">): string {
  const parts = [site.address, site.city, site.district].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function readSiteStats(site: Site) {
  const buildings = site.buildingCount ?? 0;
  const apartments = site.apartmentCount ?? 0;
  const activeApartments = site.activeApartmentCount ?? 0;
  return { buildings, apartments, activeApartments };
}

export function setupNeedsAttention(status?: SetupStatus): boolean {
  return status === "NOT_STARTED" || status === "IN_PROGRESS";
}

export function EntityIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-accent",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>;
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export function dash(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text || "—";
}
