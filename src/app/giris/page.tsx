"use client";

import { FormEvent, useState } from "react";
import { apiLogin } from "@/lib/api";
import { writeSession } from "@/lib/session";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export default function GirisPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await apiLogin(email.trim(), password);
      writeSession({
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          tenantId: result.user.tenants?.[0]?.id,
          tenantName: result.user.tenants?.[0]?.name,
          isPlatformAdmin: Boolean(result.user.isPlatformAdmin),
        },
      });
      window.location.href = "/app";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-panel">
        <p className="text-caption text-muted">Woontegra</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Site Yönetimi</h1>
        <p className="mt-1 mb-5 text-sm text-muted">Hesabınıza giriş yapın.</p>
        <div className="space-y-3">
          <FormField label="E-posta" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </FormField>
          <FormField label="Şifre" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </FormField>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </div>
      </form>
    </main>
  );
}
