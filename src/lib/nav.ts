import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Cog,
  DoorOpen,
  FileBarChart2,
  Landmark,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  MessageSquare,
  Percent,
  Plug,
  Receipt,
  Shield,
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
  permission?: string | string[];
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
    items: [{ href: "/app", label: "Genel Bakış", icon: LayoutDashboard, permission: "dashboard.view" }],
  },
  {
    id: "yapi",
    label: "Yapı ve Sakinler",
    items: [
      { href: "/app/siteler", label: "Siteler", icon: MapPinned, permission: "sites.view" },
      { href: "/app/binalar", label: "Binalar", icon: Building2, permission: "buildings.view" },
      { href: "/app/daireler", label: "Daireler", icon: DoorOpen, permission: "apartments.view" },
      { href: "/app/kisiler", label: "Kişiler", icon: Users, permission: "persons.view" },
    ],
  },
  {
    id: "finans",
    label: "Finans",
    items: [
      { href: "/app/muhasebe/aidatlar", label: "Aidatlar", icon: Receipt, permission: "dues.view" },
      {
        href: "/app/muhasebe/borclar",
        label: "Borçlar",
        icon: Wallet,
        permission: "debts.view",
        isActive: (pathname) => pathname.startsWith("/app/muhasebe/borclar"),
      },
      { href: "/app/muhasebe/tahsilatlar", label: "Tahsilatlar", icon: Banknote, permission: "payments.view" },
      { href: "/app/muhasebe/giderler", label: "Giderler", icon: TrendingDown, permission: "expenses.view" },
      { href: "/app/muhasebe/bankalar", label: "Banka", icon: Landmark, permission: "banks.view" },
      {
        href: "/app/muhasebe/faiz-kararlari",
        label: "Faiz Kararları",
        icon: Percent,
        permission: ["interest.view", "interest.manage"],
      },
      {
        href: "/app/muhasebe/raporlar",
        label: "Raporlar",
        icon: FileBarChart2,
        permission: "financeReports.view",
      },
    ],
  },
  {
    id: "operasyon",
    label: "Operasyon",
    items: [
      { href: "/app/demirbaslar", label: "Demirbaşlar", icon: Wrench, permission: "assets.view" },
      { href: "/app/misafirler", label: "Misafirler", icon: UserRound, badgeKey: "visitors", permission: "visitors.view" },
      { href: "/app/calisanlar", label: "Çalışanlar", icon: Briefcase, permission: "employees.view" },
      { href: "/app/tedarikciler", label: "Tedarikçiler", icon: Truck, permission: "suppliers.view" },
    ],
  },
  {
    id: "iletisim",
    label: "İletişim",
    items: [
      { href: "/app/duyurular", label: "Duyurular", icon: Bell, permission: "announcements.view" },
      { href: "/app/bilgi-oneri", label: "Bilgi ve Öneriler", icon: MessageSquare, permission: "feedback.view" },
      { href: "/app/whatsapp-sablonlari", label: "WhatsApp Şablonları", icon: MessageCircle, permission: "whatsappTemplates.manage" },
    ],
  },
  {
    id: "ayarlar",
    label: "Ayarlar",
    items: [
      { href: "/app/entegrasyonlar", label: "Entegrasyonlar", icon: Plug, permission: "integrations.view" },
      { href: "/app/ayarlar", label: "Site Ayarları", icon: Cog, permission: "siteSettings.manage" },
      {
        href: "/app/ayarlar/kullanicilar",
        label: "Kullanıcılar ve Yetkiler",
        icon: Users,
        permission: ["users.view", "users.invite", "users.manage"],
      },
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
    items: [
      { href: "/app/admin", label: "Admin Paneli", icon: Shield },
      { href: "/app/admin/kontrol-merkezi", label: "Kontrol Merkezi", icon: LayoutDashboard },
    ],
  },
  {
    id: "musteriler",
    label: "Müşteriler",
    items: [
      { href: "/app/admin/tenantlar", label: "Organizasyonlar", icon: Briefcase },
      { href: "/app/admin/siteler", label: "Siteler", icon: MapPinned },
      { href: "/app/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
      { href: "/app/admin/abonelikler", label: "Lisanslar", icon: Wallet },
      { href: "/app/admin/istatistikler", label: "İstatistikler", icon: FileBarChart2 },
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
      { href: "/app/admin/sistem", label: "Sistem Sağlığı", icon: Cog },
      { href: "/app/admin/denetim", label: "Denetim Kayıtları", icon: ClipboardList },
    ],
  },
];

/** Normal sidebar’da yalnız platform admin’e render edilen bölüm. */
export const platformNavSection: NavSection = {
  id: "platform",
  label: "Platform Yönetimi",
  items: [{ href: "/app/admin", label: "Admin Paneli", icon: Shield }],
};
