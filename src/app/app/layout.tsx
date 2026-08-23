import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteOnboardingGate } from "@/components/layout/SiteOnboardingGate";
import { SiteSetupProvider } from "@/components/setup/SiteSetupProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ActiveSiteProvider } from "@/lib/active-site-context";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ActiveSiteProvider>
        <SiteSetupProvider>
          <AppShell>
            <SiteOnboardingGate>{children}</SiteOnboardingGate>
          </AppShell>
        </SiteSetupProvider>
      </ActiveSiteProvider>
    </ToastProvider>
  );
}
