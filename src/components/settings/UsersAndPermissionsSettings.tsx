"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { SettingsScopeBadge } from "@/components/settings/SettingsScopeBadge";
import {
  SettingsCard,
  SettingsInfoGrid,
  settingsUi,
} from "@/components/settings/settings-ui";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { hasPermission } from "@/lib/permissions";
import { listTenantUsers, type TenantMember } from "@/lib/tenant-users-api";
import { formatDateTr } from "@/lib/money";

export function UsersAndPermissionsSettings() {
  const { user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const canView = hasPermission(user, "users.view") || !user.permissions?.length;
  const canInvite =
    hasPermission(user, "users.invite") ||
    hasPermission(user, "users.manage") ||
    !user.permissions?.length;

  const [summary, setSummary] = useState({ total: 0, active: 0, invited: 0, disabled: 0 });
  const [latest, setLatest] = useState<TenantMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await listTenantUsers(auth);
      const items = result.items ?? [];
      setSummary(
        result.summary ?? {
          total: items.length,
          active: items.filter((row) => row.status === "ACTIVE").length,
          invited: items.filter((row) => row.status === "INVITED" || row.status === "EXPIRED").length,
          disabled: items.filter((row) => row.status === "DISABLED").length,
        },
      );
      const sorted = [...items].sort((a, b) => {
        const aDate = a.invitedAt || a.createdAt || "";
        const bDate = b.invitedAt || b.createdAt || "";
        return bDate.localeCompare(aDate);
      });
      setLatest(sorted[0] ?? null);
    } catch {
      setError("Kullanıcı özeti yüklenemedi.");
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, [auth, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <SettingsCard
        title="Kullanıcılar ve yetkiler"
        description="Bu bölümü görüntüleme yetkiniz yok."
        action={<SettingsScopeBadge scope="organization" />}
        accent="teal"
      >
        <p className={settingsUi.help}>
          Yalnız kendi profilinizi Hesabım ve Güvenlik sekmesinden yönetebilirsiniz.
        </p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Kullanıcı özeti"
      description="Organizasyon kullanıcıları ayrı sayfada yönetilir; burada yalnızca özet gösterilir."
      action={<SettingsScopeBadge scope="organization" />}
      accent="teal"
    >
      {loading ? <p className={settingsUi.help}>Yükleniyor…</p> : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!loading && !error ? (
        <SettingsInfoGrid
          items={[
            { label: "Aktif kullanıcı", value: summary.active },
            { label: "Bekleyen davet", value: summary.invited },
            { label: "Toplam", value: summary.total },
            { label: "Pasif", value: summary.disabled },
          ]}
        />
      ) : null}
      {latest ? (
        <p className={`${settingsUi.help} mt-3`}>
          Son eklenen: <span className="text-ink">{latest.fullName}</span>
          {latest.invitedAt || latest.createdAt
            ? ` · ${formatDateTr(latest.invitedAt || latest.createdAt)}`
            : null}
          {latest.roleLabel ? ` · ${latest.roleLabel}` : null}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canInvite ? (
          <Link href="/app/ayarlar/kullanicilar?invite=1" className={settingsUi.btnPrimary}>
            <UserPlus className="size-3.5" aria-hidden />
            Yeni Kullanıcı Davet Et
          </Link>
        ) : null}
        <Link href="/app/ayarlar/kullanicilar" className={settingsUi.btnSecondary}>
          Kullanıcıları ve Yetkileri Yönet
        </Link>
      </div>
    </SettingsCard>
  );
}
