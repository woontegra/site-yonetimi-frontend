"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { PersonListItem } from "@/lib/persons-api";

type PersonsTableProps = {
  items: PersonListItem[];
  loading: boolean;
  emptyLabel?: string;
  onEdit: (person: PersonListItem) => void;
  onDelete: (person: PersonListItem) => void;
};

export function PersonsTable({
  items,
  loading,
  emptyLabel = "Henüz kişi bulunmuyor.",
  onEdit,
  onDelete,
}: PersonsTableProps) {
  return (
    <Table>
      <TableElement>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Ad Soyad</TH>
            <TH>Telefon</TH>
            <TH>E-posta</TH>
            <TH>İlişki</TH>
            <TH>Daire</TH>
            <TH>Durum</TH>
            <TH className="text-right">İşlemler</TH>
          </TR>
        </THead>
        <TBody>
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                  <TD colSpan={7}>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  </TD>
                </TR>
              ))
            : null}

          {!loading && items.length === 0 ? (
            <TR className="hover:bg-transparent">
              <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                {emptyLabel}
              </TD>
            </TR>
          ) : null}

          {!loading
            ? items.map((person) => (
                <TR key={person.id}>
                  <TD className="font-medium">
                    <Link href={`/app/kisiler/${person.id}`} className="hover:text-brand">
                      {person.fullName}
                    </Link>
                  </TD>
                  <TD>{person.phone || "—"}</TD>
                  <TD>{person.email || "—"}</TD>
                  <TD>
                    <span title={person.relationSummary}>{person.relationSummary}</span>
                  </TD>
                  <TD>
                    <span title={person.apartmentSummary}>{person.apartmentSummary}</span>
                  </TD>
                  <TD>
                    <StatusBadge active={person.isActive} />
                  </TD>
                  <TD className="text-right">
                    <Dropdown
                      align="right"
                      trigger={
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                          aria-label={`${person.fullName} işlemleri`}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                    >
                      <DropdownItem href={`/app/kisiler/${person.id}`}>Detay</DropdownItem>
                      <DropdownItem onClick={() => onEdit(person)}>Düzenle</DropdownItem>
                      <DropdownItem danger onClick={() => onDelete(person)}>
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
