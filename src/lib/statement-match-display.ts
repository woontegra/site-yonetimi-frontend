import {
  foldSearchText,
  getApartmentOccupantView,
} from "@/lib/apartment-labels";
import type { Apartment } from "@/lib/apartments-api";
import type { StatementPreviewMatch, StatementPreviewRow } from "@/lib/banks-api";

export type MatchDisplay = {
  buildingLine: string;
  personLine: string;
  ownersLine: string | null;
  tenantsLine: string | null;
  roleBadge: string | null;
  reason: string;
  nameMismatch: boolean;
  highlightedPersonId: string | null;
};

export function matchReasonOf(match: StatementPreviewMatch | null | undefined): string {
  if (!match) return "";
  return match.matchReason || match.reason || "";
}

export function isBulkApprovableMatch(match: StatementPreviewMatch | null | undefined): boolean {
  if (!match?.apartmentId) return false;
  if (match.confidence !== "HIGH") return false;
  if (match.nameMismatch) return false;
  const kind = match.matchKind ?? "";
  return (
    kind === "RULE" ||
    kind === "FULL_NAME_OWNER" ||
    kind === "FULL_NAME_TENANT" ||
    kind === "NAME_AND_APARTMENT"
  );
}

export function buildMatchDisplay(
  row: StatementPreviewRow,
  apartments: Apartment[],
  apartmentId: string | null,
  personId: string | null,
): MatchDisplay | null {
  const aptId = apartmentId ?? row.match?.apartmentId ?? null;
  if (!aptId) return null;
  const apt = apartments.find((a) => a.id === aptId);
  const reason = matchReasonOf(row.match);
  const nameMismatch = Boolean(row.match?.nameMismatch);
  const matchedName = row.match?.matchedPersonName ?? null;
  const matchedRole = row.match?.matchedPersonRole ?? null;
  const highlightedPersonId = personId ?? row.match?.personId ?? null;

  if (!apt) {
    return {
      buildingLine: "Daire eşleşti",
      personLine: matchedName
        ? `${matchedName}${matchedRole ? ` · ${matchedRole === "OWNER" ? "Malik" : "Kiracı"}` : ""}`
        : reason || "Liste yenilenmeli",
      ownersLine: null,
      tenantsLine: null,
      roleBadge: matchedRole === "OWNER" ? "Malik" : matchedRole === "TENANT" ? "Kiracı" : null,
      reason,
      nameMismatch,
      highlightedPersonId,
    };
  }

  const view = getApartmentOccupantView(apt);
  const owners = view.owners;
  const tenants = view.tenants;
  const ownersLine =
    owners.length > 0 ? `Malik: ${owners.map((o) => o.fullName).join(", ")}` : null;
  const tenantsLine =
    tenants.length > 0 ? `Kiracı: ${tenants.map((t) => t.fullName).join(", ")}` : null;

  let personLine = view.personLine;
  let roleBadge = view.primaryRoleLabel;

  if (matchedName) {
    personLine = matchedName;
    roleBadge =
      matchedRole === "OWNER" ? "Malik" : matchedRole === "TENANT" ? "Kiracı" : roleBadge;
  } else if (highlightedPersonId) {
    const hit =
      owners.find((o) => o.id === highlightedPersonId) ??
      tenants.find((t) => t.id === highlightedPersonId);
    if (hit) {
      personLine = hit.fullName;
      roleBadge = owners.some((o) => o.id === hit.id) ? "Malik" : "Kiracı";
    }
  }

  if (owners.length > 0 && tenants.length > 0) {
    personLine = "";
  }

  return {
    buildingLine: `${view.buildingName} · Daire ${view.apartmentNumber}`,
    personLine,
    ownersLine,
    tenantsLine,
    roleBadge: personLine ? roleBadge : null,
    reason,
    nameMismatch,
    highlightedPersonId,
  };
}

export function senderMatchesRegistered(
  sender: string | null,
  registered: string | null,
): boolean {
  if (!sender || !registered) return false;
  return foldSearchText(sender) === foldSearchText(registered);
}
