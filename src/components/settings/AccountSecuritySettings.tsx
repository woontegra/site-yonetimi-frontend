"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBadge } from "@/components/settings/SettingsScopeBadge";
import {
  SettingsActionRow,
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPasswordInput,
  settingsUi,
} from "@/components/settings/settings-ui";
import {
  changeMyPassword,
  mergeAccountUserIntoSession,
  updateMyProfile,
} from "@/lib/account-api";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/http";
import { readSession, writeSession } from "@/lib/session";

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

export function AccountSecuritySettings() {
  const { user, token } = useAuth();
  const { showToast, toastError } = useToast();

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFullName(user.fullName ?? "");
  }, [user.fullName]);

  const roleLabel = useMemo(() => {
    if (!user.role) return "—";
    return ROLE_FALLBACK[user.role] ?? user.role;
  }, [user.role]);

  const accessSummary = useMemo(() => {
    const org = user.tenantName ?? "Organizasyon";
    if (user.allSites) return `${org} · Tüm siteler`;
    const count = user.siteIds?.length ?? 0;
    return `${org} · ${count} site erişimi`;
  }, [user.allSites, user.siteIds, user.tenantName]);

  const profileDirty = fullName.trim() !== (user.fullName ?? "").trim();

  async function handleProfileSave(event: FormEvent) {
    event.preventDefault();
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
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : "Profil güncellenemedi.");
      toastError(error, "Profil güncellenemedi.");
    } finally {
      setProfilePending(false);
    }
  }

  const validatePassword = useCallback(() => {
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
    return Object.keys(next).length === 0;
  }, [confirmPassword, currentPassword, newPassword]);

  async function handlePasswordSave(event: FormEvent) {
    event.preventDefault();
    if (!token || passwordPending) return;
    if (!validatePassword()) return;
    setPasswordPending(true);
    try {
      await changeMyPassword(
        { token },
        { currentPassword, newPassword, confirmPassword },
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordErrors({});
      showToast("Şifreniz başarıyla değiştirildi.");
    } catch (error) {
      toastError(error, "Şifre değiştirilemedi.");
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <div className={settingsUi.cardsGap}>
      <SettingsCard
        title="Profil"
        description="Kişisel hesap bilgileriniz."
        action={<SettingsScopeBadge scope="account" />}
        accent="violet"
      >
        <form onSubmit={(event) => void handleProfileSave(event)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SettingsField
              label="Ad soyad"
              htmlFor="account-full-name"
              required
              error={profileError}
            >
              <SettingsInput
                id="account-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </SettingsField>
            <SettingsField
              label="E-posta"
              htmlFor="account-email"
              hint="Salt okunur — güvenli e-posta değişikliği henüz yok."
            >
              <SettingsInput id="account-email" value={user.email} readOnly disabled />
            </SettingsField>
            <SettingsField label="Rol" htmlFor="account-role">
              <SettingsInput id="account-role" value={roleLabel} readOnly disabled />
            </SettingsField>
            <SettingsField label="Organizasyon / site erişimi" htmlFor="account-access">
              <SettingsInput id="account-access" value={accessSummary} readOnly disabled />
            </SettingsField>
          </div>
          <SettingsActionRow>
            <button
              type="submit"
              className={settingsUi.btnPrimary}
              disabled={profilePending || !profileDirty}
            >
              {profilePending ? "Kaydediliyor…" : "Profili Kaydet"}
            </button>
          </SettingsActionRow>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Şifre Değiştir"
        description="En az 8 karakter; bir harf ve bir rakam içermelidir."
        action={<SettingsScopeBadge scope="account" />}
        accent="violet"
      >
        <form onSubmit={(event) => void handlePasswordSave(event)}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <SettingsField
              label="Mevcut şifre"
              htmlFor="account-current-password"
              required
              error={passwordErrors.currentPassword}
              className="xl:col-span-1"
            >
              <SettingsPasswordInput
                id="account-current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                invalid={Boolean(passwordErrors.currentPassword)}
              />
            </SettingsField>
            <SettingsField
              label="Yeni şifre"
              htmlFor="account-new-password"
              required
              error={passwordErrors.newPassword}
            >
              <SettingsPasswordInput
                id="account-new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                invalid={Boolean(passwordErrors.newPassword)}
              />
            </SettingsField>
            <SettingsField
              label="Yeni şifre tekrar"
              htmlFor="account-confirm-password"
              required
              error={passwordErrors.confirmPassword}
            >
              <SettingsPasswordInput
                id="account-confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                invalid={Boolean(passwordErrors.confirmPassword)}
              />
            </SettingsField>
          </div>
          <SettingsActionRow>
            <button type="submit" className={settingsUi.btnPrimary} disabled={passwordPending}>
              {passwordPending ? "Kaydediliyor…" : "Şifreyi Değiştir"}
            </button>
          </SettingsActionRow>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Oturumlar"
        description="Diğer cihazlardaki oturumları görüntüleme ve kapatma özelliği henüz kullanılamıyor."
        action={<SettingsScopeBadge scope="account" />}
      />
    </div>
  );
}
