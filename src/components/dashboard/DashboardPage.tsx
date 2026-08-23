"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Bell,
  Plus,
  Receipt,
  Shield,
  UserPlus,
  UserRound,
  Wrench,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { getDashboardOverview, type DashboardOverview } from "@/lib/dashboard-api";
import { ApiError } from "@/lib/http";
import { MONTH_LABELS, formatDateTr, formatMoney } from "@/lib/money";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-100 ${className ?? "h-4 w-24"}`} />;
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

const QUICK_ACTIONS = [
  { href: "/app/muhasebe/tahsilatlar", label: "Ödeme Kaydet", icon: Banknote },
  { href: "/app/muhasebe/giderler", label: "Gider Ekle", icon: Receipt },
  { href: "/app/duyurular", label: "Duyuru Oluştur", icon: Bell },
  { href: "/app/misafirler", label: "Misafir Girişi", icon: UserRound },
  { href: "/app/kisiler", label: "Yeni Kişi", icon: UserPlus },
  { href: "/app/demirbaslar", label: "Demirbaş Ekle", icon: Wrench },
] as const;

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
      setData(await getDashboardOverview(auth));
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

  const siteName = data?.site.name || site?.name || "Aktif site";
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
        <SurfaceCard className="mb-6">
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
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Daireler"
            value={String(data.apartmentSummary.total)}
            hint={`${data.apartmentSummary.active} aktif`}
          />
          <StatCard
            label="Sakinler"
            value={String(data.residentSummary.total)}
            hint={`${data.residentSummary.owners} mülk sahibi · ${data.residentSummary.tenants} kiracı`}
          />
          <StatCard
            label="Tahsilat"
            value={formatMoney(data.financeSummary.collected)}
            hint="Bu ay tahsil edildi"
          />
          <StatCard
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
            title="Bu Ayın Finansal Durumu"
            description={periodLabel}
            action={
              <Link href="/app/muhasebe" className="text-caption font-medium text-accent hover:underline">
                Muhasebe
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FinanceMetric label="Tahakkuk" value={formatMoney(data.financeSummary.accrued)} />
              <FinanceMetric label="Tahsilat" value={formatMoney(data.financeSummary.collected)} />
              <FinanceMetric label="Gider" value={formatMoney(data.financeSummary.expense)} />
              <FinanceMetric label="Açık Borç" value={formatMoney(data.financeSummary.openDebt)} />
            </div>
            <CollectionProgress rate={data.financeSummary.collectionRatePercent} />
          </SectionCard>

          <SectionCard className="xl:col-span-4" title="Hızlı İşlemler">
            <div className="grid grid-cols-1 gap-1.5">
              {QUICK_ACTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-canvas"
                  >
                    <Icon className="size-4 text-muted" aria-hidden />
                    {item.label}
                    <Plus className="ml-auto size-3.5 text-muted" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            className="xl:col-span-7"
            title="Son Hareketler"
            action={
              <Link href="/app/muhasebe" className="text-caption font-medium text-accent hover:underline">
                Muhasebe
              </Link>
            }
          >
            {data.recentActivity.length === 0 ? (
              <EmptyLine>Henüz tahsilat veya gider kaydı yok.</EmptyLine>
            ) : (
              <ul className="divide-y divide-line">
                {data.recentActivity.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link href={item.href} className="flex items-start justify-between gap-3 py-2.5 hover:bg-canvas/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        <p className="truncate text-caption text-muted">
                          {item.type === "payment" ? "Ödeme alındı" : "Gider eklendi"} · {item.subtitle}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-ink">{formatMoney(item.amount)}</p>
                        <p className="text-caption text-muted">{formatDateTr(item.occurredAt)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-5"
            title="Yaklaşanlar"
            action={
              <Link href="/app/muhasebe" className="text-caption font-medium text-accent hover:underline">
                Borçlar
              </Link>
            }
          >
            {data.upcoming.length === 0 ? (
              <EmptyLine>Yaklaşan vade veya bakım kaydı yok.</EmptyLine>
            ) : (
              <ul className="divide-y divide-line">
                {data.upcoming.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link href={item.href} className="flex items-start justify-between gap-3 py-2.5 hover:bg-canvas/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        <p className="truncate text-caption text-muted">
                          {item.type === "debt" ? "Aidat / vade" : "Bakım"} · {item.subtitle}
                        </p>
                      </div>
                      <p className="shrink-0 text-caption text-muted">{formatDateTr(item.date)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            className="xl:col-span-4"
            title="Şu anda içeride"
            action={
              <Link href="/app/misafirler" className="text-caption font-medium text-accent hover:underline">
                Tümünü Gör
              </Link>
            }
          >
            <p className="mb-3 text-sm text-muted">{data.activeVisitors.count} misafir</p>
            {data.activeVisitors.items.length === 0 ? (
              <EmptyLine>İçeride kayıtlı misafir yok.</EmptyLine>
            ) : (
              <ul className="space-y-2">
                {data.activeVisitors.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="block rounded-md px-1 py-1 hover:bg-canvas">
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
            title="Son Duyurular"
            action={
              <Link href="/app/duyurular" className="text-caption font-medium text-accent hover:underline">
                Tüm Duyurular
              </Link>
            }
          >
            {data.activeAnnouncements.length === 0 ? (
              <EmptyLine>Yayında duyuru yok.</EmptyLine>
            ) : (
              <ul className="space-y-2.5">
                {data.activeAnnouncements.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="block rounded-md px-1 py-1 hover:bg-canvas">
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
            title="Bakım Takibi"
            action={
              <Link href="/app/demirbaslar" className="text-caption font-medium text-accent hover:underline">
                Demirbaşlara Git
              </Link>
            }
          >
            <p className="mb-3 text-sm text-muted">{data.upcomingMaintenances.count} yaklaşan bakım</p>
            {data.upcomingMaintenances.items.length === 0 ? (
              <EmptyLine>Planlı bakım kaydı yok.</EmptyLine>
            ) : (
              <ul className="space-y-2.5">
                {data.upcomingMaintenances.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-canvas">
                      <p className="min-w-0 truncate text-sm font-medium text-ink">{item.name}</p>
                      <p className="shrink-0 text-caption text-muted">
                        {formatDateTr(item.nextMaintenanceDate)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}
    </PageContainer>
  );
}

function FinanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-1 min-w-0 break-words text-sm font-medium tracking-tight text-ink">{value}</p>
    </div>
  );
}

function CollectionProgress({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <p className="mt-4 text-caption text-muted">Bu ay için tahsilat oranı hesaplanamadı.</p>;
  }

  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between text-caption">
        <span className="text-muted">Bu ay tahsilat oranı</span>
        <span className="font-medium text-ink">%{rate}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full bg-accent" style={{ width: `${rate}%` }} />
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
