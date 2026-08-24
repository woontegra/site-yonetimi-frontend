"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { getIntegrationsStatus, type IntegrationsStatus } from "@/lib/communications-api";
import { isSmsFeatureEnabled } from "@/lib/messaging-channels";
import { ApiError } from "@/lib/http";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppIntegration,
  syncWhatsAppTemplates,
  testWhatsAppConnection,
  WHATSAPP_CONNECTION_STATUS_LABELS,
  type WhatsAppIntegration,
} from "@/lib/whatsapp-api";

function statusTone(
  connectionStatus: WhatsAppIntegration["connectionStatus"] | null,
  isMock?: boolean,
): "success" | "warning" | "neutral" | "danger" {
  if (isMock) return "warning";
  if (connectionStatus === "CONNECTED") return "success";
  if (connectionStatus === "ERROR") return "danger";
  return "neutral";
}

export default function EntegrasyonlarPage() {
  const auth = useApiAuth({ requireSite: true });
  const { user } = useAuth();
  const { showToast } = useToast();

  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [formError, setFormError] = useState("");
  const isPlatformAdmin = Boolean(user.isPlatformAdmin);
  const META_ID_PATTERN = /^\d+$/;

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [statusResult, waResult] = await Promise.all([
        getIntegrationsStatus(auth),
        getWhatsAppIntegration(auth),
      ]);
      setStatus(statusResult);
      setWhatsapp(waResult.integration);
    } catch {
      setStatus(null);
      setWhatsapp(null);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  function openConnect(update = false) {
    if (!isPlatformAdmin) return;
    setFormError("");
    setAccessToken("");
    setWabaId(update && whatsapp?.wabaId ? whatsapp.wabaId : "");
    setPhoneNumberId(update && whatsapp?.phoneNumberId ? whatsapp.phoneNumberId : "");
    setModalOpen(true);
  }

  async function handleConnect() {
    if (!auth || pending) return;
    if (!isPlatformAdmin) return;
    if (!META_ID_PATTERN.test(wabaId.trim()) || !META_ID_PATTERN.test(phoneNumberId.trim())) {
      setFormError("WABA ID ve Phone Number ID yalnızca rakamlardan oluşmalıdır.");
      return;
    }
    if (!accessToken.trim() || accessToken.trim().length < 20) {
      setFormError("Geçerli bir erişim anahtarı girin.");
      return;
    }
    setPending(true);
    setFormError("");
    try {
      await connectWhatsApp(auth, {
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
      });
      showToast("WhatsApp bağlantısı doğrulandı.");
      setModalOpen(false);
      setAccessToken("");
      await load();
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "WhatsApp bağlantısı doğrulanamadı.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleTest() {
    if (!auth || pending) return;
    setPending(true);
    try {
      await testWhatsAppConnection(auth);
      showToast("Bağlantı testi başarılı.");
      await load();
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : "Bağlantı testi başarısız.",
        "error",
      );
      await load();
    } finally {
      setPending(false);
    }
  }

  async function handleSync() {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await syncWhatsAppTemplates(auth);
      const approved = result.items.filter((t) => t.status === "APPROVED" && t.sendable).length;
      showToast(`Şablonlar senkronize edildi (${result.items.length} şablon, ${approved} gönderime uygun).`);
    } catch (error) {
      showToast(
        error instanceof ApiError
          ? error.message
          : "Şablonlar senkronize edilemedi. Lütfen tekrar deneyin.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDisconnect() {
    if (!auth || pending) return;
    if (!window.confirm("WhatsApp bağlantısı kaldırılsın mı?")) return;
    setPending(true);
    try {
      await disconnectWhatsApp(auth);
      showToast("WhatsApp bağlantısı kaldırıldı.");
      await load();
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : "Bağlantı kaldırılamadı.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  const connected = whatsapp?.connectionStatus === "CONNECTED";
  const connectionLabel = whatsapp
    ? WHATSAPP_CONNECTION_STATUS_LABELS[whatsapp.connectionStatus]
    : "Bağlı Değil";
  const smsLabel = status?.sms.label ?? "Bağlı değil";
  const emailLabel = status?.email.label ?? "Bağlı değil";
  const bankLabel = status?.bank.label ?? "Manuel Yönetim Aktif";
  const bankNote = status?.bank.note ?? "Canlı Banka Bağlantısı Yakında";

  return (
    <PageContainer>
      <PageHeader
        title="Entegrasyonlar"
        description="Dış servis bağlantılarının durumunu buradan takip edin."
      />
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
        <ul className="divide-y divide-line">
          <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">WhatsApp</p>
              <p className="mt-1 text-sm text-muted">
                WhatsApp Business hesabınızı bağlayarak aidat hatırlatmaları ve site duyuruları
                gönderebilirsiniz.
              </p>
              {connected && whatsapp ? (
                <>
                  <p className="mt-2 text-sm text-ink">
                    {whatsapp.verifiedName || "WhatsApp Business"}
                  </p>
                  <p className="text-[13px] text-muted">
                    {whatsapp.displayPhoneNumber || whatsapp.businessPhone || "—"}
                  </p>
                  {whatsapp.lastError ? (
                    <p className="mt-1 text-[12px] text-danger">{whatsapp.lastError}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  {isPlatformAdmin
                    ? "Tek tıkla Meta bağlantısı bu ortamda henüz etkin değil. Hesabı Gelişmiş Bağlantı ile kaydedin."
                    : "WhatsApp hesabı platform yöneticisi tarafından bağlanır. Meta ile tek tıkla bağlanma henüz etkin değil."}
                </p>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Badge tone={statusTone(whatsapp?.connectionStatus ?? null)}>
                {loading ? "Yükleniyor…" : connectionLabel}
              </Badge>
              <div className="flex flex-wrap justify-end gap-1.5">
                {!connected ? (
                  isPlatformAdmin ? (
                    <Button size="sm" disabled={pending || loading} onClick={() => openConnect(false)}>
                      Gelişmiş Bağlantı
                    </Button>
                  ) : null
                ) : (
                  <>
                    <Link
                      href="/app/whatsapp-sablonlari"
                      className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-canvas"
                    >
                      WhatsApp Şablonlarını Yönet
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => void handleTest()}
                    >
                      Bağlantıyı Test Et
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => void handleSync()}
                    >
                      Şablonları Senkronize Et
                    </Button>
                    {isPlatformAdmin ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => openConnect(true)}
                      >
                        Gelişmiş Bağlantı
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => void handleDisconnect()}
                    >
                      Bağlantıyı Kaldır
                    </Button>
                  </>
                )}
              </div>
            </div>
          </li>
          {isSmsFeatureEnabled() ? (
            <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">SMS</p>
                <p className="text-sm text-muted">Borç hatırlatmaları için kısa mesaj gönderimi.</p>
              </div>
              <Badge tone={status?.sms.connected ? "warning" : "neutral"}>
                {loading ? "Yükleniyor…" : smsLabel}
              </Badge>
            </li>
          ) : null}
          <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Banka</p>
              <p className="text-sm text-muted">
                {bankLabel}. {bankNote}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{bankLabel}</Badge>
              <Badge tone="neutral">{bankNote}</Badge>
              <Link
                href="/app/muhasebe/bankalar"
                className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-canvas"
              >
                Banka Hesaplarını Yönet
              </Link>
            </div>
          </li>
          <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">E-posta</p>
              <p className="text-sm text-muted">
                Sistem bildirimleri ve hesap e-postaları platformun merkezi e-posta servisi üzerinden gönderilir.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  status?.email.status === "READY"
                    ? "success"
                    : status?.email.status === "ERROR"
                      ? "danger"
                      : status?.email.status === "INACTIVE"
                        ? "warning"
                        : "neutral"
                }
              >
                {loading ? "Yükleniyor…" : emailLabel}
              </Badge>
              {auth && user.isPlatformAdmin ? (
                <Link
                  href="/app/admin/entegrasyonlar"
                  className="inline-flex h-8 items-center justify-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-canvas"
                >
                  E-posta Ayarlarını Yönet
                </Link>
              ) : null}
            </div>
          </li>
        </ul>
      </div>

      {isPlatformAdmin ? (
      <FormModal
        open={modalOpen}
        title="Gelişmiş WhatsApp Bağlantısı"
        description="Yalnızca platform yöneticileri için. Kimlikler Graph API’den sayısal WABA ve telefon numarası ID’si olarak girilir; erişim anahtarı saklanır ve tekrar gösterilmez."
        icon={MessageCircle}
        size="md"
        onClose={() => (pending ? undefined : setModalOpen(false))}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setModalOpen(false)}>
              İptal
            </Button>
            <Button disabled={pending} onClick={() => void handleConnect()}>
              {pending ? "Doğrulanıyor…" : "Bağlantıyı Doğrula"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="WABA ID" required>
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value.replace(/\D/g, ""))}
              placeholder="Sayısal hesap kimliği"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="wa-waba-id"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              data-modal-autofocus
            />
          </FormField>
          <FormField label="Phone Number ID" required>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ""))}
              placeholder="Sayısal telefon kimliği"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="wa-cloud-number-id"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
            />
          </FormField>
          <FormField
            label="Access Token"
            required
            hint="Anahtar kaydedildikten sonra tekrar gösterilmez. Yanıttan da dönmez."
          >
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Meta erişim anahtarı"
              autoComplete="new-password"
              name="wa-access-token"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </FormField>
          {formError ? <p className="text-[13px] text-danger">{formError}</p> : null}
        </div>
      </FormModal>
      ) : null}
    </PageContainer>
  );
}
