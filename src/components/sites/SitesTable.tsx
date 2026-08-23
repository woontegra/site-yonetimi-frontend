"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { readSiteCounts, type Site } from "@/lib/sites-api";

function formatLocation(site: Site): string {
  const parts = [site.city, site.district].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

type SitesTableProps = {
  items: Site[];
  loading: boolean;
  onEdit: (site: Site) => void;
  onArchive: (site: Site) => void;
  onDelete: (site: Site) => void;
};

export function SitesTable({ items, loading, onEdit, onArchive, onDelete }: SitesTableProps) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`m-skel-${index}`}
                className="h-24 animate-pulse rounded-lg border border-line bg-white"
              />
            ))
          : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-lg border border-line bg-white px-4 py-8 text-center text-sm text-muted">
            Henüz site bulunmuyor.
          </div>
        ) : null}

        {!loading
          ? items.map((site) => {
              const counts = readSiteCounts(site);
              return (
              <div key={site.id} className="rounded-lg border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/app/siteler/${site.id}`}
                      className="block truncate font-medium text-ink hover:text-brand"
                    >
                      {site.name}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-muted">{formatLocation(site)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge active={site.isActive} />
                    <Dropdown
                      align="right"
                      trigger={
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                          aria-label="İşlemler"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                    >
                      <DropdownItem onClick={() => onEdit(site)}>Düzenle</DropdownItem>
                      <DropdownItem onClick={() => onArchive(site)}>Arşivle</DropdownItem>
                      <DropdownItem danger onClick={() => onDelete(site)}>
                        Sil
                      </DropdownItem>
                    </Dropdown>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-muted">
                  <span>{counts.buildings} bina</span>
                  <span>{counts.apartments} daire</span>
                </div>
              </div>
              );
            })
          : null}
      </div>

      <div className="hidden md:block">
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
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <TR key={`d-skel-${index}`} className="hover:bg-transparent">
                      <TD colSpan={6}>
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                : null}

              {!loading && items.length === 0 ? (
                <TR className="hover:bg-transparent">
                  <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                    Henüz site bulunmuyor.
                  </TD>
                </TR>
              ) : null}

              {!loading
                ? items.map((site) => {
                    const counts = readSiteCounts(site);
                    return (
                    <TR key={site.id}>
                      <TD className="font-medium">
                        <Link href={`/app/siteler/${site.id}`} className="hover:text-brand">
                          {site.name}
                        </Link>
                      </TD>
                      <TD>{formatLocation(site)}</TD>
                      <TD>{counts.buildings} bina</TD>
                      <TD>{counts.apartments} daire</TD>
                      <TD>
                        <StatusBadge active={site.isActive} />
                      </TD>
                      <TD className="text-right">
                        <Dropdown
                          align="right"
                          trigger={
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                              aria-label="İşlemler"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        >
                          <DropdownItem onClick={() => onEdit(site)}>Düzenle</DropdownItem>
                          <DropdownItem onClick={() => onArchive(site)}>Arşivle</DropdownItem>
                          <DropdownItem danger onClick={() => onDelete(site)}>
                            Sil
                          </DropdownItem>
                        </Dropdown>
                      </TD>
                    </TR>
                    );
                  })
                : null}
            </TBody>
          </TableElement>
        </Table>
      </div>
    </>
  );
}
