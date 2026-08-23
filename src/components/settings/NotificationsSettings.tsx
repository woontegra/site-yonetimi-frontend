"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SectionCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MessageTemplatesSettings } from "@/components/settings/MessageTemplatesSettings";
import { useApiAuth } from "@/lib/active-site-context";
import { getWhatsAppIntegration } from "@/lib/whatsapp-api";

export function NotificationsSettings() {
  const auth = useApiAuth({ requireSite: false });
  const [connected, setConnected] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!auth) {
      setConnected(false);
      return;
    }
    try {
      const result = await getWhatsAppIntegration(auth);
      setConnected(result.integration?.connectionStatus === "CONNECTED");
    } catch {
      setConnected(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <SurfaceCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-section text-ink">WhatsApp bağlantısı</p>
            <p className="mt-1 text-sm text-muted">Mesaj gönderimi için tenant hesabınızın entegrasyon durumu.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {connected === null ? (
              <span className="text-sm text-muted">Kontrol ediliyor…</span>
            ) : (
              <StatusBadge
                label={connected ? "Bağlı" : "Bağlı değil"}
                tone={connected ? "success" : "neutral"}
              />
            )}
            <Link href="/app/entegrasyonlar" className="text-sm font-medium text-accent hover:underline">
              Entegrasyonları Yönet
            </Link>
          </div>
        </div>
      </SurfaceCard>

      <SectionCard title="Mesaj şablonları" description="WhatsApp ve SMS borç hatırlatma şablonları.">
        <MessageTemplatesSettings />
      </SectionCard>
    </div>
  );
}
