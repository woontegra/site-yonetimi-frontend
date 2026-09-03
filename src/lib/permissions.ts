import type { SessionUser } from "@/lib/session";

export function hasPermission(user: SessionUser | null | undefined, code: string): boolean {
  if (!user) return false;
  return (user.permissions ?? []).includes(code);
}

export function hasAnyPermission(user: SessionUser | null | undefined, codes: string[]): boolean {
  return codes.some((code) => hasPermission(user, code));
}

/** Boş permission listesi (eski oturum / tam yetki) siteleri yönetebilir. */
export function canManageSites(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (!user.permissions?.length) return true;
  return hasPermission(user, "sites.manage");
}

export function canManageAssets(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (!user.permissions?.length) return true;
  return hasPermission(user, "assets.manage");
}

export function canManageAnnouncements(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (!user.permissions?.length) return true;
  return hasPermission(user, "announcements.manage");
}
