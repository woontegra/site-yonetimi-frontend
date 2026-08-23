"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user.isPlatformAdmin) {
      router.replace("/app");
    }
  }, [ready, user.isPlatformAdmin, router, pathname]);

  if (!ready) {
    return <div className="px-6 py-10 text-sm text-muted">Yükleniyor…</div>;
  }

  if (!user.isPlatformAdmin) {
    return <div className="px-6 py-10 text-sm text-muted">Bu alana erişim yetkiniz yok.</div>;
  }

  return <>{children}</>;
}
