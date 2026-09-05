"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { Apartment } from "@/lib/apartments-api";
import { formatMoney } from "@/lib/money";
import { formatSquareMeters } from "@/lib/room-types";

type ApartmentsTableProps = {
  items: Apartment[];
  loading: boolean;
  showBuilding?: boolean;
  emptyLabel?: string;
  canManageDues?: boolean;
  onEdit: (apartment: Apartment) => void;
  onDelete: (apartment: Apartment) => void;
  onManageResidents?: (apartment: Apartment) => void;
  onDefineExemption?: (apartment: Apartment) => void;
  onEditExemption?: (apartment: Apartment) => void;
};

function duesTone(code?: string) {
  if (code === "EXEMPT") return "success" as const;
  if (code === "DISCOUNTED") return "info" as const;
  if (code === "EXPIRING_SOON") return "warning" as const;
  return "neutral" as const;
}

function debtTone(code?: string) {
  if (code === "OVERDUE") return "danger" as const;
  if (code === "OPEN") return "warning" as const;
  return "neutral" as const;
}

function occupancyTone(code?: string) {
  if (code === "TENANT_OCCUPIED") return "info" as const;
  if (code === "OWNER_OCCUPIED") return "success" as const;
  return "neutral" as const;
}

function RowMenu({
  apartment,
  canManageDues,
  onEdit,
  onDelete,
  onManageResidents,
  onDefineExemption,
  onEditExemption,
}: {
  apartment: Apartment;
  canManageDues?: boolean;
  onEdit: (apartment: Apartment) => void;
  onDelete: (apartment: Apartment) => void;
  onManageResidents?: (apartment: Apartment) => void;
  onDefineExemption?: (apartment: Apartment) => void;
  onEditExemption?: (apartment: Apartment) => void;
}) {
  const hasActiveExemption = Boolean(apartment.duesStatus?.exemption);

  return (
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
      <DropdownItem href={`/app/daireler/${apartment.id}`}>Detayı Gör</DropdownItem>
      <DropdownItem onClick={() => onEdit(apartment)}>Düzenle</DropdownItem>
      {onManageResidents ? (
        <DropdownItem onClick={() => onManageResidents(apartment)}>Malik/Kiracı Yönet</DropdownItem>
      ) : (
        <DropdownItem href={`/app/daireler/${apartment.id}?tab=kisiler`}>
          Malik/Kiracı Yönet
        </DropdownItem>
      )}
      {canManageDues && onDefineExemption && onEditExemption ? (
        hasActiveExemption ? (
          <DropdownItem onClick={() => onEditExemption(apartment)}>
            Aidat Muafiyetini Düzenle
          </DropdownItem>
        ) : (
          <DropdownItem onClick={() => onDefineExemption(apartment)}>
            Aidat Muafiyeti Tanımla
          </DropdownItem>
        )
      ) : null}
      <DropdownItem href={`/app/daireler/${apartment.id}?tab=hareketler`}>Geçmişi Gör</DropdownItem>
      <DropdownItem danger onClick={() => onDelete(apartment)}>
        Arşivle
      </DropdownItem>
    </Dropdown>
  );
}

export function ApartmentsTable({
  items,
  loading,
  showBuilding = false,
  emptyLabel = "Henüz daire bulunmuyor.",
  canManageDues,
  onEdit,
  onDelete,
  onManageResidents,
  onDefineExemption,
  onEditExemption,
}: ApartmentsTableProps) {
  const columns = showBuilding ? 10 : 9;

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableElement>
            <THead>
              <TR className="hover:bg-transparent">
                {showBuilding ? <TH>Bina</TH> : null}
                <TH>Daire</TH>
                <TH>Kat</TH>
                <TH>Malik</TH>
                <TH>Oturan</TH>
                <TH>İletişim</TH>
                <TH>Kullanım</TH>
                <TH>Aidat Durumu</TH>
                <TH>Borç Durumu</TH>
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
                          <Link
                            href={`/app/binalar/${apartment.building.id}`}
                            className="hover:text-brand"
                          >
                            {apartment.building.name}
                          </Link>
                        </TD>
                      ) : null}
                      <TD>
                        <Link href={`/app/daireler/${apartment.id}`} className="block hover:text-brand">
                          <span className="font-semibold text-ink">
                            {apartment.building.name} · Daire {apartment.number}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {[apartment.roomType?.trim(), formatSquareMeters(apartment.squareMeters)]
                              .filter((part) => part && part !== "—")
                              .join(" · ") || "—"}
                          </span>
                        </Link>
                      </TD>
                      <TD>{apartment.floor?.trim() ? apartment.floor : "—"}</TD>
                      <TD>{apartment.ownerLabel ?? "Malik atanmamış"}</TD>
                      <TD>{apartment.residentLabel ?? "—"}</TD>
                      <TD>{apartment.primaryPhone?.trim() ? apartment.primaryPhone : "—"}</TD>
                      <TD>
                        <Badge tone={occupancyTone(apartment.occupancy)}>
                          {apartment.occupancyLabel ?? "Belirsiz"}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge tone={duesTone(apartment.duesStatus?.code)}>
                          {apartment.duesStatus?.label ?? "Normal"}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge tone={debtTone(apartment.debtStatus?.code)}>
                          {apartment.debtStatus?.code === "OPEN"
                            ? `${formatMoney(apartment.debtStatus.openAmount)} açık borç`
                            : (apartment.debtStatus?.label ?? "Borcu yok")}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <RowMenu
                          apartment={apartment}
                          canManageDues={canManageDues}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onManageResidents={onManageResidents}
                          onDefineExemption={onDefineExemption}
                          onEditExemption={onEditExemption}
                        />
                      </TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </TableElement>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`m-skel-${index}`} className="h-28 animate-pulse rounded-lg border border-line bg-slate-50" />
            ))
          : null}
        {!loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>
        ) : null}
        {!loading
          ? items.map((apartment) => (
              <article
                key={apartment.id}
                className="rounded-lg border border-line bg-surface px-3 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/app/daireler/${apartment.id}`}
                      className="text-[13px] font-medium text-ink hover:text-brand"
                    >
                      {apartment.building.name} · Daire {apartment.number}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      Malik: {apartment.ownerLabel ?? "Malik atanmamış"}
                    </p>
                    <p className="text-xs text-muted">
                      Oturan: {apartment.residentLabel ?? "—"}
                    </p>
                  </div>
                  <RowMenu
                    apartment={apartment}
                    canManageDues={canManageDues}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onManageResidents={onManageResidents}
                    onDefineExemption={onDefineExemption}
                    onEditExemption={onEditExemption}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={duesTone(apartment.duesStatus?.code)}>
                    {apartment.duesStatus?.label ?? "Normal"}
                  </Badge>
                  <Badge tone={debtTone(apartment.debtStatus?.code)}>
                    {apartment.debtStatus?.code === "OPEN"
                      ? `${formatMoney(apartment.debtStatus.openAmount)} açık borç`
                      : (apartment.debtStatus?.label ?? "Borcu yok")}
                  </Badge>
                </div>
              </article>
            ))
          : null}
      </div>
    </>
  );
}
