"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  IdCard,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SettingsInfoGrid, settingsUi } from "@/components/settings/settings-ui";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";
import {
  getMySubscriptionCached,
  invalidateMyLicenseCache,
  licenseFromResponse,
  listMySubscriptionHistory,
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  subscribeMyLicenseCache,
  type LicenseAccess,
  type MyLicenseResponse,
  type TenantLicenseHistoryItem,
  type TenantSubscription,
} from "@/lib/subscription-api";
import { cn } from "@/lib/cn";

function statusDisplayLabel(sub: TenantSubscription): string {
  if (sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0) return "Süresi doldu";
  if (sub.status === "SUSPENDED") return "Askıya alındı";
  if (sub.status === "CANCELLED") return "İptal edildi";
  if (sub.remainingDays <= 7) return "Süresi yaklaşıyor";
  return "Aktif";
}

function remainingMessage(sub: TenantSubscription): string {
  if (sub.status === "EXPIRED" || sub.isExpired || sub.remainingDays < 0) return "Süresi doldu";
  if (sub.status === "CANCELLED") return "İptal edildi";
  if (sub.status === "SUSPENDED") return "Askıda";
  return `${Math.max(0, sub.remainingDays)} gün kaldı`;
}

function resolveErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Lisans bilgileri şu anda alınamadı. Lütfen yeniden deneyin.";
  }
  if (err.status === 0) {
    return "Sunucuya ulaşılamadı. Bağlantınızı kontrol ederek yeniden deneyin.";
  }
  if (err.code === "FORBIDDEN_TENANT" || err.status === 403) {
    return err.message || "Bu organizasyonun lisans bilgilerini görüntüleme yetkiniz yok.";
  }
  if (err.code === "ORGANIZATION_CONTEXT_REQUIRED") {
    return "Organizasyon oturumu bulunamadı. Yeniden giriş yapmayı deneyin.";
  }
  return err.message || "Lisans bilgileri şu anda alınamadı. Lütfen yeniden deneyin.";
}

function buildRenewalHref(
  tenantName?: string,
  support?: { email?: string | null; renewalUrl?: string | null } | null,
): { href: string; label: string } | null {
  const url = support?.renewalUrl?.trim() || process.env.NEXT_PUBLIC_LICENSE_RENEWAL_URL?.trim();
  if (url) return { href: url, label: "Woontegra ile iletişime geç" };

  const whatsapp = (process.env.NEXT_PUBLIC_SALES_WHATSAPP ?? "").replace(/\D/g, "");
  const message = tenantName
    ? `Merhaba, ${tenantName} hesabı için site yönetim uygulamasındaki lisansımı yenilemek istiyorum.`
    : "Merhaba, site yönetim uygulamasındaki lisansımı yenilemek istiyorum.";
  if (whatsapp) {
    return {
      href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
      label: "WhatsApp ile yazın",
    };
  }

  const email = (support?.email ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL)?.trim();
  if (email) {
    return {
      href: `mailto:${email}?subject=${encodeURIComponent("Lisans yenileme")}&body=${encodeURIComponent(message)}`,
      label: "E-posta gönder",
    };
  }
  return null;
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "teal" | "green" | "amber" | "danger";
  icon?: typeof IdCard;
}) {
  const tones = {
    neutral: "border-line/80 bg-white",
    teal: "border-teal-200/70 bg-teal-50/40",
    green: "border-emerald-200/70 bg-emerald-50/40",
    amber: "border-amber-200/70 bg-amber-50/40",
    danger: "border-rose-200/70 bg-rose-50/40",
  } as const;
  const iconTone = {
    neutral: "bg-slate-100 text-slate-600",
    teal: "bg-teal-100 text-teal-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    danger: "bg-rose-100 text-rose-700",
  } as const;

  return (
    <div className={cn("min-w-0 rounded-xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]", tones[tone])}>
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px]", iconTone[tone])}>
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[11px] text-muted">{label}</p>
          <p className="mt-0.5 break-words text-[15px] font-semibold tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function LicenseSettings() {
  const { user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const [payload, setPayload] = useState<MyLicenseResponse | null>(null);
  const [history, setHistory] = useState<TenantLicenseHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (force = false) => {
      if (!auth) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const result = await getMySubscriptionCached(auth, { force });
        setPayload(result);
        try {
          const hist = await listMySubscriptionHistory(auth, 12);
          setHistory(hist.items);
        } catch {
          setHistory([]);
        }
      } catch (err) {
        setError(resolveErrorMessage(err));
        setPayload(null);
      } finally {
        setLoading(false);
      }
    },
    [auth],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!auth?.tenantId) return;
    return subscribeMyLicenseCache((tenantId) => {
      if (tenantId && tenantId !== auth.tenantId) return;
      void load(true);
    });
  }, [auth?.tenantId, load]);

  const access: LicenseAccess | null = payload?.access ?? null;
  const subscription = payload ? licenseFromResponse(payload) : null;
  const orgName = payload?.organization?.name || user.tenantName;
  const renewal = useMemo(
    () => buildRenewalHref(orgName, payload?.support ?? null),
    [orgName, payload?.support],
  );
  const isPlatformAdmin = Boolean(access?.isPlatformAdmin || user.isPlatformAdmin);
  const noLicense = Boolean(payload && (payload.state === "NO_LICENSE" || !subscription));

  const planTone =
    !subscription
      ? "neutral"
      : subscription.status === "EXPIRED" || subscription.isExpired
        ? "danger"
        : subscription.status === "SUSPENDED" || subscription.status === "CANCELLED"
          ? "amber"
          : subscription.plan === "ANNUAL"
            ? "green"
            : "teal";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={settingsUi.help}>
            Lisans organizasyonunuza aittir ve seçili siteye bağlı değildir.
          </p>
        </div>
        <span className="inline-flex items-center rounded-md border border-line bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-muted">
          Tüm organizasyon için
        </span>
      </div>

      {loading ? <p className={settingsUi.help}>Lisans bilgileri yükleniyor…</p> : null}

      {error ? (
        <div className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 py-2.5">
          <p className="text-[12px] text-rose-800">{error}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => void load(true)}>
            Yeniden Dene
          </Button>
        </div>
      ) : null}

      {!loading && !error && isPlatformAdmin ? (
        <div
          className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[12px] leading-[1.4] text-ink"
          role="status"
        >
          Platform yöneticisi olarak görüntülüyorsunuz. Aşağıdaki kayıt bağlı organizasyonun müşteri
          lisansıdır; yönetim erişiminiz abonelik süresinden etkilenmez.
        </div>
      ) : null}

      {!loading && !error && noLicense ? (
        <EmptyState
          title="Lisans tanımlanmamış"
          description="Organizasyonunuz için henüz bir lisans tanımlanmamış. Lisans işlemleri için Woontegra ile iletişime geçin."
          icon={ShieldAlert}
          action={
            renewal ? (
              <a href={renewal.href} target="_blank" rel="noreferrer" className={settingsUi.btnSm}>
                {renewal.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : undefined
          }
        />
      ) : null}

      {!loading && !error && subscription ? (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              label="Lisans"
              value={PLAN_LABELS[subscription.plan]}
              hint={subscription.plan === "DEMO" ? "Ücretsiz demo" : "Yıllık abonelik"}
              tone={planTone}
              icon={IdCard}
            />
            <SummaryTile
              label="Durum"
              value={statusDisplayLabel(subscription)}
              hint={SUBSCRIPTION_STATUS_LABELS[subscription.status]}
              tone={planTone}
              icon={ShieldAlert}
            />
            <SummaryTile
              label="Kalan süre"
              value={remainingMessage(subscription)}
              hint={subscription.readOnly ? "Salt okunur" : "Tam erişim"}
              tone={
                subscription.remainingDays <= 0 || subscription.isExpired
                  ? "danger"
                  : subscription.remainingDays <= 7
                    ? "amber"
                    : planTone
              }
              icon={Timer}
            />
            <SummaryTile
              label="Bitiş tarihi"
              value={formatDateTr(subscription.endsAt)}
              hint={`Başlangıç ${formatDateTr(subscription.startsAt)}`}
              tone="neutral"
              icon={CalendarDays}
            />
          </div>

          <div className="rounded-xl border border-line/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-[13px] font-semibold text-ink">Lisans detayı</h3>
            <p className={cn(settingsUi.help, "mt-0.5")}>
              {payload?.licenseScope ??
                "Bu lisans organizasyonunuzdaki tüm kullanıcıları ve siteleri kapsar."}
            </p>
            <div className="mt-3">
              <SettingsInfoGrid
                columns={3}
                items={[
                  { label: "Organizasyon", value: orgName || "—" },
                  { label: "Başlangıç", value: formatDateTr(subscription.startsAt) },
                  { label: "Bitiş", value: formatDateTr(subscription.endsAt) },
                  {
                    label: "Kapsam",
                    value: "Tüm kullanıcılar ve siteler",
                  },
                  {
                    label: "Kullanım",
                    value:
                      payload?.usage != null
                        ? `${payload.usage.siteCount} site · ${payload.usage.userCount} kullanıcı`
                        : "—",
                  },
                  {
                    label: "Erişim",
                    value: subscription.readOnly ? "Salt okunur" : "Tam erişim",
                  },
                  ...(subscription.plan === "ANNUAL"
                    ? [
                        { label: "Yıllık net", value: formatMoney(subscription.netPrice) },
                        {
                          label: "KDV",
                          value: formatMoney(subscription.vatAmount),
                          hint:
                            subscription.vatRate != null ? (
                              <span className={settingsUi.help}>%{subscription.vatRate}</span>
                            ) : undefined,
                        },
                        { label: "Toplam", value: formatMoney(subscription.grossPrice) },
                      ]
                    : [
                        { label: "Ücret", value: "Ücretsiz demo" },
                        { label: "Para birimi", value: subscription.currency ?? "TRY" },
                      ]),
                ]}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
              <StatusBadge active={!subscription.readOnly && subscription.status === "ACTIVE"} />
              {!isPlatformAdmin &&
              (subscription.plan === "DEMO" ||
                subscription.status !== "ACTIVE" ||
                subscription.remainingDays <= 30) ? (
                <Link href="/app/lisans/yillik" className={settingsUi.btnSm}>
                  Yıllık Lisansa Geç
                </Link>
              ) : null}
              {renewal ? (
                <a href={renewal.href} target="_blank" rel="noreferrer" className={settingsUi.btnSm}>
                  {renewal.label}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <p className={settingsUi.help}>Yenileme için Woontegra ile iletişime geçin.</p>
              )}
              {isPlatformAdmin ? (
                <Link href="/app/admin/abonelikler" className={settingsUi.btnSm}>
                  Admin Lisans Yönetimine Git
                </Link>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  invalidateMyLicenseCache(auth?.tenantId);
                  void load(true);
                }}
              >
                Yenile
              </Button>
            </div>
          </div>

          {history.length > 0 ? (
            <div className="rounded-xl border border-line/80 bg-white px-4 py-3.5">
              <h3 className="text-[13px] font-semibold text-ink">Lisans geçmişi</h3>
              <p className={cn(settingsUi.help, "mt-0.5")}>Organizasyon lisansındaki son değişiklikler</p>
              <ul className="mt-2.5 divide-y divide-line/70">
                {history.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <div>
                      <p className="text-[12px] font-medium text-ink">{item.label}</p>
                      {item.newEndsAt ? (
                        <p className="text-[11px] text-muted">
                          Yeni bitiş: {formatDateTr(item.newEndsAt)}
                          {item.previousEndsAt ? ` · önceki ${formatDateTr(item.previousEndsAt)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted">{formatDateTr(item.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
