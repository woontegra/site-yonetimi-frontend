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
    setFormError("");
    setAccessToken("");
    if (update && whatsapp) {
      setWabaId(whatsapp.wabaId);
      setPhoneNumberId(whatsapp.phoneNumberId);
    } else {
      setWabaId("");
      setPhoneNumberId("");
    }
    setModalOpen(true);
  }

  async function handleConnect() {
    if (!auth || pending) return;
    if (!wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim()) {
      setFormError("WABA ID, Phone Number ID ve Access Token zorunludur.");
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
        error instanceof ApiError ? error.message : "Şablon senkronizasyonu başarısız.",
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
              {connected && whatsapp ? (
                <>
                  <p className="mt-0.5 text-sm text-ink">
                    {whatsapp.verifiedName || "WhatsApp Business"}
                  </p>
                  <p className="text-[13px] text-muted">
                    {whatsapp.displayPhoneNumber || whatsapp.businessPhone || "—"}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    Token: {whatsapp.accessTokenMasked}
                  </p>
                  {whatsapp.lastError ? (
                    <p className="mt-1 text-[12px] text-danger">{whatsapp.lastError}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">Toplu bilgilendirme ve borç hatırlatmaları.</p>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Badge tone={statusTone(whatsapp?.connectionStatus ?? null)}>
                {loading ? "Yükleniyor…" : connectionLabel}
              </Badge>
              <div className="flex flex-wrap justify-end gap-1.5">
                {!connected ? (
                  <Button size="sm" disabled={pending || loading} onClick={() => openConnect(false)}>
                    Bağla
                  </Button>
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
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => openConnect(true)}
                    >
                      Ayarları Güncelle
                    </Button>
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
          <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">SMS</p>
              <p className="text-sm text-muted">Borç hatırlatmaları için kısa mesaj gönderimi.</p>
            </div>
            <Badge tone={status?.sms.connected ? "warning" : "neutral"}>
              {loading ? "Yükleniyor…" : smsLabel}
            </Badge>
          </li>
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

      <FormModal
        open={modalOpen}
        title="WhatsApp Business Bağlantısı"
        description="Meta WhatsApp Cloud API bilgilerinizle bağlantı kurulur."
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
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="WhatsApp Business Account ID"
              data-modal-autofocus
            />
          </FormField>
          <FormField label="Phone Number ID" required>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Phone Number ID"
            />
          </FormField>
          <FormField
            label="Access Token"
            required
            hint={
              whatsapp
                ? `Mevcut token: ${whatsapp.accessTokenMasked}. Yeni token girin; eski token tekrar gösterilmez.`
                : "Token kaydedildikten sonra tekrar gösterilmez."
            }
          >
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Meta access token"
              autoComplete="off"
            />
          </FormField>
          <p className="text-[12px] text-muted">
            Meta WhatsApp Cloud API bilgilerinizle bağlantı kurulur.
          </p>
          {formError ? <p className="text-[13px] text-danger">{formError}</p> : null}
        </div>
      </FormModal>
    </PageContainer>
  );
}
