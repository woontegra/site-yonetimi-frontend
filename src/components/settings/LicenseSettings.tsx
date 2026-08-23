"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Hourglass, IdCard, Infinity as InfinityIcon, Package, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import {
  getMySubscription,
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type LicenseAccess,
  type TenantSubscription,
} from "@/lib/subscription-api";
import { subscriptionTone } from "@/components/admin/labels";

function remainingTone(days: number, status: TenantSubscription["status"]): "ok" | "watch" | "urgent" | "expired" {
  if (status === "EXPIRED" || status === "CANCELLED" || days < 0) return "expired";
  if (status === "SUSPENDED") return "watch";
  if (days <= 7) return "urgent";
  if (days <= 30) return "watch";
  return "ok";
}

function remainingMessage(sub: TenantSubscription): string {
  if (sub.status === "EXPIRED" || sub.remainingDays < 0) {
    return "Lisans süreniz dolmuş. Yenilemek için aşağıdaki kanalı kullanın.";
  }
  if (sub.status === "CANCELLED") {
    return "Aboneliğiniz iptal edilmiş.";
  }
  if (sub.status === "SUSPENDED") {
    return "Aboneliğiniz askıya alınmış. Kullanım kısıtlı olabilir.";
  }
  const days = Math.max(0, sub.remainingDays);
  if (sub.status === "TRIAL") {
    return `Deneme sürenizin bitmesine ${days} gün kaldı.`;
  }
  return `Lisansınızın bitmesine ${days} gün kaldı.`;
}

function organizationMessage(sub: TenantSubscription): string {
  if (sub.status === "EXPIRED" || sub.remainingDays < 0) {
    return "Bu organizasyonun müşteri aboneliğinin süresi dolmuş. Platform yöneticisi erişiminiz süresiz devam eder.";
  }
  if (sub.status === "CANCELLED") {
    return "Organizasyon aboneliği iptal edilmiş. Platform yöneticisi erişiminiz süresiz devam eder.";
  }
  if (sub.status === "SUSPENDED") {
    return "Organizasyon aboneliği askıya alınmış. Platform yöneticisi erişiminiz süresiz devam eder.";
  }
  const days = Math.max(0, sub.remainingDays);
  if (sub.status === "TRIAL") {
    return `Organizasyon deneme süresinin bitmesine ${days} gün kaldı. Bu süre sizin yönetim erişiminizi etkilemez.`;
  }
  return `Organizasyon aboneliğinin bitmesine ${days} gün kaldı. Bu süre sizin yönetim erişiminizi etkilemez.`;
}

function buildRenewalHref(tenantName?: string): { href: string; label: string } | null {
  const url = process.env.NEXT_PUBLIC_LICENSE_RENEWAL_URL?.trim();
  if (url) return { href: url, label: "Lisansı Yenile" };

  const whatsapp = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "") ?? "";
  const message = tenantName
    ? `Merhaba, ${tenantName} hesabı için site yönetim uygulamasındaki lisansımı yenilemek istiyorum.`
    : "Merhaba, site yönetim uygulamasındaki lisansımı yenilemek istiyorum.";
  if (whatsapp) {
    return {
      href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
      label: "Lisansı Yenile",
    };
  }

  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (email) {
    const subject = "Lisans yenileme";
    return {
      href: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      label: "Lisansı Yenile",
    };
  }

  return null;
}

function OrganizationSubscriptionCards({
  subscription,
  forPlatformAdmin,
}: {
  subscription: TenantSubscription;
  forPlatformAdmin: boolean;
}) {
  const tone = remainingTone(subscription.remainingDays, subscription.status);
  const remainingValue =
    subscription.remainingDays < 0
      ? "Süresi doldu"
      : `${Math.max(0, subscription.remainingDays)} gün`;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Paket" value={PLAN_LABELS[subscription.plan]} />
        <StatCard icon={Shield} label="Durum" value={SUBSCRIPTION_STATUS_LABELS[subscription.status]} />
        <StatCard
          icon={CalendarClock}
          label="Bitiş tarihi"
          value={formatDateTr(subscription.endsAt)}
          hint={`Başlangıç ${formatDateTr(subscription.startsAt)}`}
        />
        <StatCard
          icon={Hourglass}
          label="Kalan gün"
          value={remainingValue}
          hint={
            subscription.trialEndsAt && subscription.status === "TRIAL"
              ? `Deneme bitişi ${formatDateTr(subscription.trialEndsAt)}`
              : undefined
          }
        />
      </div>

      <SurfaceCard
        className={
          tone === "expired"
            ? "border-danger/30 bg-danger-subtle/40"
            : tone === "urgent"
              ? "border-warning/40 bg-warning-subtle/50"
              : tone === "watch"
                ? "border-warning/25 bg-warning-subtle/30"
                : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-muted">
            {forPlatformAdmin ? "Organizasyon özeti" : "Lisans özeti"}
          </p>
          <StatusBadge
            label={SUBSCRIPTION_STATUS_LABELS[subscription.status]}
            tone={subscriptionTone(subscription.status)}
          />
        </div>
        <p className="mt-2 break-words text-[1.375rem] font-medium tracking-tight text-ink">{remainingValue}</p>
        <p className="mt-1.5 text-sm text-muted">
          {forPlatformAdmin ? organizationMessage(subscription) : remainingMessage(subscription)}
        </p>
      </SurfaceCard>
    </>
  );
}

export function LicenseSettings() {
  const { user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const [access, setAccess] = useState<LicenseAccess | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getMySubscription(auth);
      setAccess(result.access);
      setSubscription(result.subscription);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lisans bilgileri yüklenemedi.");
      setAccess(null);
      setSubscription(undefined);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const renewal = useMemo(() => buildRenewalHref(user.tenantName), [user.tenantName]);
  const isPlatformAdmin = Boolean(access?.isPlatformAdmin);

  return (
    <div className="space-y-5">
      {loading ? <p className="text-sm text-muted">Lisans bilgileri yükleniyor…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!loading && !error && isPlatformAdmin ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Shield} label="Hesap türü" value="Platform Yöneticisi" />
            <StatCard icon={InfinityIcon} label="Yönetim erişimi" value="Süresiz" />
            <StatCard icon={IdCard} label="Lisans durumu" value="Muaf" />
          </div>
          <p className="text-sm text-muted">
            Platform yöneticisi erişimi abonelik süresinden etkilenmez.
          </p>

          <SectionCard
            title="Organizasyon aboneliği"
            description="Bu kayıt bağlı tenant’ın müşteri lisansıdır; sizin yönetim erişiminiz değildir."
          >
            {subscription ? (
              <div className="space-y-4">
                <OrganizationSubscriptionCards subscription={subscription} forPlatformAdmin />
              </div>
            ) : (
              <EmptyState
                icon={IdCard}
                title="Bu organizasyon için müşteri aboneliği tanımlanmamış"
                description="Platform yöneticisi erişiminiz süresiz devam eder."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Link href="/app/admin/tenantlar">
                      <Button type="button" variant="secondary">
                        Tenantlara Git
                      </Button>
                    </Link>
                    <Link href="/app/admin/abonelikler">
                      <Button type="button" variant="secondary">
                        Aboneliklere Git
                      </Button>
                    </Link>
                  </div>
                }
                className="border-0 bg-transparent px-0 py-8"
              />
            )}
          </SectionCard>
        </>
      ) : null}

      {!loading && !error && !isPlatformAdmin ? (
        <>
          <p className="text-sm text-muted">
            Bu abonelik hesabınıza bağlı tüm yetkili kullanım için geçerlidir.
          </p>

          {subscription === null ? (
            <EmptyState
              icon={IdCard}
              title="Bu organizasyon için henüz lisans tanımlanmamış"
              description="Satış veya destek ekibiniz bir abonelik tanımladığında paket, durum ve süre bilgileri burada görünür."
            />
          ) : null}

          {subscription ? (
            <OrganizationSubscriptionCards subscription={subscription} forPlatformAdmin={false} />
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {renewal ? (
              <a href={renewal.href} target="_blank" rel="noreferrer">
                <Button type="button">
                  <ExternalLink className="size-4" aria-hidden />
                  {renewal.label}
                </Button>
              </a>
            ) : (
              <Button type="button" disabled>
                Lisansı Yenile
              </Button>
            )}
            {renewal ? (
              <p className="text-caption text-muted">
                Ödeme bu ekranda alınmaz; satış veya destek kanalına yönlendirilirsiniz.
              </p>
            ) : (
              <p className="text-caption text-muted">Lisans yenileme iletişim bilgisi tanımlanmamış.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
