import type { AdminSubscription } from "@/lib/admin-api";

export type LicenseUiKind = "none" | "demo_active" | "demo_expired" | "annual_active" | "annual_expired" | "suspended" | "cancelled";

export function resolveLicenseUiKind(sub: AdminSubscription | null | undefined): LicenseUiKind {
  if (!sub) return "none";
  if (sub.status === "SUSPENDED") return "suspended";
  if (sub.status === "CANCELLED") return "cancelled";
  const expired = sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0 || sub.readOnly;
  if (sub.plan === "DEMO") return expired ? "demo_expired" : "demo_active";
  if (sub.plan === "ANNUAL") return expired ? "annual_expired" : "annual_active";
  return "none";
}

export type OrgLicenseAction =
  | "resend"
  | "demoPlus3"
  | "demoExtend"
  | "convertAnnual"
  | "renewAnnual"
  | "customEnds"
  | "startDemo"
  | "startAnnual"
  | "manage"
  | "note"
  | "activate"
  | "deactivate"
  | "reactivateLicense"
  | "suspendLicense";

/** Hangi hızlı işlemlerin görüneceği — çelişen butonları aynı anda göstermez. */
export function orgLicenseActions(
  kind: LicenseUiKind,
  tenantActive: boolean,
): OrgLicenseAction[] {
  const base: OrgLicenseAction[] = ["resend", "note", "manage"];
  const life: OrgLicenseAction[] = tenantActive ? ["deactivate"] : ["activate"];

  switch (kind) {
    case "none":
      return [...base, "startDemo", "startAnnual", ...life];
    case "demo_active":
      return [...base, "demoPlus3", "demoExtend", "convertAnnual", ...life];
    case "demo_expired":
      return [...base, "demoExtend", "convertAnnual", ...life];
    case "annual_active":
      return [...base, "renewAnnual", "customEnds", "suspendLicense", ...life];
    case "annual_expired":
      return [...base, "renewAnnual", ...life];
    case "suspended":
      return [...base, "reactivateLicense", ...life];
    case "cancelled":
      return [...base, "startDemo", "startAnnual", ...life];
    default:
      return [...base, ...life];
  }
}

export type UserLicenseAction =
  | "edit"
  | "resendInvite"
  | "access"
  | "note"
  | "demoPlus3"
  | "demoExtend"
  | "convertAnnual"
  | "renewAnnual"
  | "customEnds"
  | "startDemo"
  | "startAnnual"
  | "manage"
  | "activate"
  | "deactivate"
  | "reactivateLicense"
  | "suspendLicense";

export function userLicenseActions(
  kind: LicenseUiKind,
  userActive: boolean,
  hasMembership: boolean,
): UserLicenseAction[] {
  const base: UserLicenseAction[] = ["edit", "resendInvite", "note"];
  if (hasMembership) base.push("access");
  base.push("manage");
  const life: UserLicenseAction[] = userActive ? ["deactivate"] : ["activate"];

  switch (kind) {
    case "none":
      return [...base, "startDemo", "startAnnual", ...life];
    case "demo_active":
      return [...base, "demoPlus3", "demoExtend", "convertAnnual", ...life];
    case "demo_expired":
      return [...base, "demoExtend", "convertAnnual", ...life];
    case "annual_active":
      return [...base, "renewAnnual", "customEnds", "suspendLicense", ...life];
    case "annual_expired":
      return [...base, "renewAnnual", ...life];
    case "suspended":
      return [...base, "reactivateLicense", ...life];
    case "cancelled":
      return [...base, "startDemo", "startAnnual", ...life];
    default:
      return [...base, ...life];
  }
}
