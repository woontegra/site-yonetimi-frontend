"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useActiveSite } from "@/lib/active-site-context";
import {
  effectiveBuildingAddress,
  formatAddressDisplay,
} from "@/lib/building-address";
import type { Building } from "@/lib/buildings-api";

type BuildingsTableProps = {
  items: Building[];
  loading: boolean;
  emptyLabel?: string;
  onEdit: (building: Building) => void;
  onDelete: (building: Building) => void;
};

export function BuildingsTable({
  items,
  loading,
  emptyLabel = "Henüz bina bulunmuyor.",
  onEdit,
  onDelete,
}: BuildingsTableProps) {
  const { site } = useActiveSite();

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
                {emptyLabel}
              </TD>
            </TR>
          ) : null}

          {!loading
            ? items.map((building) => {
                const address = formatAddressDisplay(
                  effectiveBuildingAddress(building, site),
                );
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
                    <TD className="text-right">
                      {(() => {
                        const registered = building.registeredApartmentCount ?? 0;
                        const capacity = building.apartmentCount;
                        const over =
                          capacity != null && registered > capacity;
                        return (
                          <span
                            className={over ? "font-medium text-warning" : undefined}
                            title={
                              capacity != null
                                ? `${registered} daire kaydı / ${capacity} bina kapasitesi`
                                : `${registered} daire kaydı`
                            }
                          >
                            {capacity != null
                              ? `${registered} / ${capacity}`
                              : `${registered}`}
                          </span>
                        );
                      })()}
                    </TD>
                    <TD className="text-right">
                      {building.floorCount != null ? building.floorCount : "—"}
                    </TD>
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
