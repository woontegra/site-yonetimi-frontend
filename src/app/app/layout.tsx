import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { SiteOnboardingGate } from "@/components/layout/SiteOnboardingGate";
import { SiteSetupProvider } from "@/components/setup/SiteSetupProvider";
import { ActiveSiteProvider } from "@/lib/active-site-context";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ActiveSiteProvider>
        <SiteSetupProvider>
          <AppShell>
            <SiteOnboardingGate>{children}</SiteOnboardingGate>
          </AppShell>
        </SiteSetupProvider>
      </ActiveSiteProvider>
    </AuthGate>
  );
}
