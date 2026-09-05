"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, IdCard } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  SettingsInfoGrid,
  settingsUi,
} from "@/components/settings/settings-ui";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";
import {
  getMySubscription,
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type LicenseAccess,
  type TenantSubscription,
} from "@/lib/subscription-api";
import { subscriptionTone } from "@/components/admin/labels";
import { cn } from "@/lib/cn";

function remainingTone(days: number, status: TenantSubscription["status"]): "ok" | "watch" | "urgent" | "expired" {
  if (status === "EXPIRED" || status === "CANCELLED" || days < 0) return "expired";
  if (status === "SUSPENDED") return "watch";
  if (days <= 7) return "urgent";
  if (days <= 30) return "watch";
  return "ok";
}

function remainingMessage(sub: TenantSubscription): string {
  if (sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0) {
    return "Lisans süreniz dolmuş. Yenilemek için aşağıdaki kanalı kullanın.";
  }
  if (sub.status === "CANCELLED") return "Aboneliğiniz iptal edilmiş.";
  if (sub.status === "SUSPENDED") {
    return "Aboneliğiniz askıya alınmış. Kullanım kısıtlı olabilir.";
  }
  if (sub.readOnly) {
    return "Organizasyon salt okunur modda. Düzenleme işlemleri kısıtlıdır.";
  }
  const days = Math.max(0, sub.remainingDays);
  if (sub.plan === "DEMO") return `Demo sürenizin bitmesine ${days} gün kaldı.`;
  return `Yıllık lisansınızın bitmesine ${days} gün kaldı.`;
}

function organizationMessage(sub: TenantSubscription): string {
  if (sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0) {
    return "Bu organizasyonun müşteri aboneliğinin süresi dolmuş. Platform yöneticisi erişiminiz süresiz devam eder.";
  }
  if (sub.status === "CANCELLED") {
    return "Organizasyon aboneliği iptal edilmiş. Platform yöneticisi erişiminiz süresiz devam eder.";
  }
  if (sub.status === "SUSPENDED") {
    return "Organizasyon aboneliği askıya alınmış. Platform yöneticisi erişiminiz süresiz devam eder.";
  }
  const days = Math.max(0, sub.remainingDays);
  if (sub.plan === "DEMO") {
    return `Organizasyon demo süresinin bitmesine ${days} gün kaldı. Bu süre sizin yönetim erişiminizi etkilemez.`;
  }
  return `Organizasyon yıllık lisansının bitmesine ${days} gün kaldı. Bu süre sizin yönetim erişiminizi etkilemez.`;
}

function buildRenewalHref(
  tenantName?: string,
  support?: { email?: string | null; renewalUrl?: string | null } | null,
): { href: string; label: string } | null {
  const url = support?.renewalUrl?.trim() || process.env.NEXT_PUBLIC_LICENSE_RENEWAL_URL?.trim();
  if (url) return { href: url, label: "Lisansı Yenile" };

  const whatsapp = (process.env.NEXT_PUBLIC_SALES_WHATSAPP ?? "").replace(/\D/g, "");
  const message = tenantName
    ? `Merhaba, ${tenantName} hesabı için site yönetim uygulamasındaki lisansımı yenilemek istiyorum.`
    : "Merhaba, site yönetim uygulamasındaki lisansımı yenilemek istiyorum.";
  if (whatsapp) {
    return {
      href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
      label: "Lisansı Yenile",
    };
  }

  const email = (support?.email ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL)?.trim();
  if (email) {
    const subject = "Lisans yenileme";
    return {
      href: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      label: "Lisansı Yenile",
    };
  }

  return null;
}

function OrganizationSubscriptionSummary({
  subscription,
  forPlatformAdmin,
  orgName,
  licenseScope,
  supportEmail,
}: {
  subscription: TenantSubscription;
  forPlatformAdmin: boolean;
  orgName?: string;
  licenseScope?: string | null;
  supportEmail?: string | null;
}) {
  const tone = remainingTone(subscription.remainingDays, subscription.status);
  const remainingValue =
    subscription.isExpired || subscription.remainingDays < 0
      ? "Süresi doldu"
      : `${Math.max(0, subscription.remainingDays)} gün`;
  const hasPrice =
    subscription.plan === "ANNUAL" &&
    (subscription.netPrice != null || subscription.grossPrice != null);

  return (
    <div className="space-y-3">
      <SettingsInfoGrid
        columns={4}
        items={[
          { label: "Organizasyon", value: orgName || "—" },
          { label: "Paket", value: PLAN_LABELS[subscription.plan] },
          { label: "Durum", value: SUBSCRIPTION_STATUS_LABELS[subscription.status] },
          {
            label: "Bitiş tarihi",
            value: formatDateTr(subscription.endsAt),
            hint: <span className={settingsUi.help}>Başlangıç {formatDateTr(subscription.startsAt)}</span>,
          },
          {
            label: "Kalan gün",
            value: remainingValue,
          },
          {
            label: "Erişim",
            value: subscription.readOnly ? "Salt okunur" : "Tam erişim",
          },
          ...(hasPrice
            ? [
                {
                  label: "Net tutar",
                  value: formatMoney(subscription.netPrice),
                },
                {
                  label: "KDV dahil",
                  value: formatMoney(subscription.grossPrice),
                  hint:
                    subscription.vatRate != null ? (
                      <span className={settingsUi.help}>
                        KDV %{subscription.vatRate}
                        {subscription.vatAmount != null ? ` · ${formatMoney(subscription.vatAmount)}` : ""}
                      </span>
                    ) : undefined,
                },
              ]
            : []),
        ]}
      />

      <p className={settingsUi.help}>
        {licenseScope ||
          "Bu lisans organizasyonunuzdaki bütün kullanıcı ve siteleri kapsar."}
      </p>

      <div
        className={cn(
          "rounded-lg border px-3 py-2.5",
          tone === "expired"
            ? "border-danger/30 bg-danger-subtle/30"
            : tone === "urgent"
              ? "border-warning/40 bg-warning-subtle/40"
              : tone === "watch"
                ? "border-warning/25 bg-warning-subtle/20"
                : "border-line bg-canvas/40",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className={settingsUi.help}>
            {forPlatformAdmin ? "Organizasyon özeti" : "Lisans özeti"}
          </p>
          <StatusBadge
            label={SUBSCRIPTION_STATUS_LABELS[subscription.status]}
            tone={subscriptionTone(subscription.status, subscription.plan)}
          />
        </div>
        <p className="mt-1 text-[14px] font-semibold leading-[1.25] text-ink">{remainingValue}</p>
        <p className={`${settingsUi.help} mt-1`}>
          {forPlatformAdmin ? organizationMessage(subscription) : remainingMessage(subscription)}
        </p>
      </div>

      {supportEmail ? (
        <div className="rounded-lg border border-line px-3 py-2.5">
          <p className={settingsUi.help}>Destek</p>
          <p className="mt-0.5 text-[13px] text-ink">{supportEmail}</p>
        </div>
      ) : null}
    </div>
  );
}

export function LicenseSettings() {
  const { user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const [access, setAccess] = useState<LicenseAccess | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null | undefined>(undefined);
  const [orgMeta, setOrgMeta] = useState<{
    name?: string;
    licenseScope?: string;
    support?: { email: string | null; renewalUrl: string | null };
  }>({});
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
      setOrgMeta({
        name: result.organization?.name,
        licenseScope: result.licenseScope,
        support: result.support,
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Lisans bilgileri yüklenemedi.";
      setError(
        message === "Aktif site seçilmedi."
          ? "Lisans bilgileri yüklenemedi. Organizasyon oturumunu kontrol edin."
          : message,
      );
      setAccess(null);
      setSubscription(undefined);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const orgName = orgMeta.name || user.tenantName;
  const renewal = useMemo(
    () => buildRenewalHref(orgName, orgMeta.support ?? null),
    [orgName, orgMeta.support],
  );
  const isPlatformAdmin = Boolean(access?.isPlatformAdmin);

  return (
    <div className="space-y-3">
      {loading ? <p className={settingsUi.help}>Lisans bilgileri yükleniyor…</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      {!loading && !error && isPlatformAdmin ? (
        <>
          <div
            className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[12px] leading-[1.4] text-ink"
            role="status"
          >
            Bu hesap platform yöneticisi erişimiyle kullanılıyor. Aşağıdaki abonelik kaydı bağlı
            organizasyonun müşteri lisansıdır; sizin yönetim erişiminiz abonelik süresinden etkilenmez.
          </div>
          <SettingsInfoGrid
            columns={4}
            items={[
              { label: "Hesap türü", value: "Platform Yöneticisi" },
              { label: "Yönetim erişimi", value: "Süresiz" },
              { label: "Lisans durumu", value: "Muaf" },
            ]}
          />

          <div className="border-t border-line/70 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className={settingsUi.sectionTitle}>Organizasyon aboneliği</h3>
                <p className={settingsUi.help}>
                  Bu kayıt bağlı tenant’ın müşteri lisansıdır; sizin yönetim erişiminiz değildir.
                </p>
              </div>
              <Link href="/app/admin/abonelikler" className={settingsUi.btnSm}>
                Lisans yönetimine git
              </Link>
            </div>
            <div className="mt-2.5">
              {subscription ? (
                <OrganizationSubscriptionSummary
                  subscription={subscription}
                  forPlatformAdmin
                  orgName={orgName}
                  licenseScope={orgMeta.licenseScope}
                  supportEmail={orgMeta.support?.email}
                />
              ) : (
                <EmptyState
                  icon={IdCard}
                  title="Bu organizasyon için müşteri aboneliği tanımlanmamış"
                  description="Platform yöneticisi erişiminiz süresiz devam eder."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Link href="/app/admin/tenantlar" className={settingsUi.btnSm}>
                        Tenantlara Git
                      </Link>
                      <Link href="/app/admin/abonelikler" className={settingsUi.btnSm}>
                        Aboneliklere Git
                      </Link>
                    </div>
                  }
                  compact
                  className="border-0 bg-transparent px-0 py-3"
                />
              )}
            </div>
          </div>
        </>
      ) : null}

      {!loading && !error && !isPlatformAdmin ? (
        <>
          {subscription === null ? (
            <EmptyState
              icon={IdCard}
              title="Bu organizasyon için henüz lisans tanımlanmamış"
              description="Satış veya destek ekibiniz bir abonelik tanımladığında paket, durum ve süre bilgileri burada görünür."
              compact
              className="border-0 bg-transparent px-0 py-3"
            />
          ) : null}

          {subscription ? (
            <OrganizationSubscriptionSummary
              subscription={subscription}
              forPlatformAdmin={false}
              orgName={orgName}
              licenseScope={orgMeta.licenseScope}
              supportEmail={orgMeta.support?.email}
            />
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {renewal ? (
              <a href={renewal.href} target="_blank" rel="noreferrer" className={settingsUi.btnPrimary}>
                <ExternalLink className="size-3.5" aria-hidden />
                {renewal.label}
              </a>
            ) : (
              <button type="button" className={settingsUi.btnPrimary} disabled>
                Lisansı Yenile
              </button>
            )}
            <p className={settingsUi.help}>
              {renewal
                ? "Ödeme bu ekranda alınmaz; satış veya destek kanalına yönlendirilirsiniz."
                : "Lisans yenileme iletişim bilgisi tanımlanmamış."}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
