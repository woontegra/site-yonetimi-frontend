"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { getDashboardOverview } from "@/lib/dashboard-api";
import { ApiError } from "@/lib/http";
import { getSite } from "@/lib/sites-api";

type Stats = {
  siteName: string;
  buildingCount: number;
  apartmentCount: number;
  personCount: number;
  organizationName: string;
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export function SystemInfoSettings() {
  const { user } = useAuth();
  const { siteId, status } = useActiveSite();
  const auth = useApiAuth({ requireSite: true });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !siteId) {
      setLoading(false);
      setStats(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [siteResult, overview] = await Promise.all([getSite(auth, siteId), getDashboardOverview(auth)]);
      setStats({
        siteName: siteResult.site.name,
        buildingCount: siteResult.site.buildingCount ?? 0,
        apartmentCount: overview.apartmentSummary.total,
        personCount: overview.residentSummary.total,
        organizationName: user.tenantName ?? "—",
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Özet bilgiler yüklenemedi.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [auth, siteId, user.tenantName]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return <p className="text-sm text-muted">Yükleniyor…</p>;
  }

  if (status === "noSites" || !siteId) {
    return (
      <p className="text-sm text-muted">
        Özet bilgiler için bir site seçin.{" "}
        <Link href="/app/siteler" className="font-medium text-accent hover:underline">
          Siteler
        </Link>
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Özet bilgiler yükleniyor…</p>;
  }

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (!stats) return null;

  const rows = [
    { label: "Seçili site", value: stats.siteName },
    { label: "Toplam bina", value: String(stats.buildingCount) },
    { label: "Toplam daire", value: String(stats.apartmentCount) },
    { label: "Toplam sakin", value: String(stats.personCount) },
    { label: "Hesap / organizasyon", value: stats.organizationName },
    { label: "Uygulama sürümü", value: APP_VERSION },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">Seçili site ve hesabınıza ait özet. Gizli sistem bilgileri burada gösterilmez.</p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-canvas/40 px-3 py-2.5"
          >
            <dt className="text-[13px] text-muted">{row.label}</dt>
            <dd className="text-sm font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
