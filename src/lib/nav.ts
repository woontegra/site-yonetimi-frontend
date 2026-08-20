import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  Cog,
  DoorOpen,
  Landmark,
  MessageSquare,
  Plug,
  Truck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { href: "/app/binalar", label: "Binalar", icon: Building2 },
  { href: "/app/daireler", label: "Daireler", icon: DoorOpen },
  { href: "/app/kisiler", label: "Kişiler", icon: Users },
  { href: "/app/demirbaslar", label: "Demirbaşlar", icon: Wrench },
  { href: "/app/muhasebe", label: "Muhasebe", icon: Landmark },
  { href: "/app/misafirler", label: "Misafirler", icon: UserRound },
  { href: "/app/calisanlar", label: "Çalışanlar", icon: Users },
  { href: "/app/duyurular", label: "Duyurular", icon: Bell },
];

export const compactPrimaryNav: NavItem[] = [
  { href: "/app/binalar", label: "Binalar", icon: Building2 },
  { href: "/app/daireler", label: "Daireler", icon: DoorOpen },
  { href: "/app/kisiler", label: "Kişiler", icon: Users },
  { href: "/app/muhasebe", label: "Muhasebe", icon: Landmark },
];

export const otherNav: NavItem[] = [
  { href: "/app/tedarikciler", label: "Tedarikçiler", icon: Truck },
  { href: "/app/bilgi-oneri", label: "Bilgi ve Öneriler", icon: MessageSquare },
  { href: "/app/ayarlar", label: "Ayarlar", icon: Cog },
  { href: "/app/entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
];

export const overflowNav: NavItem[] = [
  { href: "/app/demirbaslar", label: "Demirbaşlar", icon: Wrench },
  { href: "/app/misafirler", label: "Misafirler", icon: UserRound },
  { href: "/app/calisanlar", label: "Çalışanlar", icon: Users },
  { href: "/app/duyurular", label: "Duyurular", icon: Bell },
  ...otherNav,
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
