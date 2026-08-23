"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiActivate, apiPeekActivation } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

const REASON_MESSAGES: Record<string, string> = {
  invalid: "Aktivasyon bağlantısı geçersiz.",
  used: "Bu bağlantı daha önce kullanılmış.",
  expired: "Bu bağlantının süresi dolmuş. Yeni bir davet e-postası isteyin.",
  already_activated: "Bu hesap zaten etkinleştirilmiş. Giriş yapabilirsiniz.",
};

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password),
    number: /\d/.test(password),
  };
}

function ActivationForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [reason, setReason] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setValid(false);
        setReason("invalid");
        setLoading(false);
        return;
      }
      const result = await apiPeekActivation(token);
      if (cancelled) return;
      setValid(result.valid);
      setReason(result.reason ?? "invalid");
      setFullName(result.fullName ?? "");
      setEmailMasked(result.emailMasked ?? "");
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!checks.length || !checks.letter || !checks.number) {
      setError("Şifre en az 8 karakter olmalı ve harf ile rakam içermelidir.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await apiActivate(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hesap etkinleştirilemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-panel">
        <p className="text-caption text-muted">Woontegra</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Site Yönetimi</h1>
        <p className="mt-1 text-sm text-muted">Hesabınızı etkinleştirin</p>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Kontrol ediliyor…</p>
        ) : success ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink">Hesabınız etkinleştirildi. Artık giriş yapabilirsiniz.</p>
            <Link href="/giris">
              <Button type="button" className="w-full">
                Giriş Yap
              </Button>
            </Link>
          </div>
        ) : !valid ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-danger">{REASON_MESSAGES[reason] ?? REASON_MESSAGES.invalid}</p>
            {reason === "already_activated" ? (
              <Link href="/giris">
                <Button type="button" variant="secondary" className="w-full">
                  Giriş Yap
                </Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
            <p className="text-sm text-muted">
              {fullName}
              {emailMasked ? ` · ${emailMasked}` : ""}
            </p>
            <FormField label="Yeni şifre" required hint="En az 8 karakter, harf ve rakam. Şifre e-posta ile gönderilmez.">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>
            <ul className="space-y-1 text-[12px] text-muted">
              <li className={checks.length ? "text-ink" : ""}>En az 8 karakter</li>
              <li className={checks.letter ? "text-ink" : ""}>En az bir harf</li>
              <li className={checks.number ? "text-ink" : ""}>En az bir rakam</li>
            </ul>
            <FormField label="Şifre tekrar" required>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Kaydediliyor…" : "Şifremi Oluştur ve Hesabımı Etkinleştir"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function AktivasyonPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted">Yükleniyor…</main>}>
      <ActivationForm />
    </Suspense>
  );
}
