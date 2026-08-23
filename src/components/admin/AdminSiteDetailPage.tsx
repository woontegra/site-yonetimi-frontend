"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SETUP_LABELS } from "@/components/admin/labels";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { getAdminSite, type AdminSiteDetail } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

export function AdminSiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [site, setSite] = useState<AdminSiteDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth || !id) return;
    setLoading(true);
    setError("");
    try {
      const result = await getAdminSite(auth, id);
      setSite(result.site);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Site yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  if (loading && !site) return <PageContainer><p className="text-sm text-muted">Yükleniyor…</p></PageContainer>;
  if (error || !site) return <PageContainer><p className="text-sm text-danger">{error || "Site bulunamadı."}</p></PageContainer>;

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/admin/siteler"
        backLabel="Sitelere dön"
        title={site.name}
        description={
          <span>
            <Link href={`/app/admin/tenantlar/${site.tenant.id}`} className="hover:text-accent">{site.tenant.name}</Link>
            {site.city ? ` · ${[site.city, site.district].filter(Boolean).join(" / ")}` : ""}
          </span>
        }
        status={<StatusBadge active={site.isActive} />}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard label="Bina" value={String(site.counts.buildings)} />
        <StatCard label="Daire" value={String(site.counts.apartments)} />
        <StatCard label="Sakin" value={String(site.counts.residents)} />
        <StatCard label="Aktif misafir" value={String(site.counts.insideVisitors)} />
        <StatCard label="Demirbaş" value={String(site.counts.assets)} />
        <StatCard label="Kurulum" value={SETUP_LABELS[site.setupStatus] ?? site.setupStatus} />
      </div>
      <div className="max-w-xl space-y-2 text-sm">
        <p><span className="text-muted">Adres:</span> {site.address || "—"}</p>
        <p><span className="text-muted">Kod:</span> {site.code || "—"}</p>
        <p><span className="text-muted">Oluşturulma:</span> {formatDateTr(site.createdAt)}</p>
      </div>
    </PageContainer>
  );
}
