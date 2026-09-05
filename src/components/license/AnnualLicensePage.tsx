"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney } from "@/lib/money";
import {
  createAnnualLicenseRequest,
  getAnnualLicenseOffer,
  type AnnualLicenseOffer,
  type AnnualLicenseRequest,
} from "@/lib/license-request-api";
import { PLAN_LABELS, invalidateMyLicenseCache } from "@/lib/subscription-api";
import { cn } from "@/lib/cn";
import { LICENSE_DETAIL_HREF } from "@/components/layout/license-banner-model";

function buildWhatsAppHref(offer: AnnualLicenseOffer): string | null {
  const raw =
    offer.support.whatsapp?.trim() ||
    process.env.NEXT_PUBLIC_SALES_WHATSAPP?.trim() ||
    "";
  const phone = raw.replace(/\D/g, "");
  if (!phone) return null;
  const message = `Merhaba, ${offer.organization.name} için Site Yönetimi Yıllık Lisansı hakkında bilgi almak istiyorum.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildMailHref(offer: AnnualLicenseOffer): string | null {
  const email =
    offer.support.email?.trim() || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
  if (!email) return null;
  const subject = `Yıllık Lisans — ${offer.organization.name}`;
  const body = `Merhaba,\n\n${offer.organization.name} organizasyonu için Site Yönetimi Yıllık Lisansı hakkında bilgi almak istiyorum.\n\nYetkili: ${offer.requester.fullName}\nE-posta: ${offer.requester.email}\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function AnnualLicensePage() {
  const { ready, user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const { showToast, toastError } = useToast();
  const [offer, setOffer] = useState<AnnualLicenseOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<AnnualLicenseRequest | null>(null);

  const load = useCallback(async () => {
    if (!ready || !auth) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAnnualLicenseOffer(auth);
      setOffer(data);
      setCreated(data.openRequest);
    } catch (err) {
      setOffer(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Yıllık lisans bilgileri alınamadı. Lütfen yeniden deneyin.",
      );
    } finally {
      setLoading(false);
    }
  }, [ready, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const whatsappHref = useMemo(() => (offer ? buildWhatsAppHref(offer) : null), [offer]);
  const mailHref = useMemo(() => (offer ? buildMailHref(offer) : null), [offer]);

  async function submitRequest() {
    if (!auth) return;
    setSubmitting(true);
    try {
      const result = await createAnnualLicenseRequest(auth, { note: note.trim() || undefined });
      setCreated(result.request);
      setModalOpen(false);
      setNote("");
      showToast({
        tone: "success",
        title: "Talebiniz alındı",
        description: "Yıllık lisans talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.",
      });
      invalidateMyLicenseCache(auth.tenantId);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ANNUAL_LICENSE_REQUEST_OPEN") {
        toastError(err.message);
        await load();
        return;
      }
      toastError(err instanceof ApiError ? err.message : "Talep gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeAnnual =
    offer?.license?.plan === "ANNUAL" &&
    offer.license.status === "ACTIVE" &&
    (offer.license.remainingDays ?? 0) > 30;

  return (
    <PageContainer width="default">
      <PageHeader
        title="Yıllık Lisans"
        description="Site yönetiminizi kesintisiz sürdürün."
        actions={
          <Link
            href={LICENSE_DETAIL_HREF}
            className="text-[12px] font-medium text-accent hover:underline"
          >
            Lisans Detayı
          </Link>
        }
      />

      {loading ? <p className="text-[13px] text-muted">Yükleniyor…</p> : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5 text-[12px] text-rose-800">
          {error}
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => void load()}>
            Yeniden Dene
          </Button>
        </div>
      ) : null}

      {!loading && !error && offer ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-line bg-surface px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Paket</p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-ink">Yıllık Lisans</h2>
            <p className="mt-1 text-[13px] text-muted">Organizasyonunuzdaki tüm kullanıcı ve siteler için.</p>

            <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-[28px] font-semibold leading-none tracking-tight text-ink">
                {formatMoney(offer.product.netPrice)}
              </p>
              <p className="pb-0.5 text-[13px] text-muted">+ KDV / yıl</p>
            </div>
            <p className="mt-2 text-[12px] text-muted">
              KDV dahil: <span className="font-medium text-ink">{formatMoney(offer.product.grossPrice)}</span>
              {" · "}
              Aylık karşılığı: yaklaşık {formatMoney(offer.product.monthlyNetApprox)} + KDV
            </p>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {offer.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-[12px] text-ink">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/80 pt-4">
              {created && (created.status === "PENDING" || created.status === "CONTACTED") ? (
                <div className="rounded-lg border border-teal-200/80 bg-teal-50/50 px-3 py-2 text-[12px] text-ink">
                  Açık talebiniz var · No: <span className="font-medium">{created.id.slice(0, 8)}</span> ·{" "}
                  {created.status === "CONTACTED" ? "İletişime geçildi" : "Değerlendirmede"}
                </div>
              ) : activeAnnual ? (
                <p className="text-[12px] text-muted">Aktif yıllık lisansınız bulunuyor.</p>
              ) : (
                <Button
                  onClick={() => setModalOpen(true)}
                  disabled={Boolean(user.isPlatformAdmin)}
                >
                  Yıllık Lisans Talebi Oluştur
                </Button>
              )}
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-ink hover:bg-canvas"
                >
                  <MessageCircle className="size-3.5" aria-hidden />
                  WhatsApp ile İletişime Geç
                </a>
              ) : null}
              {mailHref ? (
                <a
                  href={mailHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-ink hover:bg-canvas"
                >
                  <Mail className="size-3.5" aria-hidden />
                  E-posta Gönder
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </div>
            {user.isPlatformAdmin ? (
              <p className="mt-2 text-[11px] text-muted">
                Platform yöneticisi olarak müşteri adına talep oluşturmazsınız; admin lisans panelini kullanın.
              </p>
            ) : null}
          </section>

          <aside className="space-y-3">
            <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
              <h3 className="text-[13px] font-semibold text-ink">Mevcut durum</h3>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Organizasyon</dt>
                  <dd className="text-right font-medium text-ink">{offer.organization.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Lisans türü</dt>
                  <dd className="font-medium text-ink">
                    {offer.license ? PLAN_LABELS[offer.license.plan] : "Tanımsız"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Bitiş</dt>
                  <dd className="font-medium text-ink">
                    {offer.license ? formatDateTr(offer.license.endsAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Kalan gün</dt>
                  <dd className="font-medium text-ink">
                    {offer.license != null ? Math.max(0, offer.license.remainingDays) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Yıllık bitiş (önizleme)</dt>
                  <dd className="text-right font-medium text-ink">{formatDateTr(offer.projectedEndsAt)}</dd>
                </div>
              </dl>
              {offer.remainingDemoDaysPreserved ? (
                <p className="mt-3 rounded-md border border-teal-200/70 bg-teal-50/40 px-2.5 py-2 text-[11px] leading-[1.4] text-ink">
                  Kalan demo günleriniz korunur; yıllık süre mevcut demo bitişinin üzerine eklenir.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
              <h3 className="text-[13px] font-semibold text-ink">Fiyat özeti</h3>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Net</dt>
                  <dd className="font-medium text-ink">{formatMoney(offer.product.netPrice)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">KDV (%{offer.product.vatRate})</dt>
                  <dd className="font-medium text-ink">{formatMoney(offer.product.vatAmount)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line/70 pt-2">
                  <dt className="font-medium text-ink">Toplam</dt>
                  <dd className="font-semibold text-ink">{formatMoney(offer.product.grossPrice)}</dd>
                </div>
              </dl>
              <p className={cn("mt-3 text-[11px] text-muted")}>
                Online ödeme henüz yoktur. Talebiniz Woontegra tarafından incelenir; lisans yalnızca onay sonrası
                etkinleştirilir.
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => (!submitting ? setModalOpen(false) : undefined)}
        title="Yıllık Lisans Talebi"
        description="Talebiniz platform ekibine iletilir. Lisans otomatik aktifleşmez."
        variant="confirm"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={submitting} onClick={() => setModalOpen(false)}>
              Vazgeç
            </Button>
            <Button size="sm" disabled={submitting || !offer} onClick={() => void submitRequest()}>
              {submitting ? "Gönderiliyor…" : "Talebi Gönder"}
            </Button>
          </div>
        }
      >
        {offer ? (
          <div className="space-y-3 text-[12px]">
            <dl className="space-y-1.5 rounded-lg border border-line bg-canvas/50 px-3 py-2.5">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Organizasyon</dt>
                <dd className="font-medium text-ink">{offer.organization.name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Yetkili</dt>
                <dd className="font-medium text-ink">{offer.requester.fullName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">E-posta</dt>
                <dd className="font-medium text-ink">{offer.requester.email}</dd>
              </div>
              {offer.license ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Mevcut bitiş</dt>
                  <dd className="font-medium text-ink">{formatDateTr(offer.license.endsAt)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Net</dt>
                <dd className="font-medium text-ink">{formatMoney(offer.product.netPrice)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">KDV</dt>
                <dd className="font-medium text-ink">{formatMoney(offer.product.vatAmount)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Toplam</dt>
                <dd className="font-semibold text-ink">{formatMoney(offer.product.grossPrice)}</dd>
              </div>
            </dl>
            <FormField label="Not" hint="İsteğe bağlı">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="İletişim tercihi veya ek bilgi"
                data-modal-autofocus
              />
            </FormField>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
