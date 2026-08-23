"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { Apartment } from "@/lib/apartments-api";
import { formatSquareMeters } from "@/lib/room-types";

type ApartmentsTableProps = {
  items: Apartment[];
  loading: boolean;
  showBuilding?: boolean;
  emptyLabel?: string;
  onEdit: (apartment: Apartment) => void;
  onDelete: (apartment: Apartment) => void;
};

export function ApartmentsTable({
  items,
  loading,
  showBuilding = true,
  emptyLabel = "Henüz daire bulunmuyor.",
  onEdit,
  onDelete,
}: ApartmentsTableProps) {
  const columns = showBuilding ? 7 : 6;

  return (
    <Table>
      <TableElement>
        <THead>
          <TR className="hover:bg-transparent">
            {showBuilding ? <TH>Bina</TH> : null}
            <TH>Daire No</TH>
            <TH>Kat</TH>
            <TH>Oda Tipi</TH>
            <TH className="text-right">Metrekare</TH>
            <TH>Durum</TH>
            <TH className="text-right">İşlemler</TH>
          </TR>
        </THead>
        <TBody>
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                  <TD colSpan={columns}>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  </TD>
                </TR>
              ))
            : null}

          {!loading && items.length === 0 ? (
            <TR className="hover:bg-transparent">
              <TD colSpan={columns} className="py-8 text-center text-sm text-muted">
                {emptyLabel}
              </TD>
            </TR>
          ) : null}

          {!loading
            ? items.map((apartment) => (
                <TR key={apartment.id}>
                  {showBuilding ? (
                    <TD className="font-medium">
                      <Link href={`/app/binalar/${apartment.building.id}`} className="hover:text-brand">
                        {apartment.building.name}
                      </Link>
                    </TD>
                  ) : null}
                  <TD className="font-medium">
                    <Link href={`/app/daireler/${apartment.id}`} className="hover:text-brand">
                      {apartment.number}
                    </Link>
                  </TD>
                  <TD>{apartment.floor?.trim() ? apartment.floor : "—"}</TD>
                  <TD>{apartment.roomType?.trim() ? apartment.roomType : "—"}</TD>
                  <TD className="text-right">{formatSquareMeters(apartment.squareMeters)}</TD>
                  <TD>
                    <StatusBadge active={apartment.isActive} />
                  </TD>
                  <TD className="text-right">
                    <Dropdown
                      align="right"
                      trigger={
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                          aria-label={`Daire ${apartment.number} işlemleri`}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                    >
                      <DropdownItem href={`/app/daireler/${apartment.id}`}>Detay</DropdownItem>
                      <DropdownItem onClick={() => onEdit(apartment)}>Düzenle</DropdownItem>
                      <DropdownItem danger onClick={() => onDelete(apartment)}>
                        Sil
                      </DropdownItem>
                    </Dropdown>
                  </TD>
                </TR>
              ))
            : null}
        </TBody>
      </TableElement>
    </Table>
  );
}
