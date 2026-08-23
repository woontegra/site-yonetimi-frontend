import type { AdminSubscription } from "@/lib/admin-api";
import type { BadgeTone } from "@/components/ui/Badge";

export const ROLE_LABELS: Record<string, string> = {
  SITE_YONETICISI: "Site yöneticisi",
  YONETIM_PERSONELI: "Yönetim personeli",
  MUHASEBE_PERSONELI: "Muhasebe personeli",
  SINIRLI_YETKILI: "Sınırlı yetkili",
};

export const PLAN_LABELS: Record<string, string> = {
  DEMO: "Demo",
  STANDARD: "Standart",
  PROFESSIONAL: "Profesyonel",
};

export const SUB_STATUS_LABELS: Record<string, string> = {
  TRIAL: "Deneme",
  ACTIVE: "Aktif",
  EXPIRED: "Süresi doldu",
  SUSPENDED: "Askıda",
  CANCELLED: "İptal",
};

export const SETUP_LABELS: Record<string, string> = {
  NOT_STARTED: "Başlamadı",
  IN_PROGRESS: "Devam ediyor",
  COMPLETED: "Tamamlandı",
  SKIPPED: "Atlandı",
};

export const CONNECTION_LABELS: Record<string, string> = {
  CONNECTED: "Bağlı",
  DISCONNECTED: "Bağlı değil",
  ERROR: "Hata",
};

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  SENT: "Gönderildi",
  DELIVERED: "Teslim edildi",
  READ: "Okundu",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "tenant.activate": "Tenant aktifleştirildi",
  "tenant.deactivate": "Tenant pasife alındı",
  "tenant.create": "Tenant oluşturuldu",
  "subscription.extend": "Abonelik uzatıldı",
  "subscription.trial": "Deneme süresi verildi",
  "subscription.plan_change": "Plan değiştirildi",
  "subscription.suspend": "Abonelik askıya alındı",
  "subscription.reactivate": "Abonelik yeniden aktif",
  "user.activate": "Kullanıcı aktifleştirildi",
  "user.deactivate": "Kullanıcı pasife alındı",
  "admin_note.create": "Admin notu eklendi",
  "email.integration.create": "E-posta entegrasyonu oluşturuldu",
  "email.integration.update": "E-posta entegrasyonu güncellendi",
  "email.integration.toggle": "E-posta entegrasyonu aktif/pasif değiştirildi",
  "email.connection.test": "SMTP bağlantısı test edildi",
  "email.test.send": "Test e-postası gönderildi",
  "email.invite.resend": "Tenant daveti yeniden gönderildi",
};

export const EMAIL_DELIVERY_TYPE_LABELS: Record<string, string> = {
  TENANT_WELCOME_ACTIVATION: "Hesap aktivasyonu",
  PLATFORM_NEW_TENANT_NOTIFICATION: "Yeni tenant bildirimi",
  SMTP_TEST: "SMTP test",
};

export const EMAIL_DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Bekliyor",
  SENT: "Gönderildi",
  FAILED: "Gönderilemedi",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

export function subscriptionTone(status: string | undefined): BadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "TRIAL") return "info";
  if (status === "EXPIRED") return "neutral";
  if (status === "SUSPENDED") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export function remainingLabel(sub: AdminSubscription | null | undefined): string | null {
  if (!sub) return null;
  if (sub.remainingDays < 0) return "Süresi doldu";
  if (sub.remainingDays <= 7) return `${sub.remainingDays} gün kaldı`;
  if (sub.remainingDays <= 30) return `${sub.remainingDays} gün kaldı`;
  return null;
}
