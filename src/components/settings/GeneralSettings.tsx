"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { SettingsScopeBadge } from "@/components/settings/SettingsScopeBadge";
import { SiteInfoSettings } from "@/components/settings/SiteInfoSettings";
import {
  SettingsCard,
  SettingsInfoGrid,
  settingsUi,
} from "@/components/settings/settings-ui";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { hasPermission } from "@/lib/permissions";
import { getMySubscription, PLAN_LABELS } from "@/lib/subscription-api";
import { listActiveSites } from "@/lib/sites-api";
import { listTenantUsers } from "@/lib/tenant-users-api";

type SettingsTab =
  | "general"
  | "account"
  | "license"
  | "finance"
  | "notifications"
  | "categories"
  | "users"
  | "about";

const ROLE_FALLBACK: Record<string, string> = {
  ORGANIZASYON_SAHIBI: "Organizasyon sahibi",
  SITE_YONETICISI: "Site yöneticisi",
  YONETIM_PERSONELI: "Yönetim personeli",
  MUHASEBE_PERSONELI: "Muhasebe personeli",
  SINIRLI_YETKILI: "Sınırlı yetkili",
  YONETICI: "Yönetici",
  MUHASEBE: "Muhasebe",
  OPERASYON: "Operasyon",
  GORUNTULEYICI: "Görüntüleyici",
};

type GeneralSettingsProps = {
  onNavigate?: (tab: SettingsTab) => void;
};

export function GeneralSettings({ onNavigate }: GeneralSettingsProps) {
  const { user } = useAuth();
  const { status, siteId } = useActiveSite();
  const auth = useApiAuth({ requireSite: false });
  const canManageUsers = hasPermission(user, "users.view") || !user.permissions?.length;

  const [siteCount, setSiteCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [planLabel, setPlanLabel] = useState<string>("—");
  const [planUndefined, setPlanUndefined] = useState(false);
  const [orgLoading, setOrgLoading] = useState(true);

  const roleLabel = useMemo(() => {
    if (!user.role) return "—";
    return ROLE_FALLBACK[user.role] ?? user.role;
  }, [user.role]);

  const loadOrg = useCallback(async () => {
    if (!auth) {
      setOrgLoading(false);
      return;
    }
    setOrgLoading(true);
    try {
      const [sites, users, license] = await Promise.all([
        listActiveSites(auth).catch(() => ({ items: [] as Array<{ id: string }> })),
        canManageUsers ? listTenantUsers(auth).catch(() => null) : Promise.resolve(null),
        getMySubscription(auth).catch(() => null),
      ]);
      setSiteCount(sites.items.length);
      if (users?.summary) setUserCount(users.summary.active);
      else if (users?.items) setUserCount(users.items.filter((row) => row.status === "ACTIVE").length);
      else setUserCount(null);

      if (license?.access.isPlatformAdmin) {
        setPlanLabel("Platform yönetici erişimi");
        setPlanUndefined(false);
      } else if (license?.subscription) {
        setPlanLabel(PLAN_LABELS[license.subscription.plan]);
        setPlanUndefined(false);
      } else {
        setPlanLabel("Tanımlı değil");
        setPlanUndefined(true);
      }
    } finally {
      setOrgLoading(false);
    }
  }, [auth, canManageUsers]);

  useEffect(() => {
    void loadOrg();
  }, [loadOrg]);

  return (
    <div className={settingsUi.cardsGap}>
      <SettingsCard
        title="Seçili Site"
        description="Bu bilgiler yalnızca seçili site için geçerlidir."
        action={<SettingsScopeBadge scope="site" />}
        accent="teal"
      >
        {status === "noSites" || !siteId ? (
          <EmptyState
            icon={Building2}
            title="Önce bir site seçin."
            description="Üst çubuktan site seçin veya siteler sayfasına gidin."
            action={
              <Link href="/app/siteler" className={settingsUi.btnSecondary}>
                Site Seç
              </Link>
            }
            compact
            className="border-0 bg-transparent px-0 py-3"
          />
        ) : (
          <SiteInfoSettings />
        )}
      </SettingsCard>

      <SettingsCard
        title="Organizasyon"
        description="Hesabınızın tüm sitelerini kapsayan özet."
        action={<SettingsScopeBadge scope="organization" />}
        accent="blue"
      >
        {orgLoading ? (
          <p className={settingsUi.help}>Yükleniyor…</p>
        ) : (
          <SettingsInfoGrid
            items={[
              { label: "Organizasyon", value: user.tenantName ?? "—" },
              { label: "Rolünüz", value: roleLabel },
              { label: "Kullanıcı sayısı", value: userCount === null ? "—" : userCount },
              { label: "Site sayısı", value: siteCount === null ? "—" : siteCount },
              {
                label: "Mevcut plan",
                value: planLabel,
                hint: planUndefined ? (
                  <Badge tone="warning" className="mt-0.5 px-1.5 py-0 text-[11px] font-medium">
                    Plan tanımlı değil
                  </Badge>
                ) : null,
              },
            ]}
          />
        )}
        {onNavigate ? (
          <div className="mt-3">
            <button type="button" className={settingsUi.btnSm} onClick={() => onNavigate("license")}>
              Lisans ve aboneliği görüntüle
            </button>
          </div>
        ) : null}
      </SettingsCard>
    </div>
  );
}
