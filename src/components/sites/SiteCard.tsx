"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, MoreHorizontal, Sparkles } from "lucide-react";
import {
  EntityIcon,
  SETUP_STATUS_LABELS,
  readSiteStats,
  setupNeedsAttention,
  siteAddressSummary,
  siteLocation,
} from "@/components/sites/site-ui";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Site } from "@/lib/sites-api";
import { setupWizardActionLabel } from "@/lib/sites-api";
import { cn } from "@/lib/cn";

type SiteCardProps = {
  site: Site;
  canManage?: boolean;
  canOpenWizard?: boolean;
  onEdit: (site: Site) => void;
  onOpenWizard?: (site: Site) => void;
  onArchive: (site: Site) => void;
  onDelete: (site: Site) => void;
  className?: string;
};

export function SiteCard({
  site,
  canManage = true,
  canOpenWizard = false,
  onEdit,
  onOpenWizard,
  onArchive,
  onDelete,
  className,
}: SiteCardProps) {
  const location = siteLocation(site);
  const stats = readSiteStats(site);
  const showWizard = canOpenWizard && onOpenWizard && setupNeedsAttention(site.setupStatus);

  return (
    <SurfaceCard padding="none" className={cn("flex h-full flex-col overflow-hidden", className)}>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <EntityIcon icon={Building2} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/app/siteler/${site.id}`}
                className="block break-words text-base font-semibold text-ink hover:text-accent"
              >
                {site.name}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge active={site.isActive} />
                {location ? <span className="text-sm text-muted">{location}</span> : null}
                {site.setupStatus && setupNeedsAttention(site.setupStatus) ? (
                  <Badge tone="warning">{SETUP_STATUS_LABELS[site.setupStatus]}</Badge>
                ) : null}
              </div>
            </div>
            {canManage ? (
              <Dropdown
                align="right"
                menuClassName="min-w-[12.5rem]"
                trigger={
                  <button
                    type="button"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                    aria-label={`${site.name} işlemleri`}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                }
              >
                <DropdownItem href={`/app/siteler/${site.id}`}>Görüntüle</DropdownItem>
                <DropdownItem onClick={() => onEdit(site)}>Düzenle</DropdownItem>
                {canOpenWizard && onOpenWizard ? (
                  <DropdownItem onClick={() => onOpenWizard(site)}>Kurulum Sihirbazı</DropdownItem>
                ) : null}
                <DropdownItem onClick={() => onArchive(site)}>Arşivle</DropdownItem>
                <DropdownItem danger onClick={() => onDelete(site)}>
                  Siteyi Sil
                </DropdownItem>
              </Dropdown>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
        <MiniStat label="Bina" value={String(stats.buildings)} />
        <MiniStat label="Daire" value={String(stats.apartments)} />
        <MiniStat label="Aktif daire" value={String(stats.activeApartments)} />
        <MiniStat
          label="Aktif oran"
          value={
            stats.apartments > 0
              ? `${Math.round((stats.activeApartments / stats.apartments) * 100)}%`
              : "—"
          }
        />
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-line px-5 py-4">
        <p className="line-clamp-2 break-words text-sm text-muted">{siteAddressSummary(site)}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/siteler/${site.id}`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas"
          >
            Detayı Gör
          </Link>
          {showWizard ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => onOpenWizard?.(site)}>
              <Sparkles className="size-3.5" aria-hidden />
              {setupWizardActionLabel(site.setupStatus)}
            </Button>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-canvas px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

/** Single-site layout: constrain card width so it doesn't stretch full screen. */
export function SiteCardsGrid({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  if (count <= 1) {
    return <div className="w-full max-w-[520px]">{children}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}
