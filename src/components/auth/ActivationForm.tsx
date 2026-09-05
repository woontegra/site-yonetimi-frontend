"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { FormField } from "@/components/ui/FormField";
import { apiActivate, apiPeekActivation } from "@/lib/api";

const REASON_COPY: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "Bağlantı geçersiz",
    body: "Aktivasyon bağlantısı eksik veya geçersiz. Yeni bir davet e-postası isteyin.",
  },
  used: {
    title: "Bağlantı kullanılmış",
    body: "Bu aktivasyon bağlantısı daha önce kullanılmış. Giriş yapmayı deneyin veya yeni davet isteyin.",
  },
  expired: {
    title: "Bağlantının süresi dolmuş",
    body: "Aktivasyon bağlantısının süresi dolmuş. Hesabınız için yeni bir davet e-postası isteyin.",
  },
  already_activated: {
    title: "Hesap zaten etkin",
    body: "Bu hesap daha önce etkinleştirilmiş. Giriş ekranından devam edebilirsiniz.",
  },
  stripped: {
    title: "Bağlantı bu oturumda yok",
    body: "Güvenli aktivasyon bağlantısı artık bu sayfada bulunmuyor. Lütfen e-postanızdaki bağlantıyı yeniden açın.",
  },
};

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password),
    number: /\d/.test(password),
  };
}

/** Hash (#token=) öncelikli; eski ?token= uyumluluğu. URL hemen temizlenir. */
function takeActivationTokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;

  let token = "";
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    token = (hashParams.get("token") ?? "").trim();
  }
  if (!token) {
    const queryParams = new URLSearchParams(window.location.search);
    token = (queryParams.get("token") ?? "").trim();
  }

  // Query + hash temizle; back ile tokenlı URL geri gelmesin.
  window.history.replaceState(null, "", "/aktivasyon");

  return token || null;
}

export function ActivationForm() {
  const tokenRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [reason, setReason] = useState("invalid");
  const [fullName, setFullName] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const copy = REASON_COPY[reason] ?? REASON_COPY.invalid;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = takeActivationTokenFromLocation();
      if (!token) {
        if (!cancelled) {
          tokenRef.current = null;
          setValid(false);
          setReason("stripped");
          setLoading(false);
        }
        return;
      }

      tokenRef.current = token;
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
  }, []);

  function clearTokenMemory() {
    tokenRef.current = null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const token = tokenRef.current;
    if (!token) {
      setValid(false);
      setReason("stripped");
      setError("");
      return;
    }
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
      clearTokenMemory();
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hesap etkinleştirilemedi.";
      // Token değerini hata metnine asla ekleme.
      setError(message.replace(/[A-Fa-f0-9]{32,}/g, "[redacted]"));
      clearTokenMemory();
      setValid(false);
      setReason("invalid");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout title="Hesabınızı etkinleştirin" description="Bağlantınız kontrol ediliyor.">
        <p className="text-sm text-muted">Lütfen bekleyin…</p>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Hesabınız etkinleştirildi." description="Artık giriş yapabilirsiniz.">
        <div className="flex flex-col items-center text-center">
          <svg className="auth-success-mark auth-motion" viewBox="0 0 52 52" aria-hidden>
            <circle cx="26" cy="26" r="24" />
            <path d="M16 27 l7 7 l14 -16" />
          </svg>
          <Link
            href="/giris"
            className="auth-submit mt-6 flex w-full items-center justify-center text-sm font-medium text-white"
          >
            Giriş Yap
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!valid) {
    return (
      <AuthLayout title={copy.title} description={copy.body}>
        <div className="flex items-start gap-2 rounded-xl bg-danger-subtle px-3 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Destek ihtiyacınız olursa site yöneticinizle iletişime geçin.</p>
        </div>
        <Link
          href="/giris"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium text-ink"
        >
          Giriş ekranına dön
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Hesabınızı etkinleştirin"
      description="Hesabınızı kullanmaya başlamak için güvenli bir şifre oluşturun."
    >
      {fullName || emailMasked ? (
        <p className="mb-4 text-sm text-muted">
          {fullName}
          {emailMasked ? ` · ${emailMasked}` : ""}
        </p>
      ) : null}
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-1" autoComplete="off">
        <FormField label="Yeni şifre" htmlFor="activate-password" required>
          <AuthPasswordField
            id="activate-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FormField>
        <ul className="space-y-1 pb-2 text-[12px] text-muted">
          <li className={checks.length ? "text-success" : ""}>
            <Check className="mr-1 inline size-3.5" aria-hidden />
            En az 8 karakter
          </li>
          <li className={checks.letter ? "text-success" : ""}>
            <Check className="mr-1 inline size-3.5" aria-hidden />
            En az bir harf
          </li>
          <li className={checks.number ? "text-success" : ""}>
            <Check className="mr-1 inline size-3.5" aria-hidden />
            En az bir rakam
          </li>
        </ul>
        <FormField label="Yeni şifre tekrar" htmlFor="activate-confirm" required>
          <AuthPasswordField
            id="activate-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </FormField>
        {error ? <p className="pb-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="auth-submit mt-1 flex w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-70"
        >
          {pending ? (
            <>
              <span className="auth-spinner" aria-hidden />
              Kaydediliyor...
            </>
          ) : (
            "Oluştur / Etkinleştir"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
