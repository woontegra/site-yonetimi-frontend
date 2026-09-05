"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";
import { AppSidebar, persistSidebarCollapsed, readSidebarCollapsed } from "@/components/layout/AppSidebar";
import { SiteSelector } from "@/components/layout/SiteSelector";
import { UserMenu } from "@/components/layout/UserMenu";
import { LicenseBanner } from "@/components/layout/LicenseBanner";
import { SetupIncompleteBanner } from "@/components/setup/SetupIncompleteBanner";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite } from "@/lib/active-site-context";

function SiteScopedMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { siteId } = useActiveSite();
  const keepMounted =
    pathname === "/app/siteler" ||
    pathname.startsWith("/app/siteler/") ||
    pathname.startsWith("/app/admin");
  const scopeKey = keepMounted ? "shared" : siteId ?? "none";
  return (
    <div key={scopeKey} className="contents">
      {children}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, user } = useAuth();
  const adminMode = ready && Boolean(user.isPlatformAdmin) && pathname.startsWith("/app/admin");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setCollapsed(readSidebarCollapsed());
  }, []);

  function handleCollapsedChange(next: boolean) {
    setCollapsed(next);
    persistSidebarCollapsed(next);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, closeMobile]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-canvas lg:flex">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface lg:flex",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        <AppSidebar
          collapsed={collapsed}
          onCollapsedChange={handleCollapsedChange}
          adminMode={adminMode}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Menüyü kapat"
            onClick={closeMobile}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobil menü"
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-modal"
          >
            <AppSidebar
              collapsed={false}
              onCollapsedChange={handleCollapsedChange}
              mobile
              onNavigate={closeMobile}
              adminMode={adminMode}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 h-header min-w-0 border-b border-line bg-surface">
          <div className="flex h-full min-w-0 items-center gap-2 px-4 lg:px-6 xl:px-8">
            <button
              type="button"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink hover:bg-canvas lg:hidden"
              aria-label="Menüyü aç"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>

            {adminMode ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">Platform Yönetimi</p>
                  <p className="hidden truncate text-caption text-muted sm:block">Yönetim Merkezi</p>
                </div>
                <Link
                  href="/app"
                  className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[13px] font-normal text-ink hover:bg-canvas"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  <span className="sm:hidden">Siteye Dön</span>
                  <span className="hidden sm:inline">Site Yönetimine Dön</span>
                </Link>
              </div>
            ) : (
              <SiteSelector className="min-w-0 flex-1" />
            )}

            <div className={cn("flex shrink-0 items-center", !adminMode && "ml-auto")}>
              <UserMenu />
            </div>
          </div>
        </header>

        {adminMode ? null : (
          <>
            <LicenseBanner />
            <SetupIncompleteBanner />
          </>
        )}

        <main className="min-w-0 w-full flex-1">
          <SiteScopedMain>{children}</SiteScopedMain>
        </main>
      </div>
    </div>
  );
}
