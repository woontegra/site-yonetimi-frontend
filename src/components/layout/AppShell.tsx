"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { UserMenu } from "@/components/layout/UserMenu";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 h-[60px] border-b border-line bg-white">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-ink hover:bg-canvas md:hidden"
            aria-label="Menüyü aç"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          <Logo className="shrink-0" />

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <TopNavigation />
          </div>

          <div className="ml-auto flex items-center">
            <UserMenu />
          </div>
        </div>
      </header>

      <MobileNavDrawer open={mobileOpen} onClose={closeMobile} />

      <main>{children}</main>
    </div>
  );
}
