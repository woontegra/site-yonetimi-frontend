import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Cog,
  DoorOpen,
  Landmark,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  MessageSquare,
  Plug,
  Receipt,
  TrendingDown,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "visitors";
  isActive?: (pathname: string) => boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    id: "genel",
    label: "Genel",
    items: [{ href: "/app", label: "Genel Bakış", icon: LayoutDashboard }],
  },
  {
    id: "yapi",
    label: "Yapı ve Sakinler",
    items: [
      { href: "/app/siteler", label: "Siteler", icon: MapPinned },
      { href: "/app/binalar", label: "Binalar", icon: Building2 },
      { href: "/app/daireler", label: "Daireler", icon: DoorOpen },
      { href: "/app/kisiler", label: "Kişiler", icon: Users },
    ],
  },
  {
    id: "finans",
    label: "Finans",
    items: [
      { href: "/app/muhasebe/aidatlar", label: "Aidatlar", icon: Receipt },
      {
        href: "/app/muhasebe",
        label: "Borçlar",
        icon: Wallet,
        isActive: (pathname) =>
          pathname === "/app/muhasebe" || pathname.startsWith("/app/muhasebe/borclar"),
      },
      { href: "/app/muhasebe/tahsilatlar", label: "Tahsilatlar", icon: Banknote },
      { href: "/app/muhasebe/giderler", label: "Giderler", icon: TrendingDown },
      { href: "/app/muhasebe/bankalar", label: "Banka", icon: Landmark },
    ],
  },
  {
    id: "operasyon",
    label: "Operasyon",
    items: [
      { href: "/app/demirbaslar", label: "Demirbaşlar", icon: Wrench },
      { href: "/app/misafirler", label: "Misafirler", icon: UserRound, badgeKey: "visitors" },
      { href: "/app/calisanlar", label: "Çalışanlar", icon: Briefcase },
      { href: "/app/tedarikciler", label: "Tedarikçiler", icon: Truck },
    ],
  },
  {
    id: "iletisim",
    label: "İletişim",
    items: [
      { href: "/app/duyurular", label: "Duyurular", icon: Bell },
      { href: "/app/bilgi-oneri", label: "Bilgi ve Öneriler", icon: MessageSquare },
      { href: "/app/whatsapp-sablonlari", label: "WhatsApp Şablonları", icon: MessageCircle },
    ],
  },
  {
    id: "ayarlar",
    label: "Ayarlar",
    items: [
      { href: "/app/entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
      { href: "/app/ayarlar", label: "Site Ayarları", icon: Cog },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((section) => section.items);

/** @deprecated Use navSections. Kept for any remaining compact-header callers. */
export const primaryNav: NavItem[] = allNavItems;

export const compactPrimaryNav: NavItem[] = allNavItems;

export const otherNav: NavItem[] = [];

export const overflowNav: NavItem[] = [];

export function isNavActive(pathname: string, href: string, item?: NavItem): boolean {
  if (item?.isActive) return item.isActive(pathname);
  if (href === "/app" || href === "/app/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const adminNavSections: NavSection[] = [
  {
    id: "genel",
    label: "Genel",
    items: [{ href: "/app/admin", label: "Genel Bakış", icon: LayoutDashboard }],
  },
  {
    id: "musteriler",
    label: "Müşteriler",
    items: [
      { href: "/app/admin/tenantlar", label: "Tenantlar", icon: Briefcase },
      { href: "/app/admin/siteler", label: "Siteler", icon: MapPinned },
      { href: "/app/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
      { href: "/app/admin/abonelikler", label: "Abonelikler", icon: Wallet },
    ],
  },
  {
    id: "operasyon",
    label: "Operasyon",
    items: [
      { href: "/app/admin/entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
      { href: "/app/admin/iletisim", label: "İletişim", icon: MessageCircle },
    ],
  },
  {
    id: "sistem",
    label: "Sistem",
    items: [
      { href: "/app/admin/sistem", label: "Sistem Durumu", icon: Cog },
      { href: "/app/admin/denetim", label: "Denetim Kayıtları", icon: ClipboardList },
    ],
  },
];
