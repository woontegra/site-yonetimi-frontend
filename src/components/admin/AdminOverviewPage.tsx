"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardList,
  Cog,
  MessageCircle,
  Plug,
  Users,
  Wallet,
  Briefcase,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PLAN_LABELS, SUB_STATUS_LABELS, remainingLabel, subscriptionTone } from "@/components/admin/labels";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { getAdminOverview, type AdminOverview } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const MODULES = [
  { href: "/app/admin/tenantlar", title: "Tenant Yönetimi", description: "Müşteri hesaplarını ve durumlarını yönetin.", icon: Briefcase },
  { href: "/app/admin/siteler", title: "Site Yönetimi", description: "Platformdaki siteleri operasyonel olarak görün.", icon: Building2 },
  { href: "/app/admin/kullanicilar", title: "Kullanıcı Yönetimi", description: "Giriş yapan sistem kullanıcılarını yönetin.", icon: Users },
  { href: "/app/admin/abonelikler", title: "Abonelik Yönetimi", description: "Plan, deneme ve süre işlemleri.", icon: Wallet },
  { href: "/app/admin/entegrasyonlar", title: "Entegrasyonlar", description: "WhatsApp bağlantı durumunu izleyin.", icon: Plug },
  { href: "/app/admin/iletisim", title: "İletişim Geçmişi", description: "Gönderim ve teslimat kayıtları.", icon: MessageCircle },
  { href: "/app/admin/sistem", title: "Sistem Durumu", description: "API, veritabanı ve ortam görünürlüğü.", icon: Cog },
  { href: "/app/admin/denetim", title: "Admin Denetim Kayıtları", description: "Kritik platform işlemlerini inceleyin.", icon: ClipboardList },
] as const;

export function AdminOverviewPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      setData(await getAdminOverview(auth));
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Özet yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-page text-ink">Platform Yönetim Merkezi</h1>
        <p className="mt-1 text-sm text-muted">
          Sistem genelindeki tenant, site, kullanıcı ve abonelikleri yönetin.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : data ? (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Toplam tenant" value={String(data.metrics.totalTenants)} hint={`${data.metrics.activeTenants} aktif`} />
          <StatCard label="Toplam site" value={String(data.metrics.totalSites)} />
          <StatCard label="Toplam daire" value={String(data.metrics.totalApartments)} />
          <StatCard label="Toplam kullanıcı" value={String(data.metrics.totalUsers)} />
          <StatCard label="Aktif abonelik" value={String(data.metrics.activeSubscriptions)} />
          <StatCard label="Deneme" value={String(data.metrics.trialSubscriptions)} />
          <StatCard label="WhatsApp bağlı" value={String(data.metrics.whatsappConnected)} />
          <StatCard
            label="Süresi yaklaşan"
            value={String(data.metrics.expiringSubscriptions)}
            hint="Önümüzdeki 30 gün"
          />
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="block">
              <SurfaceCard className="h-full transition-colors duration-micro hover:border-accent/40">
                <Icon className="size-4 text-accent" aria-hidden />
                <h2 className="mt-3 text-section text-ink">{item.title}</h2>
                <p className="mt-1 text-sm text-muted">{item.description}</p>
              </SurfaceCard>
            </Link>
          );
        })}
      </div>

      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Son tenantlar">
            {data.recentTenants.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Kayıt yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.recentTenants.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/admin/tenantlar/${item.id}`} className="min-w-0 font-medium text-ink hover:text-accent">
                      {item.name}
                    </Link>
                    <span className="text-caption text-muted">{formatDateTr(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Süresi yaklaşan abonelikler" description="Önümüzdeki 30 gün">
            {data.expiringSubscriptions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Yaklaşan kayıt yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.expiringSubscriptions.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="min-w-0 font-medium text-ink hover:text-accent">
                      {item.tenant.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={SUB_STATUS_LABELS[item.status] ?? item.status}
                        tone={subscriptionTone(item.status)}
                      />
                      <span className="text-caption text-muted">{remainingLabel(item) ?? PLAN_LABELS[item.plan]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Sorunlu entegrasyonlar">
            {data.errorIntegrations.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Hata durumunda kayıt yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.errorIntegrations.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/admin/entegrasyonlar`} className="min-w-0 font-medium text-ink hover:text-accent">
                      {item.tenantName}
                    </Link>
                    <StatusBadge status="failed" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Başarısız mesajlar">
            {data.failedMessages.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Başarısız kayıt yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.failedMessages.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/admin/iletisim/${item.id}`} className="min-w-0 font-medium text-ink hover:text-accent">
                      {item.tenantName}
                    </Link>
                    <span className="text-caption text-muted">{formatDateTr(item.createdAt)}</span>
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
