import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  Cog,
  MessageCircle,
  Plug,
  PlusCircle,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

export type AdminToolCard = {
  href?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "rose" | "slate";
  ready: boolean;
};

export const ADMIN_TOOL_CARDS: AdminToolCard[] = [
  {
    href: "/app/admin/kontrol-merkezi",
    title: "Kontrol Merkezi",
    description: "Platformun genel durumunu ve kritik uyarıları görüntüleyin.",
    icon: Activity,
    tone: "blue",
    ready: true,
  },
  {
    href: "/app/admin/tenantlar",
    title: "Organizasyon Yönetimi",
    description: "Müşteri hesaplarını, sitelerini ve kullanım durumlarını yönetin.",
    icon: Briefcase,
    tone: "green",
    ready: true,
  },
  {
    href: "/app/admin/kullanicilar",
    title: "Kullanıcı Yönetimi",
    description: "Kullanıcı hesaplarını görüntüleyin, filtreleyin ve yönetin.",
    icon: Users,
    tone: "blue",
    ready: true,
  },
  {
    href: "/app/admin/tenantlar?yeni=1",
    title: "Yeni Organizasyon",
    description: "Yeni müşteri hesabı, ilk kullanıcı ve deneme lisansı oluşturun.",
    icon: PlusCircle,
    tone: "green",
    ready: true,
  },
  {
    href: "/app/admin/abonelikler",
    title: "Lisans Yönetimi",
    description: "Planları, lisans sürelerini ve lisans geçmişini yönetin.",
    icon: Wallet,
    tone: "amber",
    ready: true,
  },
  {
    href: "/app/admin/istatistikler",
    title: "Tenant İstatistikleri",
    description: "Müşteri kullanımını ve aktiflik durumunu inceleyin.",
    icon: BarChart3,
    tone: "slate",
    ready: true,
  },
  {
    href: "/app/admin/sistem",
    title: "Sistem Sağlığı",
    description: "Servis, veritabanı ve entegrasyon durumlarını kontrol edin.",
    icon: Cog,
    tone: "rose",
    ready: true,
  },
  {
    href: "/app/admin/denetim",
    title: "Admin Denetim Kayıtları",
    description: "Platform yöneticilerinin gerçekleştirdiği işlemleri inceleyin.",
    icon: ClipboardList,
    tone: "slate",
    ready: true,
  },
  {
    href: "/app/admin/iletisim",
    title: "E-posta ve Mesaj Geçmişi",
    description: "Gönderim sonuçlarını ve başarısız iletileri inceleyin.",
    icon: MessageCircle,
    tone: "green",
    ready: true,
  },
  {
    title: "Sistem Logları",
    description: "Uygulama log depolama altyapısı henüz yok; güvenli görünüm hazırlanıyor.",
    icon: Shield,
    tone: "amber",
    ready: false,
  },
  {
    href: "/app/admin/entegrasyonlar",
    title: "Platform Ayarları",
    description: "Platform SMTP ve entegrasyon ayarlarını güvenli biçimde yönetin.",
    icon: Plug,
    tone: "blue",
    ready: true,
  },
  {
    href: "/app/admin/siteler",
    title: "Site Yönetimi",
    description: "Platformdaki siteleri operasyonel olarak görün.",
    icon: Building2,
    tone: "slate",
    ready: true,
  },
];
