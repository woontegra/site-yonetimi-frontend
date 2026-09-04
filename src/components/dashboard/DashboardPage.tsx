"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  Receipt,
  Shield,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  MetricTile,
  SectionCard,
  StatCard,
  SurfaceCard,
} from "@/components/ui/SurfaceCard";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { cardTone, type CardTone } from "@/lib/card-tones";
import { getDashboardOverview, type DashboardOverview } from "@/lib/dashboard-api";
import { getApartmentResidentDisplay } from "@/lib/apartment-labels";
import { ApiError } from "@/lib/http";
import { cn } from "@/lib/cn";
import { MONTH_LABELS, formatDateTr, formatMoney } from "@/lib/money";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-100 ${className ?? "h-4 w-24"}`} />;
}

const QUICK_ACTIONS: Array<{
  href: string;
  label: string;
  icon: typeof Banknote;
  tone: CardTone;
}> = [
  { href: "/app/muhasebe/tahsilatlar", label: "Ödeme Kaydet", icon: Banknote, tone: "green" },
  { href: "/app/muhasebe/giderler", label: "Gider Ekle", icon: Receipt, tone: "rose" },
  { href: "/app/duyurular", label: "Duyuru Oluştur", icon: Bell, tone: "blue" },
  { href: "/app/misafirler", label: "Misafir Girişi", icon: UserRound, tone: "violet" },
  { href: "/app/kisiler", label: "Yeni Kişi", icon: UserPlus, tone: "cyan" },
  { href: "/app/demirbaslar", label: "Demirbaş Ekle", icon: Wrench, tone: "amber" },
];

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function urgencyTone(days: number | null): CardTone {
  if (days == null) return "neutral";
  if (days <= 0) return "rose";
  if (days <= 3) return "amber";
  if (days <= 7) return "blue";
  return "neutral";
}

function urgencyBorderColor(tone: CardTone): string {
  return `var(--tone-${tone}-accent)`;
}

export function DashboardPage() {
  const { ready, user } = useAuth();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId } = useActiveSite();
  const { openWizard } = useSiteSetupWizard();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth || !siteId) return;
    setLoading(true);
    setError("");
    try {
      const overview = await getDashboardOverview(auth);
      if (overview.site.id !== siteId) return;
      setData(overview);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Genel bakış yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, siteId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const siteName = site?.name || data?.site.name || "Aktif site";
  const setupIncomplete = data ? !data.setupStatus.completed : false;
  const periodLabel = data
    ? `${MONTH_LABELS[data.financeSummary.month - 1]} ${data.financeSummary.year}`
    : "";

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-page text-ink">Site Genel Bakış</h1>
          <p className="mt-1 text-sm text-muted">{siteName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user.isPlatformAdmin ? (
            <Link
              href="/app/admin"
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas"
            >
              <Shield className="size-3.5 text-muted" aria-hidden />
              Yönetim Merkezi
            </Link>
          ) : null}
          {periodLabel ? <span className="text-caption text-muted">{periodLabel}</span> : null}
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading ? <DashboardSkeleton /> : null}

      {!loading && data && setupIncomplete ? (
        <SurfaceCard tone="amber" className="mb-6">
          <h2 className="text-section text-ink">Sitenizin kurulumu henüz tamamlanmadı.</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Bina, daire ve sakin bilgilerini tamamladığınızda bu ekran site operasyonunun özetini
            gösterecek.
          </p>
          <Button className="mt-4" onClick={() => openWizard()}>
            Kuruluma Devam Et
          </Button>
        </SurfaceCard>
      ) : null}

      {!loading && data && !setupIncomplete ? (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
          <StatCard
            tone="blue"
            icon={Building2}
            label="Daireler"
            value={String(data.apartmentSummary.total)}
            hint={`${data.apartmentSummary.active} aktif`}
          />
          <StatCard
            tone="violet"
            icon={Users}
            label="Sakinler"
            value={String(data.residentSummary.total)}
            hint={`${data.residentSummary.owners} mülk sahibi · ${data.residentSummary.tenants} kiracı`}
          />
          <StatCard
            tone="green"
            icon={Wallet}
            label="Tahsilat"
            value={formatMoney(data.financeSummary.collected)}
            hint="Bu ay tahsil edildi"
          />
          <StatCard
            tone="rose"
            icon={AlertCircle}
            label="Açık Borç"
            value={formatMoney(data.financeSummary.openDebt)}
            hint={`${data.financeSummary.indebtedApartmentCount} daire`}
          />
        </div>
      ) : null}

      {!loading && data && !setupIncomplete ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <SectionCard
            className="xl:col-span-8"
            tone="teal"
            icon={LayoutGrid}
            title="Bu Ayın Finansal Durumu"
            description={periodLabel}
            action={
              <Link
                href="/app/muhasebe"
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                Muhasebe
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              <MetricTile
                tone="blue"
                label="Tahakkuk"
                value={formatMoney(data.financeSummary.accrued)}
              />
              <MetricTile
                tone="green"
                label="Tahsilat"
                value={formatMoney(data.financeSummary.collected)}
              />
              <MetricTile
                tone="amber"
                label="Gider"
                value={formatMoney(data.financeSummary.expense)}
              />
              <MetricTile
                tone="rose"
                label="Açık Borç"
                value={formatMoney(data.financeSummary.openDebt)}
              />
            </div>
            <CollectionProgress
              rate={data.financeSummary.collectionRatePercent}
              collected={data.financeSummary.collected}
              accrued={data.financeSummary.accrued}
            />
          </SectionCard>

          <SectionCard className="xl:col-span-4" tone="neutral" icon={Zap} title="Hızlı İşlemler">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
              {QUICK_ACTIONS.map((item) => {
                const Icon = item.icon;
                const tones = cardTone(item.tone);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-ink transition-colors duration-micro",
                      tones.hover,
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        tones.icon,
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            className="xl:col-span-7"
            tone="green"
            icon={Banknote}
            title="Son Hareketler"
            action={
              <Link
                href="/app/muhasebe"
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                Muhasebe
              </Link>
            }
          >
            {data.recentActivity.length === 0 ? (
              <EmptyState
                compact
                tone="green"
                icon={Banknote}
                title="Henüz hareket yok"
                description="Tahsilat veya gider kaydı oluşunca burada listelenir."
              />
            ) : (
              <ul className="divide-y divide-[color:var(--tone-green-border)]">
                {data.recentActivity.map((item) => {
                  const isPayment = item.type === "payment";
                  const tones = cardTone(isPayment ? "green" : "rose");
                  const Icon = isPayment ? Wallet : Receipt;
                  const resident =
                    isPayment && item.buildingName && item.apartmentNumber
                      ? getApartmentResidentDisplay({
                          buildingName: item.buildingName,
                          apartmentNumber: item.apartmentNumber,
                          owners: item.activeOwners ?? [],
                          tenants: item.activeTenants ?? [],
                        })
                      : null;
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-md px-1 py-2.5 transition-colors duration-micro",
                          tones.hover,
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            className={cn(
                              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                              tones.icon,
                            )}
                          >
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">{item.title}</p>
                            {resident ? (
                              <>
                                <p className="text-caption text-muted">{resident.label}</p>
                                {item.payerName ? (
                                  <p className="text-caption text-muted">Ödeyen: {item.payerName}</p>
                                ) : resident.secondaryLine ? (
                                  <p className="text-caption text-muted">{resident.secondaryLine}</p>
                                ) : null}
                                <p className="text-caption text-muted">
                                  {formatDateTr(item.occurredAt)}
                                </p>
                              </>
                            ) : (
                              <p className="text-caption text-muted">
                                Gider · {item.subtitle} · {formatDateTr(item.occurredAt)}
                              </p>
                            )}
                          </div>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-semibold",
                            isPayment ? "text-success" : "text-danger",
                          )}
                        >
                          {formatMoney(item.amount)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-5"
            tone="amber"
            icon={CalendarDays}
            title="Yaklaşanlar"
            action={
              <Link
                href="/app/muhasebe"
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                Borçlar
              </Link>
            }
          >
            {data.upcoming.length === 0 ? (
              <EmptyState
                compact
                tone="amber"
                icon={CalendarDays}
                title="Yaklaşan kayıt yok"
                description="Vade veya bakım yaklaşınca burada görünür."
              />
            ) : (
              <ul className="divide-y divide-[color:var(--tone-amber-border)]">
                {data.upcoming.map((item) => {
                  const days = daysUntil(item.date);
                  const tone = urgencyTone(days);
                  const tones = cardTone(tone);
                  const resident =
                    item.type === "debt" && item.buildingName && item.apartmentNumber
                      ? getApartmentResidentDisplay({
                          buildingName: item.buildingName,
                          apartmentNumber: item.apartmentNumber,
                          owners: item.activeOwners ?? [],
                          tenants: item.activeTenants ?? [],
                        })
                      : null;
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        style={{ borderLeftColor: urgencyBorderColor(tone) }}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-md border-l-[3px] px-1 py-2.5 pl-2 transition-colors duration-micro",
                          tones.hover,
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{item.title}</p>
                          {resident ? (
                            <>
                              <p className="text-caption text-muted">{resident.label}</p>
                              {resident.secondaryLine ? (
                                <p className="text-caption text-muted">{resident.secondaryLine}</p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-caption text-muted">Bakım · {item.subtitle}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-caption font-medium",
                            tones.icon,
                          )}
                        >
                          <CalendarDays className="size-3" aria-hidden />
                          {item.date ? formatDateTr(item.date) : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-4"
            tone="violet"
            icon={UserRound}
            title="Şu anda içeride"
            action={
              <Link
                href="/app/misafirler"
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                Tümünü Gör
              </Link>
            }
          >
            <p className="mb-3 text-sm text-muted">{data.activeVisitors.count} misafir</p>
            {data.activeVisitors.items.length === 0 ? (
              <EmptyState
                compact
                tone="violet"
                icon={UserRound}
                title="İçeride misafir yok"
                description="Aktif ziyaretçi kaydı bulunmuyor."
              />
            ) : (
              <ul className="space-y-2">
                {data.activeVisitors.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-lg px-2 py-1.5 transition-colors duration-micro",
                        cardTone("violet").hover,
                      )}
                    >
                      <p className="text-sm font-medium text-ink">{item.visitorName}</p>
                      <p className="text-caption text-muted">{item.apartmentLabel}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-4"
            tone="blue"
            icon={Bell}
            title="Son Duyurular"
            action={
              <Link
                href="/app/duyurular"
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                Tüm Duyurular
              </Link>
            }
          >
            {data.activeAnnouncements.length === 0 ? (
              <EmptyState
                compact
                tone="blue"
                icon={Bell}
                title="Yayında duyuru yok"
                description="Yeni duyuru yayınlandığında burada görünür."
              />
            ) : (
              <ul className="space-y-2.5">
                {data.activeAnnouncements.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-lg px-2 py-1.5 transition-colors duration-micro",
                        cardTone("blue").hover,
                      )}
                    >
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="text-caption text-muted">
                        {formatDateTr(item.publishedAt)} · {item.targetSummary || item.audienceLabel}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-4"
            tone="amber"
            icon={Wrench}
            title="Bakım Takibi"
            action={
              <Link
                href="/app/demirbaslar"
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                Demirbaşlara Git
              </Link>
            }
          >
            <p className="mb-3 text-sm text-muted">{data.upcomingMaintenances.count} yaklaşan bakım</p>
            {data.upcomingMaintenances.items.length === 0 ? (
              <EmptyState
                compact
                tone="amber"
                icon={Wrench}
                title="Planlı bakım yok"
                description="Yaklaşan bakım tarihi tanımlandığında listelenir."
              />
            ) : (
              <ul className="space-y-2.5">
                {data.upcomingMaintenances.items.map((item) => {
                  const days = daysUntil(item.nextMaintenanceDate);
                  const tone = urgencyTone(days);
                  const tones = cardTone(tone);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors duration-micro",
                          tones.hover,
                        )}
                      >
                        <p className="min-w-0 truncate text-sm font-medium text-ink">{item.name}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-caption font-medium",
                            tones.icon,
                          )}
                        >
                          {item.nextMaintenanceDate
                            ? formatDateTr(item.nextMaintenanceDate)
                            : "—"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}
    </PageContainer>
  );
}

function CollectionProgress({
  rate,
  collected,
  accrued,
}: {
  rate: number | null;
  collected: string;
  accrued: string;
}) {
  if (rate === null) {
    return <p className="mt-4 text-caption text-muted">Bu ay için tahsilat oranı hesaplanamadı.</p>;
  }

  return (
    <div className="mt-5">
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2 text-caption">
        <div>
          <span className="text-muted">Bu ay tahsilat oranı</span>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {formatMoney(collected)} / {formatMoney(accrued)}
          </p>
        </div>
        <span className="text-base font-semibold text-[color:var(--tone-green-icon)]">
          %{rate} tahsil edildi
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--tone-neutral-metric)]">
        <div
          className="h-full rounded-full bg-[color:var(--tone-green-accent)] transition-[width] duration-micro"
          style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SurfaceCard key={index} padding="sm">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-6 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
          </SurfaceCard>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <SurfaceCard className="xl:col-span-8">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-6 h-16 w-full" />
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-32 w-full" />
        </SurfaceCard>
      </div>
    </div>
  );
}
