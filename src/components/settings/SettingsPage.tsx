"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailTabs } from "@/components/layout/DetailHeader";
import { SectionCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { Badge } from "@/components/ui/Badge";
import { AssetCategoriesSettings } from "@/components/settings/AssetCategoriesSettings";
import { BankMatchingRulesSettings } from "@/components/settings/BankMatchingRulesSettings";
import { FeedbackCategoriesSettings } from "@/components/settings/FeedbackCategoriesSettings";
import { FinanceDefinitionsSettings } from "@/components/settings/FinanceDefinitionsSettings";
import { LicenseSettings } from "@/components/settings/LicenseSettings";
import { NotificationsSettings } from "@/components/settings/NotificationsSettings";
import { SiteInfoSettings } from "@/components/settings/SiteInfoSettings";
import { SystemInfoSettings } from "@/components/settings/SystemInfoSettings";

type SettingsTab =
  | "site"
  | "license"
  | "finance"
  | "notifications"
  | "categories"
  | "system";

const TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: "site", label: "Site Bilgileri" },
  { id: "license", label: "Lisans ve Abonelik" },
  { id: "finance", label: "Finans Ayarları" },
  { id: "notifications", label: "Bildirim ve İletişim" },
  { id: "categories", label: "Kategoriler ve Tanımlar" },
  { id: "system", label: "Sistem Bilgileri" },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("site");

  return (
    <PageContainer>
      <PageHeader
        title="Ayarlar"
        description="Site bilgilerini, aboneliğinizi ve uygulama tercihlerinizi yönetin."
      />

      <DetailTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "site" ? (
        <SurfaceCard>
          <SiteInfoSettings />
        </SurfaceCard>
      ) : null}

      {tab === "license" ? <LicenseSettings /> : null}

      {tab === "finance" ? (
        <div className="space-y-4">
          <SectionCard
            title="Gider türleri"
            description="Gider kaydı oluştururken kullanılan tanımlar."
            action={<Badge tone="brand">Tüm siteler için geçerli</Badge>}
          >
            <FinanceDefinitionsSettings />
          </SectionCard>
          <SectionCard
            title="Banka eşleştirme kuralları"
            description="Banka hareketlerini daire veya kişiye otomatik bağlamak için kullanılır."
            action={<Badge>Seçili siteye özel</Badge>}
          >
            <BankMatchingRulesSettings />
          </SectionCard>
        </div>
      ) : null}

      {tab === "notifications" ? <NotificationsSettings /> : null}

      {tab === "categories" ? (
        <div className="space-y-4">
          <SectionCard
            title="Demirbaş kategorileri"
            description="Bu alan yalnızca demirbaşları sınıflandırmak için kullanılan kategorileri yönetir. Gerçek demirbaş kayıtları Demirbaşlar sayfasından eklenir."
            action={
              <Link href="/app/demirbaslar" className="text-sm font-medium text-accent hover:underline">
                Demirbaşlara Git
              </Link>
            }
          >
            <AssetCategoriesSettings />
          </SectionCard>
          <SectionCard
            title="Bilgi ve öneri kategorileri"
            description="Bu tanımlar yalnızca bilgi ve öneri kayıtlarını sınıflandırır. Gerçek başvurular Bilgi ve Öneriler sayfasından oluşur."
            action={<Badge tone="brand">Tüm siteler için geçerli</Badge>}
          >
            <FeedbackCategoriesSettings />
          </SectionCard>
        </div>
      ) : null}

      {tab === "system" ? (
        <SurfaceCard>
          <SystemInfoSettings />
        </SurfaceCard>
      ) : null}
    </PageContainer>
  );
}
