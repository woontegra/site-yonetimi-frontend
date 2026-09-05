"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Mail } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SettingsScopeBadge } from "@/components/settings/SettingsScopeBadge";
import { SettingsCard, settingsUi } from "@/components/settings/settings-ui";
import { useApiAuth } from "@/lib/active-site-context";
import { getWhatsAppIntegration } from "@/lib/whatsapp-api";

export function NotificationsSettings() {
  const auth = useApiAuth({ requireSite: false });
  const [connected, setConnected] = useState<boolean | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) {
      setConnected(false);
      setPhoneHint(null);
      return;
    }
    try {
      const result = await getWhatsAppIntegration(auth);
      const integration = result.integration;
      setConnected(integration?.connectionStatus === "CONNECTED");
      setPhoneHint(
        integration?.displayPhoneNumber ||
          integration?.phoneNumberId ||
          null,
      );
    } catch {
      setConnected(false);
      setPhoneHint(null);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={settingsUi.cardsGap}>
      <SettingsCard
        title="WhatsApp"
        description="Organizasyon WhatsApp entegrasyonu. Şablon yönetimi ayrı sayfadadır."
        action={<SettingsScopeBadge scope="organization" />}
        accent="cyan"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {connected === null ? (
              <span className={settingsUi.help}>Kontrol ediliyor…</span>
            ) : (
              <StatusBadge
                label={connected ? "Bağlı" : "Bağlı değil"}
                tone={connected ? "success" : "warning"}
              />
            )}
            {phoneHint ? (
              <p className={settingsUi.help}>Hesap / numara: {phoneHint}</p>
            ) : connected === false ? (
              <p className={settingsUi.help}>WhatsApp henüz bağlanmamış.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/entegrasyonlar" className={settingsUi.btnSecondary}>
              <MessageCircle className="size-3.5" aria-hidden />
              Entegrasyonu Yönet
            </Link>
            <Link href="/app/whatsapp-sablonlari" className={settingsUi.btnSecondary}>
              WhatsApp Şablonlarını Yönet
            </Link>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="E-posta"
        description="Davet ve sistem e-postaları platform SMTP üzerinden gönderilir."
        action={<SettingsScopeBadge scope="organization" />}
        accent="cyan"
      >
        <p className={cnBody}>
          <Mail className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
          Tenant SMTP şifresi burada görünmez; merkezi SMTP yalnız platform yöneticisi tarafından yönetilir.
        </p>
      </SettingsCard>

      <SettingsCard
        title="Bildirim tercihleri"
        description="Kanal tercihleri için ayrı tercih modeli henüz yok."
        action={<SettingsScopeBadge scope="organization" />}
        accent="cyan"
        bodyClassName="py-3"
      >
        <p className={settingsUi.help}>
          Borç hatırlatmaları WhatsApp şablonları ve Banka / İletişim akışlarından yürütülür.
        </p>
      </SettingsCard>
    </div>
  );
}

const cnBody = `${settingsUi.body} inline-flex items-start gap-2`;
