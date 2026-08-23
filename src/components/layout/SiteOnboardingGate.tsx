"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useActiveSite } from "@/lib/active-site-context";
import { Button } from "@/components/ui/Button";

export function SiteOnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, bootstrapError, refreshSites, hasSites } = useActiveSite();

  const onSitesRoute = pathname === "/app/siteler" || pathname.startsWith("/app/siteler/");
  const onAdminRoute = pathname === "/app/admin" || pathname.startsWith("/app/admin/");

  if (onSitesRoute || onAdminRoute) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="px-6 py-10 text-sm text-muted">
        {bootstrapError ? (
          <div className="flex max-w-lg flex-col items-start gap-3">
            <p className="text-danger">{bootstrapError}</p>
            <Button type="button" variant="secondary" onClick={() => void refreshSites()}>
              Tekrar dene
            </Button>
          </div>
        ) : (
          "Yükleniyor…"
        )}
      </div>
    );
  }

  // Gerçekten 0 aktif site — onboarding. Site var ama seçilmemiş durumu burada olamaz.
  if (status === "noSites" || !hasSites) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-ink">İlk sitenizi oluşturun</h1>
        <p className="text-sm text-muted">
          Bina ve daire yönetimine başlamak için önce bir site oluşturmanız gerekiyor.
        </p>
        <Link href="/app/siteler">
          <Button type="button">
            <Plus className="size-4" />
            Site Oluştur
          </Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
