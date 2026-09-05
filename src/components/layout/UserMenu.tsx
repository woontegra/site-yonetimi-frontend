"use client";

import { useEffect, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Settings, UserRound, Users } from "lucide-react";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  changeMyPassword,
  mergeAccountUserIntoSession,
  updateMyProfile,
} from "@/lib/account-api";
import { apiLogout } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { clearSession, readSession, writeSession } from "@/lib/session";

const ROLE_FALLBACK: Record<string, string> = {
  ORGANIZASYON_SAHIBI: "Organizasyon sahibi",
  SITE_YONETICISI: "Site yöneticisi",
  YONETIM_PERSONELI: "Yönetim personeli",
  MUHASEBE_PERSONELI: "Muhasebe personeli",
  SINIRLI_YETKILI: "Sınırlı yetkili",
  YONETICI: "Yönetici",
  MUHASEBE: "Muhasebe",
  OPERASYON: "Operasyon",
  GORUNTULEYICI: "Görüntüleyici",
};

export function UserMenu() {
  const { user, token } = useAuth();
  const { showToast, toastError } = useToast();
  const canUsers =
    hasPermission(user, "users.view") ||
    hasPermission(user, "users.manage") ||
    !user.permissions?.length;

  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profileOpen) setFullName(user.fullName ?? "");
  }, [profileOpen, user.fullName]);

  async function handleLogout() {
    if (token) {
      await apiLogout(token);
    }
    clearSession();
    window.location.assign("/giris");
  }

  async function saveProfile() {
    if (!token || profilePending) return;
    const trimmed = fullName.trim();
    if (trimmed.length < 2) {
      setProfileError("Ad soyad en az 2 karakter olmalıdır.");
      return;
    }
    setProfilePending(true);
    setProfileError("");
    try {
      const result = await updateMyProfile({ token }, { fullName: trimmed });
      const session = readSession();
      if (session) {
        writeSession({
          ...session,
          user: mergeAccountUserIntoSession(session.user, result.user),
        });
      }
      showToast("Profil bilgileriniz güncellendi.");
      setProfileOpen(false);
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : "Profil güncellenemedi.");
      toastError(error, "Profil güncellenemedi.");
    } finally {
      setProfilePending(false);
    }
  }

  async function savePassword() {
    if (!token || passwordPending) return;
    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = "Mevcut şifre gerekli.";
    if (
      newPassword.length < 8 ||
      !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      next.newPassword = "Şifre en az 8 karakter olmalı ve harf ile rakam içermelidir.";
    }
    if (newPassword !== confirmPassword) next.confirmPassword = "Yeni şifreler eşleşmiyor.";
    setPasswordErrors(next);
    if (Object.keys(next).length) return;

    setPasswordPending(true);
    try {
      await changeMyPassword(
        { token },
        { currentPassword, newPassword, confirmPassword },
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Şifreniz başarıyla değiştirildi.");
      setPasswordOpen(false);
    } catch (error) {
      toastError(error, "Şifre değiştirilemedi.");
    } finally {
      setPasswordPending(false);
    }
  }

  const roleLabel = user.role ? ROLE_FALLBACK[user.role] ?? user.role : "—";

  return (
    <>
      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="flex max-w-[220px] items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-canvas"
            aria-haspopup="menu"
            aria-label="Kullanıcı menüsü"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[11px] font-medium text-accent">
              {user.fullName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden truncate font-normal lg:inline">{user.fullName}</span>
            <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </button>
        }
      >
        <DropdownItem onClick={() => setProfileOpen(true)}>
          <UserRound className="size-4 text-muted" aria-hidden />
          Profilim
        </DropdownItem>
        <DropdownItem onClick={() => setPasswordOpen(true)}>
          <KeyRound className="size-4 text-muted" aria-hidden />
          Şifre Değiştir
        </DropdownItem>
        {canUsers ? (
          <DropdownItem href="/app/ayarlar/kullanicilar">
            <Users className="size-4 text-muted" aria-hidden />
            Kullanıcılar ve Yetkiler
          </DropdownItem>
        ) : null}
        <DropdownItem href="/app/ayarlar">
          <Settings className="size-4 text-muted" aria-hidden />
          Ayarlar
        </DropdownItem>
        <DropdownItem danger onClick={() => void handleLogout()}>
          <LogOut className="size-4" aria-hidden />
          Çıkış
        </DropdownItem>
      </Dropdown>

      <FormModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Profilim"
        description="Hesap bilgilerinizi güncelleyin."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setProfileOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={profilePending} onClick={() => void saveProfile()}>
              {profilePending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Ad soyad" htmlFor="menu-full-name" required error={profileError}>
            <Input
              id="menu-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />
          </FormField>
          <FormField label="E-posta" htmlFor="menu-email" hint="E-posta salt okunur.">
            <Input id="menu-email" value={user.email} readOnly disabled />
          </FormField>
          <FormField label="Rol" htmlFor="menu-role">
            <Input id="menu-role" value={roleLabel} readOnly disabled />
          </FormField>
          <FormField label="Organizasyon" htmlFor="menu-org">
            <Input id="menu-org" value={user.tenantName ?? "—"} readOnly disabled />
          </FormField>
        </div>
      </FormModal>

      <FormModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Şifre Değiştir"
        description="En az 8 karakter; en az bir harf ve bir rakam."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPasswordOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={passwordPending} onClick={() => void savePassword()}>
              {passwordPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField
            label="Mevcut şifre"
            htmlFor="menu-current-password"
            required
            error={passwordErrors.currentPassword}
          >
            <AuthPasswordField
              id="menu-current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="h-control rounded-md border border-line bg-surface px-2.5 text-[13px]"
            />
          </FormField>
          <FormField
            label="Yeni şifre"
            htmlFor="menu-new-password"
            required
            error={passwordErrors.newPassword}
          >
            <AuthPasswordField
              id="menu-new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="h-control rounded-md border border-line bg-surface px-2.5 text-[13px]"
            />
          </FormField>
          <FormField
            label="Yeni şifre tekrar"
            htmlFor="menu-confirm-password"
            required
            error={passwordErrors.confirmPassword}
          >
            <AuthPasswordField
              id="menu-confirm-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="h-control rounded-md border border-line bg-surface px-2.5 text-[13px]"
            />
          </FormField>
          <p className="text-caption text-muted">
            Oturumlar JWT ile yönetilir; cihaz oturum listesi olmadığı için “diğer oturumları kapat”
            seçeneği sunulmaz.
          </p>
        </div>
      </FormModal>
    </>
  );
}
