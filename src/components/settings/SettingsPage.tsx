"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  IdCard,
  Info,
  Landmark,
  MessageCircle,
  Shield,
  Tags,
  Users,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Select } from "@/components/ui/Select";
import { AboutSettings } from "@/components/settings/AboutSettings";
import { AccountSecuritySettings } from "@/components/settings/AccountSecuritySettings";
import { AssetCategoriesSettings } from "@/components/settings/AssetCategoriesSettings";
import { BankMatchingRulesSummary } from "@/components/settings/BankMatchingRulesSummary";
import { FeedbackCategoriesSettings } from "@/components/settings/FeedbackCategoriesSettings";
import { FinanceDefinitionsSettings } from "@/components/settings/FinanceDefinitionsSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { LicenseSettings } from "@/components/settings/LicenseSettings";
import { NotificationsSettings } from "@/components/settings/NotificationsSettings";
import { SettingsScopeBadge } from "@/components/settings/SettingsScopeBadge";
import {
  SettingsCard,
  SettingsPageHeader,
  SettingsTabs,
  settingsUi,
} from "@/components/settings/settings-ui";
import { UsersAndPermissionsSettings } from "@/components/settings/UsersAndPermissionsSettings";
import { useAuth } from "@/lib/auth-context";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

type SettingsTab =
  | "general"
  | "account"
  | "license"
  | "finance"
  | "notifications"
  | "categories"
  | "users"
  | "about";

const ALL_TABS: ReadonlyArray<{ id: SettingsTab; label: string; icon: LucideIcon }> = [
  { id: "general", label: "Genel", icon: Building2 },
  { id: "account", label: "Hesabım ve Güvenlik", icon: Shield },
  { id: "license", label: "Lisans ve Abonelik", icon: IdCard },
  { id: "finance", label: "Finans", icon: Landmark },
  { id: "notifications", label: "Bildirimler ve İletişim", icon: MessageCircle },
  { id: "categories", label: "Kategoriler", icon: Tags },
  { id: "users", label: "Kullanıcılar ve Yetkiler", icon: Users },
  { id: "about", label: "Hakkında", icon: Info },
];

function useVisibleTabs() {
  const { user } = useAuth();
  const emptyPerms = !user.permissions?.length;
  const canFinance =
    emptyPerms || hasAnyPermission(user, ["expenses.view", "expenses.manage", "banks.view"]);
  const canUsers = emptyPerms || hasPermission(user, "users.view");
  const canSettings = emptyPerms || hasPermission(user, "siteSettings.manage");

  return ALL_TABS.filter((tab) => {
    if (tab.id === "finance") return canFinance;
    if (tab.id === "users") return canUsers;
    if (tab.id === "license" || tab.id === "notifications" || tab.id === "categories") {
      return canSettings || emptyPerms;
    }
    return true;
  });
}

function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value && ALL_TABS.some((tab) => tab.id === value));
}

export function SettingsPage() {
  const tabs = useVisibleTabs();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams.get("tab");
  const [tab, setTab] = useState<SettingsTab>(() =>
    isSettingsTab(tabFromQuery) ? tabFromQuery : "general",
  );

  useEffect(() => {
    if (isSettingsTab(tabFromQuery)) setTab(tabFromQuery);
  }, [tabFromQuery]);

  const activeTab = tabs.some((item) => item.id === tab) ? tab : tabs[0]?.id ?? "general";
  return (
    <PageContainer className="py-4 lg:py-5">
      <SettingsPageHeader
        title="Ayarlar"
        description="Hesap, organizasyon ve seçili site ayarlarını yönetin."
      />

      <div className="mb-3 md:hidden">
        <label htmlFor="settings-tab-select" className="sr-only">
          Ayarlar sekmesi
        </label>
        <Select
          id="settings-tab-select"
          value={activeTab}
          className="h-9 text-[13px]"
          onChange={(event) => setTab(event.target.value as SettingsTab)}
        >
          {tabs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="hidden md:block">
        <SettingsTabs tabs={tabs} value={activeTab} onChange={setTab} />
      </div>

      {activeTab === "general" ? <GeneralSettings onNavigate={setTab} /> : null}
      {activeTab === "account" ? <AccountSecuritySettings /> : null}

      {activeTab === "license" ? (
        <SettingsCard
          title="Lisans ve abonelik"
          description="Lisans organizasyona aittir; seçili siteye bağlı değildir."
          action={<SettingsScopeBadge scope="organization" />}
          accent="amber"
        >
          <LicenseSettings />
        </SettingsCard>
      ) : null}

      {activeTab === "finance" ? (
        <div className={settingsUi.cardsGap}>
          <SettingsCard
            title="Gider kategorileri"
            description="Elektrik, su, bakım ve benzeri giderleri raporlarda sınıflandırmak için kullanılır."
            action={<SettingsScopeBadge scope="organization" />}
            accent="green"
          >
            <FinanceDefinitionsSettings />
          </SettingsCard>
          <SettingsCard
            title="Banka eşleştirme kuralları"
            description="Ana yönetim Banka sayfasındadır."
            action={<SettingsScopeBadge scope="site" />}
            accent="cyan"
          >
            <BankMatchingRulesSummary />
          </SettingsCard>
        </div>
      ) : null}

      {activeTab === "notifications" ? <NotificationsSettings /> : null}

      {activeTab === "categories" ? (
        <div className={settingsUi.cardsGap}>
          <SettingsCard
            title="Demirbaş kategorileri"
            description="Demirbaşları gruplamak için kullanılır. Gerçek demirbaş kaydı oluşturmaz."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <SettingsScopeBadge scope="organization" />
                <Link href="/app/demirbaslar" className="text-[12px] font-medium text-accent hover:underline">
                  Demirbaşlara Git
                </Link>
              </div>
            }
            accent="amber"
          >
            <AssetCategoriesSettings />
          </SettingsCard>
          <SettingsCard
            title="Bilgi ve öneri kategorileri"
            description="Talep ve önerileri sınıflandırmak için kullanılır. Gerçek başvuru oluşturmaz."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <SettingsScopeBadge scope="organization" />
                <Link href="/app/bilgi-oneri" className="text-[12px] font-medium text-accent hover:underline">
                  Bilgi ve Önerilere Git
                </Link>
              </div>
            }
            accent="blue"
          >
            <FeedbackCategoriesSettings />
          </SettingsCard>
        </div>
      ) : null}

      {activeTab === "users" ? <UsersAndPermissionsSettings /> : null}
      {activeTab === "about" ? <AboutSettings /> : null}
    </PageContainer>
  );
}
