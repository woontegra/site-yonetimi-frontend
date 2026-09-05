import { Badge } from "@/components/ui/Badge";

export type SettingsScope = "account" | "organization" | "site";

const LABELS: Record<SettingsScope, string> = {
  account: "Hesabınıza özel",
  organization: "Tüm organizasyon için",
  site: "Siteye özel",
};

export function SettingsScopeBadge({ scope }: { scope: SettingsScope }) {
  return (
    <Badge tone="neutral" className="px-1.5 py-0 text-[11px] font-medium leading-5">
      {LABELS[scope]}
    </Badge>
  );
}

export function settingsScopeLabel(scope: SettingsScope): string {
  return LABELS[scope];
}
