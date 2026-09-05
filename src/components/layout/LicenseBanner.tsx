"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Crown, Rocket, Shield, ShieldAlert, X } from "lucide-react";
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
import { Button } from "@/components/ui/Button";
import {
  buildLicenseBannerCopy,
  dismissLicenseBanner,
  isLicenseBannerDismissed,
  resolveLicenseBannerKind,
  type LicenseBannerTone,
} from "@/components/layout/license-banner-model";

const shellClass: Record<LicenseBannerTone, string> = {
  info: "border-info/20 bg-gradient-to-r from-info-subtle/70 to-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
  teal: "border-teal-200/70 bg-gradient-to-r from-teal-50/90 via-sky-50/40 to-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
  amber:
    "border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-teal-50/30 to-surface shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
  danger:
    "border-rose-200/70 bg-gradient-to-r from-rose-50/80 via-amber-50/40 to-surface shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
};

const progressClass: Record<LicenseBannerTone, string> = {
  info: "bg-info/50",
  teal: "bg-teal-600/70",
  amber: "bg-amber-500/80",
  danger: "bg-rose-500/80",
};

function BannerIcon({ kind, tone }: { kind: string; tone: LicenseBannerTone }) {
  const cls = cn(
    "size-4",
    tone === "danger" ? "text-rose-700" : tone === "amber" ? "text-amber-800" : "text-teal-700",
  );
  if (kind === "expired" || kind === "cancelled") return <ShieldAlert className={cls} aria-hidden />;
  if (kind === "suspended") return <AlertTriangle className={cls} aria-hidden />;
  if (kind.startsWith("annual")) return <Shield className={cls} aria-hidden />;
  if (kind === "demo_3" || kind === "demo_2" || kind === "demo_1") return <Crown className={cls} aria-hidden />;
  return <Rocket className={cls} aria-hidden />;
}

export function LicenseBanner() {
  const pathname = usePathname();
  const { ready, user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const [access, setAccess] = useState<LicenseAccess | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  const kind = resolveLicenseBannerKind(subscription);
  const copy = useMemo(() => {
    if (!kind || !subscription) return null;
    return buildLicenseBannerCopy(kind, subscription.remainingDays, subscription.plan);
  }, [kind, subscription]);

  useEffect(() => {
    if (!auth?.tenantId || !copy) {
      setDismissed(false);
      return;
    }
    if (!copy.dismissible) {
      setDismissed(false);
      return;
    }
    setDismissed(isLicenseBannerDismissed(auth.tenantId, copy.kind, subscription?.remainingDays ?? 0));
  }, [auth?.tenantId, copy, subscription?.remainingDays]);

  if (!loaded || pathname.startsWith("/app/admin")) return null;

  // Platform admin satış banner'ı görmez; lisans ayarlarından takip eder.
  const isPlatformAdmin = Boolean(access?.exempt || access?.isPlatformAdmin || user.isPlatformAdmin);
  if (isPlatformAdmin) return null;

  if (!copy || !subscription || dismissed) return null;

  const progressPct =
    copy.progress != null ? Math.min(100, Math.max(0, (copy.progress.day / copy.progress.total) * 100)) : null;

  return (
    <div className="border-b border-line/80 bg-canvas px-4 py-2.5 lg:px-6 xl:px-8">
      <div
        className={cn(
          "relative overflow-hidden rounded-[10px] border px-3 py-2.5 sm:px-3.5",
          "min-h-[54px] max-h-none",
          shellClass[copy.tone],
        )}
        role="status"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                copy.tone === "danger"
                  ? "bg-rose-100/80"
                  : copy.tone === "amber"
                    ? "bg-amber-100/80"
                    : "bg-teal-100/70",
              )}
            >
              <BannerIcon kind={copy.kind} tone={copy.tone} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[12px] font-medium leading-[1.35] text-ink sm:text-[13px]">{copy.title}</p>
                {copy.badge ? (
                  <span className="inline-flex items-center rounded-md border border-line/80 bg-white/70 px-1.5 py-0.5 text-[11px] font-medium text-ink/80">
                    {copy.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] leading-[1.4] text-muted sm:text-[12px]">{copy.body}</p>
              {copy.progress ? (
                <p className="mt-1 text-[10px] text-muted">
                  {copy.progress.total} günlük demonun {copy.progress.day}. günü
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {copy.secondaryCta ? (
              <Link
                href={copy.secondaryCta.href}
                className="text-[12px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {copy.secondaryCta.label}
              </Link>
            ) : null}
            <Link href={copy.primaryCta.href}>
              <Button size="sm" className="h-8 min-w-[7.5rem] px-3 text-[12px] font-medium">
                {copy.primaryCta.label}
              </Button>
            </Link>
            {copy.dismissible ? (
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-white/70 hover:text-ink"
                aria-label="Bannerı bugün için gizle"
                onClick={() => {
                  if (!auth?.tenantId) return;
                  dismissLicenseBanner(auth.tenantId, copy.kind, subscription.remainingDays);
                  setDismissed(true);
                }}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {progressPct != null ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.04]">
            <div className={cn("h-full transition-none", progressClass[copy.tone])} style={{ width: `${progressPct}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
