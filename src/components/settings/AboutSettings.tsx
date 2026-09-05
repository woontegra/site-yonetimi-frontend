"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { getDashboardOverview } from "@/lib/dashboard-api";
import { ApiError } from "@/lib/http";
import { getSite } from "@/lib/sites-api";
import { listTenantUsers } from "@/lib/tenant-users-api";
import { hasPermission } from "@/lib/permissions";
import { SettingsScopeBadge } from "@/components/settings/SettingsScopeBadge";
import {
  SettingsCard,
  SettingsInfoGrid,
  settingsUi,
} from "@/components/settings/settings-ui";

type Stats = {
  siteName: string;
  buildingCount: number;
  apartmentCount: number;
  personCount: number;
  organizationName: string;
  userCount: number | null;
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Site Yönetimi";
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() || null;
const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL?.trim() || null;
const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL?.trim() || null;

export function AboutSettings() {
  const { user } = useAuth();
  const { siteId, status } = useActiveSite();
  const authSite = useApiAuth({ requireSite: true });
  const authTenant = useApiAuth({ requireSite: false });
  const canViewUsers = hasPermission(user, "users.view") || !user.permissions?.length;

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let userCount: number | null = null;
      if (authTenant && canViewUsers) {
        try {
          const users = await listTenantUsers(authTenant);
          userCount = users.summary?.active ?? users.items.filter((row) => row.status === "ACTIVE").length;
        } catch {
          userCount = null;
        }
      }

      if (!authSite || !siteId) {
        setStats({
          siteName: "—",
          buildingCount: 0,
          apartmentCount: 0,
          personCount: 0,
          organizationName: user.tenantName ?? "—",
          userCount,
        });
        return;
      }

      const [siteResult, overview] = await Promise.all([
        getSite(authSite, siteId),
        getDashboardOverview(authSite),
      ]);
      setStats({
        siteName: siteResult.site.name,
        buildingCount: siteResult.site.buildingCount ?? 0,
        apartmentCount: overview.apartmentSummary.total,
        personCount: overview.residentSummary.total,
        organizationName: user.tenantName ?? "—",
        userCount,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Özet bilgiler yüklenemedi.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [authSite, authTenant, canViewUsers, siteId, user.tenantName]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={settingsUi.cardsGap}>
      <SettingsCard
        title="Organizasyon ve kullanım özeti"
        description="Gizli teknik bilgiler (DB, secret, sunucu) gösterilmez."
        action={<SettingsScopeBadge scope="organization" />}
      >
        {loading ? <p className={settingsUi.help}>Özet yükleniyor…</p> : null}
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        {!loading && !error && stats ? (
          <SettingsInfoGrid
            items={[
              { label: "Organizasyon", value: stats.organizationName },
              { label: "Seçili site", value: status === "ready" ? stats.siteName : "Seçilmedi" },
              { label: "Bina sayısı", value: stats.buildingCount },
              { label: "Daire sayısı", value: stats.apartmentCount },
              { label: "Aktif sakin", value: stats.personCount },
              {
                label: "Kullanıcı sayısı",
                value: stats.userCount === null ? "—" : stats.userCount,
              },
            ]}
          />
        ) : null}
      </SettingsCard>

      <SettingsCard title="Uygulama" action={<SettingsScopeBadge scope="organization" />}>
        <SettingsInfoGrid
          items={[
            { label: "Uygulama adı", value: APP_NAME },
            { label: "Sürüm", value: APP_VERSION },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
          {TERMS_URL ? (
            <a href={TERMS_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Kullanım koşulları
            </a>
          ) : null}
          {PRIVACY_URL ? (
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Gizlilik politikası
            </a>
          ) : null}
          {SUPPORT_URL ? (
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Destek
            </a>
          ) : process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
              className="font-medium text-accent hover:underline"
            >
              Destek
            </a>
          ) : (
            <Link href="/app/ayarlar" className="font-medium text-accent hover:underline">
              Destek için lisans sekmesi
            </Link>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
