"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { redirectToLoginForExpiredSession } from "@/lib/auth-refresh";

/** Auth bootstrap bitmeden /app içeriğini gösterme. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      redirectToLoginForExpiredSession();
    }
  }, [status]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-sm text-muted">
        Oturum doğrulanıyor…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-sm text-muted">
        Giriş sayfasına yönlendiriliyorsunuz…
      </div>
    );
  }

  return <>{children}</>;
}
