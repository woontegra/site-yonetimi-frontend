import type { Apartment, ApartmentPersonSummary } from "@/lib/apartments-api";

export type ApartmentOccupantRole = "OWNER" | "TENANT";

export type ApartmentOccupantView = {
  apartmentId: string;
  apartmentNumber: string;
  buildingId: string;
  buildingName: string;
  owners: ApartmentPersonSummary[];
  tenants: ApartmentPersonSummary[];
  /** Prefer tenant, else owner — never infers "owner lives here". */
  primaryPerson: ApartmentPersonSummary | null;
  primaryRole: ApartmentOccupantRole | null;
  primaryRoleLabel: string | null;
  /** e.g. "Serdar Topal · Kiracı" or "Mehmet Kaya +1" or "Kişi atanmamış" */
  personLine: string;
  /** e.g. "Daire 6 — Serdar Topal · Kiracı" */
  label: string;
  openDebtAmount: number;
  overdueDebtAmount: number;
};

export function foldSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function roleLabel(role: ApartmentOccupantRole): string {
  return role === "TENANT" ? "Kiracı" : "Malik";
}

function buildPersonLine(
  owners: ApartmentPersonSummary[],
  tenants: ApartmentPersonSummary[],
): {
  primaryPerson: ApartmentPersonSummary | null;
  primaryRole: ApartmentOccupantRole | null;
  primaryRoleLabel: string | null;
  personLine: string;
} {
  const pool = tenants.length > 0 ? tenants : owners;
  const primaryRole: ApartmentOccupantRole | null =
    tenants.length > 0 ? "TENANT" : owners.length > 0 ? "OWNER" : null;
  const primaryPerson = pool[0] ?? null;
  if (!primaryPerson || !primaryRole) {
    return {
      primaryPerson: null,
      primaryRole: null,
      primaryRoleLabel: null,
      personLine: "Kişi atanmamış",
    };
  }
  const primaryRoleLabel = roleLabel(primaryRole);
  if (pool.length > 1) {
    return {
      primaryPerson,
      primaryRole,
      primaryRoleLabel,
      personLine: `${primaryPerson.fullName} +${pool.length - 1}`,
    };
  }
  return {
    primaryPerson,
    primaryRole,
    primaryRoleLabel,
    personLine: `${primaryPerson.fullName} · ${primaryRoleLabel}`,
  };
}

export function getApartmentOccupantView(apartment: Apartment): ApartmentOccupantView {
  const owners = apartment.owners ?? [];
  const tenants = apartment.tenants ?? [];
  const built = buildPersonLine(owners, tenants);
  const openDebtAmount = Number(apartment.debtStatus?.openAmount ?? 0);
  const overdueDebtAmount = Number(apartment.debtStatus?.overdueAmount ?? 0);

  return {
    apartmentId: apartment.id,
    apartmentNumber: apartment.number,
    buildingId: apartment.building.id,
    buildingName: apartment.building.name,
    owners,
    tenants,
    ...built,
    label: `Daire ${apartment.number} — ${built.personLine}`,
    openDebtAmount: Number.isFinite(openDebtAmount) ? openDebtAmount : 0,
    overdueDebtAmount: Number.isFinite(overdueDebtAmount) ? overdueDebtAmount : 0,
  };
}

/** Shared plain-text label for selects, lists, and matching UIs. */
export function formatApartmentOccupantLabel(apartment: Apartment): string {
  return getApartmentOccupantView(apartment).label;
}

export function apartmentSearchHaystack(apartment: Apartment): string {
  const view = getApartmentOccupantView(apartment);
  const phones = [...view.owners, ...view.tenants]
    .map((person) => person.phone ?? "")
    .join(" ");
  const phoneDigits = phones.replace(/\D/g, "");
  const phoneTail = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : phoneDigits;
  return foldSearchText(
    [
      apartment.number,
      `daire ${apartment.number}`,
      apartment.building.name,
      view.personLine,
      ...view.owners.map((person) => person.fullName),
      ...view.tenants.map((person) => person.fullName),
      phoneTail,
    ].join(" "),
  );
}

export function apartmentMatchesQuery(apartment: Apartment, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const needle = foldSearchText(trimmed);
  return apartmentSearchHaystack(apartment).includes(needle);
}

export function sortApartmentsByNumber(apartments: Apartment[]): Apartment[] {
  return [...apartments].sort((a, b) =>
    a.number.localeCompare(b.number, "tr", { numeric: true }),
  );
}
