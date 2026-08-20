"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { Building } from "@/lib/buildings-api";

function formatAddress(building: Building): { primary: string; secondary?: string } {
  const location = [building.district, building.city].filter(Boolean).join(" / ");
  if (location && building.address) {
    return { primary: location, secondary: building.address };
  }
  if (location) return { primary: location };
  if (building.address) return { primary: building.address };
  return { primary: "—" };
}

type BuildingsTableProps = {
  items: Building[];
  loading: boolean;
  onEdit: (building: Building) => void;
  onDelete: (building: Building) => void;
};

export function BuildingsTable({ items, loading, onEdit, onDelete }: BuildingsTableProps) {
  return (
    <Table>
      <TableElement>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Bina Adı</TH>
            <TH>Adres</TH>
            <TH className="text-right">Daire Sayısı</TH>
            <TH className="text-right">Kat Sayısı</TH>
            <TH>Durum</TH>
            <TH className="text-right">İşlemler</TH>
          </TR>
        </THead>
        <TBody>
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                  <TD colSpan={6}>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  </TD>
                </TR>
              ))
            : null}

          {!loading && items.length === 0 ? (
            <TR className="hover:bg-transparent">
              <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                Henüz bina bulunmuyor.
              </TD>
            </TR>
          ) : null}

          {!loading
            ? items.map((building) => {
                const address = formatAddress(building);
                return (
                  <TR key={building.id}>
                    <TD className="font-medium">
                      <Link href={`/app/binalar/${building.id}`} className="hover:text-brand">
                        {building.name}
                      </Link>
                    </TD>
                    <TD className="whitespace-normal">
                      <div>{address.primary}</div>
                      {address.secondary ? (
                        <div className="text-xs text-muted">{address.secondary}</div>
                      ) : null}
                    </TD>
                    <TD className="text-right">{building.apartmentCount}</TD>
                    <TD className="text-right">{building.floorCount}</TD>
                    <TD>
                      <StatusBadge active={building.isActive} />
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label={`${building.name} işlemleri`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/binalar/${building.id}`}>Detay</DropdownItem>
                        <DropdownItem onClick={() => onEdit(building)}>Düzenle</DropdownItem>
                        <DropdownItem danger onClick={() => onDelete(building)}>
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
  );
}
