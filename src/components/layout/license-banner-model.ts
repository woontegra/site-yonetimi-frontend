import type { TenantSubscription } from "@/lib/subscription-api";

export type LicenseBannerKind =
  | "demo_calm"
  | "demo_3"
  | "demo_2"
  | "demo_1"
  | "expired"
  | "suspended"
  | "cancelled"
  | "annual_30"
  | "annual_7"
  | "annual_urgent"
  | null;

export type LicenseBannerTone = "info" | "teal" | "amber" | "danger";

export type LicenseBannerCopy = {
  kind: Exclude<LicenseBannerKind, null>;
  title: string;
  body: string;
  badge: string | null;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string } | null;
  tone: LicenseBannerTone;
  dismissible: boolean;
  progress: { day: number; total: number } | null;
};

export const ANNUAL_LICENSE_HREF = "/app/lisans/yillik";
export const LICENSE_DETAIL_HREF = "/app/ayarlar?tab=license";

const DEMO_TOTAL_DAYS = 7;

/** Backend `remainingDays` / plan / status — FE tarih hesabı yapmaz. */
export function resolveLicenseBannerKind(sub: TenantSubscription | null | undefined): LicenseBannerKind {
  if (!sub) return null;
  if (sub.status === "CANCELLED") return "cancelled";
  if (sub.status === "SUSPENDED") return "suspended";
  if (sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0) return "expired";

  const days = Math.max(0, sub.remainingDays);

  if (sub.plan === "DEMO") {
    if (days <= 1) return "demo_1";
    if (days === 2) return "demo_2";
    if (days === 3) return "demo_3";
    if (days <= 7) return "demo_calm";
    return "demo_calm";
  }

  if (sub.plan === "ANNUAL") {
    if (days <= 3) return "annual_urgent";
    if (days <= 7) return "annual_7";
    if (days <= 30) return "annual_30";
    return null;
  }

  if (sub.readOnly) return "expired";
  return null;
}

function demoProgress(remainingDays: number): { day: number; total: number } | null {
  const days = Math.max(0, Math.min(DEMO_TOTAL_DAYS, remainingDays));
  if (remainingDays < 0 || remainingDays > DEMO_TOTAL_DAYS) return null;
  const day = DEMO_TOTAL_DAYS - days + 1;
  if (day < 1 || day > DEMO_TOTAL_DAYS) return null;
  return { day, total: DEMO_TOTAL_DAYS };
}

export function buildLicenseBannerCopy(
  kind: Exclude<LicenseBannerKind, null>,
  remainingDays: number,
  plan: "DEMO" | "ANNUAL" = "DEMO",
): LicenseBannerCopy {
  const days = Math.max(0, remainingDays);
  const progress = kind.startsWith("demo_") ? demoProgress(days) : null;

  if (kind === "demo_calm") {
    return {
      kind,
      title: "Ücretsiz demo sürümünü kullanıyorsunuz",
      body: "Tüm özellikleri 7 gün boyunca deneyebilirsiniz.",
      badge: `${days} gün kaldı`,
      primaryCta: { label: "Yıllık Lisansı İncele", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "teal",
      dismissible: true,
      progress,
    };
  }

  if (kind === "demo_3") {
    return {
      kind,
      title: "Demo sürenizin bitmesine 3 gün kaldı",
      body: "Kesintisiz kullanmaya devam etmek için yıllık lisansa geçin.",
      badge: "3 gün kaldı",
      primaryCta: { label: "Yıllık Lisansa Geç", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "amber",
      dismissible: false,
      progress,
    };
  }

  if (kind === "demo_2") {
    return {
      kind,
      title: "Demo süreniz yakında sona eriyor",
      body: "Verilerinize kesintisiz erişmek için yıllık lisansınızı şimdi talep edin.",
      badge: "2 gün kaldı",
      primaryCta: { label: "Yıllık Lisansa Geç", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "amber",
      dismissible: false,
      progress,
    };
  }

  if (kind === "demo_1") {
    return {
      kind,
      title: "Demo sürenizin son günü",
      body: "Yarın hesabınız salt okunur moda geçecek.",
      badge: "Son 1 gün",
      primaryCta: { label: "Yıllık Lisansa Geç", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "danger",
      dismissible: false,
      progress,
    };
  }

  if (kind === "expired") {
    return {
      kind,
      title: plan === "ANNUAL" ? "Yıllık lisansınız sona erdi" : "Demo süreniz sona erdi",
      body: "Verilerinizi görüntüleyebilirsiniz; yeni işlem oluşturmak için yıllık lisansa geçin.",
      badge: "Salt okunur",
      primaryCta: { label: "Yıllık Lisansa Geç", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "danger",
      dismissible: false,
      progress: null,
    };
  }

  if (kind === "suspended") {
    return {
      kind,
      title: "Organizasyon erişimi askıya alındı",
      body: "Detaylı bilgi için Woontegra ile iletişime geçin.",
      badge: "Askıda",
      primaryCta: { label: "Destek ile İletişime Geç", href: LICENSE_DETAIL_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "amber",
      dismissible: false,
      progress: null,
    };
  }

  if (kind === "cancelled") {
    return {
      kind,
      title: "Organizasyon lisansı iptal edildi",
      body: "Lisans durumunu ve yenileme seçeneklerini ayarlardan inceleyebilirsiniz.",
      badge: "İptal",
      primaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      secondaryCta: null,
      tone: "danger",
      dismissible: false,
      progress: null,
    };
  }

  if (kind === "annual_30") {
    return {
      kind,
      title: `Yıllık lisansınızın bitmesine ${days} gün kaldı.`,
      body: "Yenileme seçeneklerini inceleyerek kesintisiz kullanıma devam edin.",
      badge: `${days} gün`,
      primaryCta: { label: "Yenileme Bilgileri", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "info",
      dismissible: true,
      progress: null,
    };
  }

  if (kind === "annual_7") {
    return {
      kind,
      title: "Yıllık lisansınız yakında sona erecek",
      body: "Kesintisiz kullanım için yenileme işlemini tamamlayın.",
      badge: `${days} gün kaldı`,
      primaryCta: { label: "Yıllık Lisansı Yenile", href: ANNUAL_LICENSE_HREF },
      secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
      tone: "amber",
      dismissible: false,
      progress: null,
    };
  }

  return {
    kind: "annual_urgent",
    title: `Yıllık lisansınızın bitmesine ${days} gün kaldı`,
    body: "Kesintisiz kullanım için yenileme talebinizi şimdi oluşturun.",
    badge: days <= 1 ? "Son 1 gün" : `${days} gün kaldı`,
    primaryCta: { label: "Yıllık Lisansı Yenile", href: ANNUAL_LICENSE_HREF },
    secondaryCta: { label: "Lisans Detayı", href: LICENSE_DETAIL_HREF },
    tone: "amber",
    dismissible: false,
    progress: null,
  };
}

/** localStorage anahtarı — yalnız UI tercihi; lisans gerçeği değil. */
export function licenseBannerDismissKey(tenantId: string, kind: string, remainingDays: number): string {
  const bucket =
    kind === "demo_calm"
      ? remainingDays >= 4 && remainingDays <= 7
        ? `demo_${remainingDays}`
        : "demo_calm"
      : kind === "annual_30"
        ? `annual_${remainingDays}`
        : kind;
  const day = new Date().toISOString().slice(0, 10);
  return `sy:license-banner-dismiss:${tenantId}:${bucket}:${day}`;
}

export function isLicenseBannerDismissed(tenantId: string, kind: string, remainingDays: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(licenseBannerDismissKey(tenantId, kind, remainingDays)) === "1";
  } catch {
    return false;
  }
}

export function dismissLicenseBanner(tenantId: string, kind: string, remainingDays: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(licenseBannerDismissKey(tenantId, kind, remainingDays), "1");
  } catch {
    // ignore quota / private mode
  }
}
