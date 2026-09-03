"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import { SiteCard, SiteCardsGrid } from "@/components/sites/SiteCard";
import { siteLocation } from "@/components/sites/site-ui";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { readSiteCounts, type Site } from "@/lib/sites-api";
import { cn } from "@/lib/cn";

export type SitesViewMode = "cards" | "list";

type SitesCatalogProps = {
  items: Site[];
  loading: boolean;
  view: SitesViewMode;
  canOpenWizard?: boolean;
  canManage?: boolean;
  onEdit: (site: Site) => void;
  onOpenWizard?: (site: Site) => void;
  onArchive: (site: Site) => void;
  onDelete: (site: Site) => void;
};

export function SitesCatalog({
  items,
  loading,
  view,
  canOpenWizard = false,
  canManage = true,
  onEdit,
  onOpenWizard,
  onArchive,
  onDelete,
}: SitesCatalogProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className={cn(view === "cards" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "")}>
        {Array.from({ length: view === "cards" ? 3 : 4 }).map((_, index) => (
          <div
            key={`skel-${index}`}
            className="h-48 animate-pulse rounded-lg border border-line bg-white"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Henüz site bulunmuyor"
        description="İlk sitenizi oluşturarak bina, daire ve sakin yönetimine başlayabilirsiniz."
      />
    );
  }

  if (view === "cards") {
    return (
      <SiteCardsGrid count={items.length}>
        {items.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            canManage={canManage}
            canOpenWizard={canOpenWizard}
            onEdit={onEdit}
            onOpenWizard={onOpenWizard}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ))}
      </SiteCardsGrid>
    );
  }

  return (
    <SurfaceCard padding="none" className="overflow-hidden">
      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Site</TH>
              <TH>Konum</TH>
              <TH>Bina</TH>
              <TH>Daire</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((site) => {
              const counts = readSiteCounts(site);
              return (
                <TR
                  key={site.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/app/siteler/${site.id}`)}
                >
                  <TD className="font-medium">
                    <Link
                      href={`/app/siteler/${site.id}`}
                      className="hover:text-accent"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {site.name}
                    </Link>
                  </TD>
                  <TD>{siteLocation(site) || "—"}</TD>
                  <TD>{counts.buildings}</TD>
                  <TD>{counts.apartments}</TD>
                  <TD>
                    <StatusBadge active={site.isActive} />
                  </TD>
                  <TD className="text-right" onClick={(event) => event.stopPropagation()}>
                    {canManage ? (
                      <Dropdown
                        align="right"
                        menuClassName="min-w-[12.5rem]"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label={`${site.name} işlemleri`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/siteler/${site.id}`}>Görüntüle</DropdownItem>
                        <DropdownItem onClick={() => onEdit(site)}>Düzenle</DropdownItem>
                        {canOpenWizard && onOpenWizard ? (
                          <DropdownItem onClick={() => onOpenWizard(site)}>
                            Kurulum Sihirbazı
                          </DropdownItem>
                        ) : null}
                        <DropdownItem onClick={() => onArchive(site)}>Arşivle</DropdownItem>
                        <DropdownItem danger onClick={() => onDelete(site)}>
                          Siteyi Sil
                        </DropdownItem>
                      </Dropdown>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </TableElement>
      </Table>
    </SurfaceCard>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: SitesViewMode;
  onChange: (value: SitesViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-line bg-canvas p-0.5">
      <button
        type="button"
        aria-label="Kart görünümü"
        aria-pressed={value === "cards"}
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-[5px]",
          value === "cards" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-ink",
        )}
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Liste görünümü"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-[5px]",
          value === "list" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-ink",
        )}
      >
        <List className="size-4" />
      </button>
    </div>
  );
}
