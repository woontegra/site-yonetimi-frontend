"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard, StatCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PLAN_LABELS, SUB_STATUS_LABELS, remainingLabel, subscriptionTone } from "@/components/admin/labels";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { getAdminOverview, type AdminOverview } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

export function AdminControlCenterPage() {
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
      setError(err instanceof ApiError ? err.message : "Kontrol merkezi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const m = data?.metrics;

  return (
    <PageContainer>
      <PageHeader
        title="Kontrol Merkezi"
        description="Platform operasyon özeti. Müşteri finansal detayları burada gösterilmez."
      />

      {error ? <p className="mb-3 text-[12px] text-danger">{error}</p> : null}

      {loading || !m ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Link href="/app/admin/tenantlar"><StatCard label="Toplam organizasyon" value={String(m.totalTenants)} hint={`${m.activeTenants} aktif`} /></Link>
            <Link href="/app/admin/tenantlar?filter=aktif"><StatCard label="Aktif organizasyon" value={String(m.activeTenants)} /></Link>
            <Link href="/app/admin/abonelikler?filter=demo"><StatCard label="Demo lisansı" value={String(m.trialSubscriptions)} /></Link>
            <Link href="/app/admin/abonelikler?filter=annual"><StatCard label="Yıllık lisans" value={String(m.activeSubscriptions)} /></Link>
            <Link href="/app/admin/abonelikler?filter=expired"><StatCard label="Süresi dolmuş lisans" value={String(m.expiredSubscriptions ?? 0)} /></Link>
            <Link href="/app/admin/tenantlar?filter=pasif"><StatCard label="Askıya alınmış hesap" value={String(m.suspendedTenants ?? 0)} /></Link>
            <Link href="/app/admin/siteler"><StatCard label="Toplam site" value={String(m.totalSites)} /></Link>
            <Link href="/app/admin/kullanicilar"><StatCard label="Toplam kullanıcı" value={String(m.totalUsers)} /></Link>
            <StatCard label="Son 30 günde aktif kullanıcı" value={String(m.usersActive30d ?? 0)} />
            <Link href="/app/admin/abonelikler"><StatCard label="Yakında süresi dolacak" value={String(m.expiringSubscriptions)} hint="30 gün" /></Link>
            <Link href="/app/admin/entegrasyonlar?status=ERROR"><StatCard label="Hata veren entegrasyon" value={String(m.whatsappError ?? 0)} /></Link>
            <Link href="/app/admin/iletisim"><StatCard label="Gönderilemeyen mesaj" value={String((m.failedMessages ?? 0) + (m.failedEmailDeliveries ?? 0))} /></Link>
          </div>

          <SectionCard title="Kritik uyarılar" className="mb-5">
            {!data.alerts?.length ? (
              <p className="text-[12px] text-muted">Kritik uyarı yok.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.alerts.map((alert) => (
                  <li key={alert.code} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{alert.title}</p>
                      <p className="text-[11px] text-muted">{alert.description}</p>
                    </div>
                    <Link href={alert.href} className="shrink-0 text-[11px] font-medium text-accent">
                      İncele →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="7 gün içinde dolacak lisanslar">
              {(data.criticalExpiring ?? []).length === 0 ? (
                <p className="text-[12px] text-muted">Kayıt yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {(data.criticalExpiring ?? []).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="text-[13px] font-medium text-ink hover:text-accent">
                        {item.tenant.name}
                      </Link>
                      <span className="text-[11px] text-muted">{remainingLabel(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Süresi yaklaşan abonelikler" description="30 gün">
              {data.expiringSubscriptions.length === 0 ? (
                <p className="text-[12px] text-muted">Kayıt yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.expiringSubscriptions.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="text-[13px] font-medium text-ink hover:text-accent">
                        {item.tenant.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <StatusBadge label={SUB_STATUS_LABELS[item.status] ?? item.status} tone={subscriptionTone(item.status)} />
                        <span className="text-[11px] text-muted">{PLAN_LABELS[item.plan]}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Sorunlu entegrasyonlar">
              {data.errorIntegrations.length === 0 ? (
                <p className="text-[12px] text-muted">Hata yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.errorIntegrations.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href="/app/admin/entegrasyonlar" className="text-[13px] font-medium text-ink hover:text-accent">
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
                <p className="text-[12px] text-muted">Kayıt yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.failedMessages.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/app/admin/iletisim/${item.id}`} className="text-[13px] font-medium text-ink hover:text-accent">
                        {item.tenantName}
                      </Link>
                      <span className="text-[11px] text-muted">{formatDateTr(item.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </PageContainer>
  );
}
