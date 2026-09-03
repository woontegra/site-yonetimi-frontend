"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { FormField } from "@/components/ui/FormField";
import { mapLoginError } from "@/lib/auth-errors";
import { apiLogin } from "@/lib/api";
import {
  clearSession,
  ensureAuthCookie,
  hasAuthCookie,
  readSession,
  writeSession,
} from "@/lib/session";
import { safeAppReturnPath } from "@/lib/safe-return-path";

export function LoginForm() {
  return (
    <AuthLayout
      title="Hoş geldiniz"
      description="Site yönetim panelinize erişmek için hesabınızla giriş yapın."
    >
      <LoginFields />
    </AuthLayout>
  );
}

function LoginFields() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? searchParams.get("from");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("reason") === "session_expired") {
      setError("Oturumunuz sona erdi. Lütfen yeniden giriş yapın.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (redirectedRef.current) return;
    const existing = readSession();
    if (!existing?.token || existing.user.id === "preview") return;

    // localStorage var, cookie yoksa middleware /app'i tekrar /giris'e atar → yanıp sönme döngüsü.
    ensureAuthCookie();
    if (!hasAuthCookie()) {
      clearSession();
      return;
    }

    redirectedRef.current = true;
    window.location.replace(safeAppReturnPath(nextPath));
  }, [nextPath]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    try {
      const result = await apiLogin(email, password);
      writeSession({
        token: result.token,
        refreshToken: result.refreshToken ?? null,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          tenantId: result.user.tenants?.[0]?.id,
          tenantName: result.user.tenants?.[0]?.name,
          isPlatformAdmin: Boolean(result.user.isPlatformAdmin),
          role: result.user.tenants?.[0]?.role,
          permissions: result.user.tenants?.[0]?.permissions ?? [],
          allSites: result.user.tenants?.[0]?.allSites ?? true,
          siteIds: result.user.tenants?.[0]?.siteIds ?? null,
        },
      });
      window.location.assign(safeAppReturnPath(nextPath));
    } catch (err) {
      setError(mapLoginError(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="relative z-10 space-y-1" autoComplete="on">
      <FormField label="E-posta" htmlFor="login-email" required>
        <input
          ref={emailRef}
          id="login-email"
          name="username"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="ornek@sirket.com"
          className="auth-native-input"
          required
        />
      </FormField>
      <FormField label="Şifre" htmlFor="login-password" required>
        <AuthPasswordField
          ref={passwordRef}
          id="login-password"
          name="password"
          autoComplete="current-password"
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          required
        />
      </FormField>
      {capsLock ? <p className="pb-2 text-[12px] text-warning">Caps Lock açık.</p> : <div className="h-[18px]" />}
      {error ? <p className="pb-2 text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={pending} className="auth-submit mt-1 flex w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-70">
        {pending ? (
          <>
            <span className="auth-spinner" aria-hidden />
            Giriş yapılıyor...
          </>
        ) : (
          "Giriş Yap"
        )}
      </button>
    </form>
  );
}
