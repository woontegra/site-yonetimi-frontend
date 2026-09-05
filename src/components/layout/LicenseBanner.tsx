"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import {
  getMySubscriptionCached,
  licenseFromResponse,
  subscribeMyLicenseCache,
  type LicenseAccess,
  type TenantSubscription,
} from "@/lib/subscription-api";
import { cn } from "@/lib/cn";

const LICENSE_HREF = "/app/ayarlar?tab=license";

type BannerKind =
  | "expired"
  | "suspended"
  | "cancelled"
  | "d1"
  | "d3"
  | "d7"
  | "d30"
  | "readonly"
  | null;

function resolveBanner(sub: TenantSubscription | null | undefined): BannerKind {
  if (!sub) return null;
  if (sub.status === "CANCELLED") return "cancelled";
  if (sub.status === "SUSPENDED") return "suspended";
  if (sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0) return "expired";
  const days = Math.max(0, sub.remainingDays);
  if (days <= 1) return "d1";
  if (days <= 3) return "d3";
  if (days <= 7) return "d7";
  if (days <= 30) return "d30";
  if (sub.readOnly) return "readonly";
  return null;
}

function bannerCopy(
  kind: Exclude<BannerKind, null>,
  remainingDays: number,
  soft: boolean,
): { title: string; body: string; tone: "info" | "warning" | "danger" } {
  const days = Math.max(0, remainingDays);
  if (soft) {
    if (kind === "expired") {
      return {
        title: "Organizasyon lisansı dolmuş",
        body: "Bağlı organizasyonun lisansı süresi dolmuş. Platform erişiminiz etkilenmez.",
        tone: "info",
      };
    }
    if (kind === "suspended") {
      return {
        title: "Organizasyon lisansı askıda",
        body: "Bağlı organizasyon aboneliği askıya alınmış. Platform erişiminiz etkilenmez.",
        tone: "info",
      };
    }
    if (kind === "cancelled") {
      return {
        title: "Organizasyon lisansı iptal",
        body: "Bağlı organizasyon aboneliği iptal edilmiş. Platform erişiminiz etkilenmez.",
        tone: "info",
      };
    }
    return {
      title: "Organizasyon lisansı yaklaşıyor",
      body: `Bağlı organizasyon lisansının bitmesine ${days} gün kaldı.`,
      tone: "info",
    };
  }

  if (kind === "expired") {
    return {
      title: "Lisans süresi doldu",
      body: "Organizasyon salt okunur. Yenilemek için lisans ayarlarına gidin.",
      tone: "danger",
    };
  }
  if (kind === "suspended") {
    return {
      title: "Lisans askıda",
      body: "Organizasyon erişimi kısıtlı. Destek veya lisans ayarlarından kontrol edin.",
      tone: "warning",
    };
  }
  if (kind === "cancelled") {
    return {
      title: "Lisans iptal edildi",
      body: "Organizasyon salt okunur. Yenilemek için lisans ayarlarına gidin.",
      tone: "danger",
    };
  }
  if (kind === "readonly") {
    return {
      title: "Salt okunur mod",
      body: "Organizasyon düzenleme işlemleri kısıtlı.",
      tone: "warning",
    };
  }
  if (kind === "d1") {
    return {
      title: "Lisans yarın bitiyor",
      body: "Organizasyon lisansınızın bitmesine 1 gün kaldı.",
      tone: "danger",
    };
  }
  if (kind === "d3") {
    return {
      title: "Lisans 3 gün içinde bitiyor",
      body: `Bitmesine ${days} gün kaldı.`,
      tone: "warning",
    };
  }
  if (kind === "d7") {
    return {
      title: "Lisans 1 hafta içinde bitiyor",
      body: `Bitmesine ${days} gün kaldı.`,
      tone: "warning",
    };
  }
  return {
    title: "Lisans 30 gün içinde bitiyor",
    body: `Bitmesine ${days} gün kaldı.`,
    tone: "info",
  };
}

const toneClass: Record<"info" | "warning" | "danger", string> = {
  info: "border-info/20 bg-info-subtle/50",
  warning: "border-warning/25 bg-warning-subtle/60",
  danger: "border-danger/25 bg-danger-subtle/40",
};

export function LicenseBanner() {
  const pathname = usePathname();
  const { ready, user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const [access, setAccess] = useState<LicenseAccess | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!ready || !auth) return;
    try {
      const result = await getMySubscriptionCached(auth, { force: true });
      setAccess(result.access);
      setSubscription(licenseFromResponse(result));
    } catch {
      setAccess(null);
      setSubscription(null);
    } finally {
      setLoaded(true);
    }
  }, [ready, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auth?.tenantId) return;
    return subscribeMyLicenseCache((tenantId) => {
      if (tenantId && tenantId !== auth.tenantId) return;
      void load();
    });
  }, [auth?.tenantId, load]);

  if (!loaded || pathname.startsWith("/app/admin")) return null;

  const soft = Boolean(access?.exempt || access?.isPlatformAdmin || user.isPlatformAdmin);
  const kind = resolveBanner(subscription);
  if (!kind) return null;

  const copy = bannerCopy(kind, subscription?.remainingDays ?? 0, soft);

  return (
    <div className={cn("border-b px-4 py-1.5 lg:px-6 xl:px-8", toneClass[copy.tone])}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-[12px] leading-[1.35] text-ink">
          <span className="font-medium">{copy.title}</span>
          <span className="text-muted"> · {copy.body}</span>
        </p>
        <Link
          href={LICENSE_HREF}
          className="shrink-0 text-[12px] font-medium text-accent hover:underline"
        >
          Lisans ayarları
        </Link>
      </div>
    </div>
  );
}
