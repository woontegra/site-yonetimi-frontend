"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Modal } from "@/components/ui/Modal";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SurfaceCard";
import { useToast } from "@/components/ui/Toast";
import {
  CONNECTION_LABELS,
  EMAIL_DELIVERY_STATUS_LABELS,
  EMAIL_DELIVERY_TYPE_LABELS,
} from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  getAdminEmailIntegration,
  getAdminIntegration,
  listAdminEmailDeliveries,
  listAdminIntegrations,
  listAdminTenants,
  retryAdminEmailDelivery,
  sendAdminEmailTest,
  setAdminEmailActive,
  testAdminEmailConnection,
  upsertAdminEmailIntegration,
  type AdminIntegrationListItem,
  type EmailDelivery,
  type PlatformEmailIntegration,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

const emptyForm = {
  senderName: "Site Yönetimi",
  senderEmail: "",
  replyToEmail: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSecurity: "STARTTLS" as "SSL_TLS" | "STARTTLS",
  smtpUsername: "",
  smtpPassword: "",
  notificationEmail: "",
  isActive: true,
};

function emailStatusTone(status?: string): "active" | "failed" | "inactive" {
  if (status === "READY") return "active";
  if (status === "ERROR") return "failed";
  return "inactive";
}

function deliveryTone(status: string): "active" | "failed" | "inactive" {
  if (status === "SENT") return "active";
  if (status === "FAILED") return "failed";
  return "inactive";
}

export function AdminIntegrationsPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const { showToast, toastError } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminIntegrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<(AdminIntegrationListItem & { lastError?: string | null }) | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const [email, setEmail] = useState<PlatformEmailIntegration | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const smtpPasswordRef = useRef<HTMLInputElement>(null);

  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [deliveryTenantId, setDeliveryTenantId] = useState("");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [tenantOptions, setTenantOptions] = useState<Array<{ id: string; name: string }>>([]);

  const loadEmail = useCallback(async () => {
    if (!auth) return;
    const result = await getAdminEmailIntegration(auth);
    setEmail(result.integration);
    if (result.integration?.notificationEmail) {
      setTestRecipient(result.integration.notificationEmail);
    }
  }, [auth]);

  const loadWhatsapp = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminIntegrations(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        status: status || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Entegrasyonlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, status]);

  const loadDeliveries = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listAdminEmailDeliveries(auth, {
        page: deliveryPage,
        perPage: PER_PAGE,
        status: deliveryStatus || undefined,
        type: deliveryType || undefined,
        tenantId: deliveryTenantId || undefined,
        from: deliveryFrom || undefined,
        to: deliveryTo || undefined,
      });
      setDeliveries(result.items);
      setDeliveryTotal(result.total);
    } catch {
      setDeliveries([]);
    }
  }, [auth, deliveryPage, deliveryStatus, deliveryType, deliveryTenantId, deliveryFrom, deliveryTo]);

  useEffect(() => setPage(1), [debouncedSearch, status]);
  useEffect(() => setDeliveryPage(1), [deliveryStatus, deliveryType, deliveryTenantId, deliveryFrom, deliveryTo]);

  useEffect(() => {
    if (!ready) return;
    void loadWhatsapp();
  }, [ready, loadWhatsapp]);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadEmail();
    void listAdminTenants(auth, { page: 1, perPage: 100 }).then((result) => {
      setTenantOptions(result.items.map((item) => ({ id: item.id, name: item.name })));
    }).catch(() => undefined);
  }, [ready, auth, loadEmail]);

  useEffect(() => {
    if (!ready) return;
    void loadDeliveries();
  }, [ready, loadDeliveries]);

  async function openDetail(id: string) {
    if (!auth) return;
    try {
      const result = await getAdminIntegration(auth, id);
      setDetail(result.integration);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Detay yüklenemedi.");
    }
  }

  function openForm() {
    setFormError("");
    setForm({
      senderName: email?.senderName || "Site Yönetimi",
      senderEmail: email?.senderEmail || "",
      replyToEmail: email?.replyToEmail || "",
      smtpHost: email?.smtpHost || "",
      smtpPort: String(email?.smtpPort || 587),
      smtpSecurity: email?.smtpSecurity || "STARTTLS",
      smtpUsername: email?.smtpUsername || "",
      smtpPassword: "",
      notificationEmail: email?.notificationEmail || "",
      isActive: email?.isActive ?? true,
    });
    setFormOpen(true);
  }

  async function saveEmail() {
    if (!auth || pending) return;
    const smtpPassword = (smtpPasswordRef.current?.value ?? form.smtpPassword).trim();
    const mustSetPassword = email?.passwordDecryptable === false || !email?.hasPassword;
    if (mustSetPassword && !smtpPassword) {
      setFormError("Kayıtlı SMTP şifresi kullanılamıyor. Gmail uygulama şifresini bu alana yazıp kaydedin.");
      return;
    }
    setPending(true);
    setFormError("");
    try {
      const result = await upsertAdminEmailIntegration(auth, {
        senderName: form.senderName.trim(),
        senderEmail: form.senderEmail.trim(),
        replyToEmail: form.replyToEmail.trim() || null,
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number(form.smtpPort),
        smtpSecurity: form.smtpSecurity,
        smtpUsername: form.smtpUsername.trim(),
        smtpPassword: smtpPassword || undefined,
        notificationEmail: form.notificationEmail.trim(),
        isActive: form.isActive,
      });
      setEmail(result.integration);
      setForm({ ...form, smtpPassword: "" });
      if (smtpPasswordRef.current) smtpPasswordRef.current.value = "";
      setFormOpen(false);
      showToast(
        result.passwordUpdated
          ? "E-posta ayarları kaydedildi. SMTP şifresi güncellendi."
          : result.securityWarning
            ? `Ayarlar kaydedildi. ${result.securityWarning}`
            : "E-posta ayarları kaydedildi. Bağlantıyı ayrıca test edin.",
      );
      if (result.passwordUpdated && result.integration.passwordDecryptable !== false) {
        const test = await testAdminEmailConnection(auth);
        if (test.ok) {
          showToast("SMTP bağlantısı doğrulandı.");
          setEmail(test.integration);
        } else {
          showToast(test.integration.lastErrorSummary || "SMTP kaydedildi ancak bağlantı başarısız.", "error");
        }
      }
      await loadDeliveries();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Ayarlar kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  async function runEmailAction(action: () => Promise<void>, ok: string) {
    if (!auth || pending) return;
    setPending(true);
    try {
      await action();
      showToast(ok);
      await loadEmail();
      await loadDeliveries();
    } catch (err) {
      toastError(err, "İşlem tamamlanamadı.");
      await loadEmail();
      if (err instanceof ApiError && err.message.includes("SMTP şifresi çözülemedi")) {
        openForm();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Entegrasyonlar"
        description="Merkezi e-posta gönderimi ve tenant WhatsApp bağlantıları. Kimlik bilgileri gösterilmez."
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <SectionCard
        title="E-posta"
        description="İşlemsel bildirimler ve hesap aktivasyonu. Tenant SMTP hesabı değildir."
      >
        {email ? (
          <div className="flex min-w-0 flex-col gap-3 text-sm">
            <p className="min-w-0">
              <span className="text-muted">Durum: </span>
              <StatusBadge label={email.publicLabel} status={emailStatusTone(email.publicStatus)} />
            </p>
            <p className="min-w-0 break-all">
              <span className="text-muted">Gönderici:</span> {email.senderName} &lt;{email.senderEmail}&gt;
            </p>
            <p className="min-w-0 break-all">
              <span className="text-muted">Bildirim alıcısı:</span> {email.notificationEmail}
            </p>
            <p className="min-w-0 break-words">
              <span className="text-muted">Son başarılı test:</span> {formatDateTr(email.lastSuccessfulAt)}
            </p>
            {email.lastErrorSummary ? (
              <p className="break-words text-danger">{email.lastErrorSummary}</p>
            ) : null}
            {email.securityWarning ? (
              <p className="break-words text-muted">{email.securityWarning}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">Merkezi e-posta bağlantısı henüz yapılandırılmamış.</p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button className="w-full" size="sm" onClick={openForm}>{email ? "Düzenle" : "Yapılandır"}</Button>
          <Button
            className="w-full"
            size="sm"
            variant="secondary"
            disabled={pending || !email || email.passwordDecryptable === false}
            onClick={() =>
              void runEmailAction(async () => {
                const result = await testAdminEmailConnection(auth!);
                if (!result.ok) throw new ApiError(400, result.integration.lastErrorSummary || "Bağlantı başarısız.");
              }, "SMTP bağlantısı doğrulandı.")
            }
          >
            Bağlantıyı Test Et
          </Button>
          {email?.passwordDecryptable === false ? (
            <p className="sm:col-span-2 text-sm text-danger">
              Kayıtlı SMTP şifresi çözülemiyor. Düzenle’den uygulama şifresini yeniden yazıp kaydedin; Test Connection eski kaydı kullanır.
            </p>
          ) : null}
          <Button className="w-full" size="sm" variant="secondary" disabled={pending || !email} onClick={() => setTestOpen(true)}>
            Test E-postası Gönder
          </Button>
          {email ? (
            <Button
              className="w-full"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                void runEmailAction(
                  async () => {
                    await setAdminEmailActive(auth!, !email.isActive);
                  },
                  email.isActive ? "E-posta entegrasyonu pasife alındı." : "E-posta entegrasyonu aktifleştirildi.",
                )
              }
            >
              {email.isActive ? "Pasifleştir" : "Aktifleştir"}
            </Button>
          ) : null}
        </div>
      </SectionCard>

      <div className="mt-8">
        <PageHeader title="E-posta teslimatları" description="Gövde, şifre ve aktivasyon bağlantısı saklanmaz." />
        <div className="filter-row mb-3">
          <Select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="SENT">Gönderildi</option>
            <option value="FAILED">Gönderilemedi</option>
            <option value="PENDING">Bekliyor</option>
          </Select>
          <Select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
            <option value="">Tüm türler</option>
            <option value="TENANT_WELCOME_ACTIVATION">Hesap aktivasyonu</option>
            <option value="PLATFORM_NEW_TENANT_NOTIFICATION">Yeni tenant bildirimi</option>
            <option value="SMTP_TEST">SMTP test</option>
          </Select>
          <Select value={deliveryTenantId} onChange={(e) => setDeliveryTenantId(e.target.value)}>
            <option value="">Tüm tenantlar</option>
            {tenantOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Input type="date" value={deliveryFrom} onChange={(e) => setDeliveryFrom(e.target.value)} />
          <Input type="date" value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} />
        </div>
        <Table>
          <TableElement>
            <THead>
              <TR>
                <TH>Tarih</TH>
                <TH>Tür</TH>
                <TH>Alıcı</TH>
                <TH>Tenant</TH>
                <TH>Durum</TH>
                <TH>Deneme</TH>
                <TH>Hata</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {deliveries.length === 0 ? (
                <TR>
                  <TD colSpan={8} className="p-0">
                    <TableEmptyState title="Teslimat kaydı yok." description="Tenant oluşturma ve test gönderimleri burada görünür." />
                  </TD>
                </TR>
              ) : (
                deliveries.map((item) => (
                  <TR key={item.id}>
                    <TD className="whitespace-nowrap">{formatDateTr(item.createdAt)}</TD>
                    <TD>{EMAIL_DELIVERY_TYPE_LABELS[item.type] ?? item.type}</TD>
                    <TD>
                      <div className="min-w-0 max-w-[14rem]">
                        <p className="break-all">{item.recipientEmailMasked}</p>
                        {item.recipientName ? <p className="text-caption text-muted">{item.recipientName}</p> : null}
                      </div>
                    </TD>
                    <TD>
                      {item.relatedTenantId ? (
                        <Link href={`/app/admin/tenantlar/${item.relatedTenantId}`} className="hover:text-accent">
                          {item.relatedTenantName || "Tenant"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <StatusBadge
                        label={EMAIL_DELIVERY_STATUS_LABELS[item.status] ?? item.status}
                        status={deliveryTone(item.status)}
                      />
                    </TD>
                    <TD>{item.attempts}</TD>
                    <TD className="max-w-[220px] truncate text-muted">{item.safeErrorSummary || "—"}</TD>
                    <TD>
                      {item.status !== "SENT" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            void runEmailAction(async () => {
                              await retryAdminEmailDelivery(auth!, item.id);
                            }, "Yeniden gönderme denendi.")
                          }
                        >
                          Yeniden gönder
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </TableElement>
        </Table>
        <Pagination page={deliveryPage} perPage={PER_PAGE} total={deliveryTotal} onPageChange={setDeliveryPage} />
      </div>

      <div className="mt-8">
        <PageHeader
          title="WhatsApp"
          description="Tenant WhatsApp bağlantı durumu. Token gösterilmez."
          search={<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tenant adı" />}
          actions={
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-40">
              <option value="">Tümü</option>
              <option value="CONNECTED">Bağlı</option>
              <option value="DISCONNECTED">Bağlı değil</option>
              <option value="ERROR">Hata</option>
            </Select>
          }
        />
        <Table>
          <TableElement>
            <THead>
              <TR>
                <TH>Tenant</TH>
                <TH>Durum</TH>
                <TH>WABA</TH>
                <TH>Şablon</TH>
                <TH>Onaylı</TH>
                <TH>Son sync</TH>
                <TH>Hata</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><TD colSpan={8} className="text-muted">Yükleniyor…</TD></TR>
              ) : items.length === 0 ? (
                <TR><TD colSpan={8} className="p-0"><TableEmptyState title="Entegrasyon bulunamadı." /></TD></TR>
              ) : (
                items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="font-medium hover:text-accent">
                        {item.tenant.name}
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge
                        label={CONNECTION_LABELS[item.connectionStatus] ?? item.connectionStatus}
                        status={item.connectionStatus === "CONNECTED" ? "active" : item.connectionStatus === "ERROR" ? "failed" : "inactive"}
                      />
                    </TD>
                    <TD>{item.wabaLinked ? "Bağlı" : "Yok"}</TD>
                    <TD>{item.templateCount}</TD>
                    <TD>{item.approvedTemplateCount}</TD>
                    <TD>{formatDateTr(item.lastSyncedAt)}</TD>
                    <TD className="max-w-[220px] truncate text-muted">{item.lastError || "—"}</TD>
                    <TD>
                      <Button size="sm" variant="secondary" onClick={() => void openDetail(item.id)}>Detay</Button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </TableElement>
        </Table>
        <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
      </div>

      <FormModal
        open={formOpen}
        title="Merkezi e-posta bağlantısı"
        description="Site Yönetimi işlemsel e-postaları bu SMTP hesabından gönderilir."
        icon={Mail}
        size="lg"
        onClose={() => (pending ? undefined : setFormOpen(false))}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setFormOpen(false)}>İptal</Button>
            <Button type="submit" form="smtp-email-form" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      >
        <form
          id="smtp-email-form"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEmail();
          }}
        >
          <FormField label="Gönderici adı" required>
            <Input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} data-modal-autofocus />
          </FormField>
          <FormField label="Gönderici e-posta" required>
            <Input type="email" value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} />
          </FormField>
          <FormField label="Reply-To" hint="Opsiyonel">
            <Input type="email" value={form.replyToEmail} onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })} />
          </FormField>
          <FormField label="Platform bildirim e-postası" required>
            <Input type="email" value={form.notificationEmail} onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })} />
          </FormField>
          <FormField label="SMTP sunucusu" required>
            <Input value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} placeholder="smtp.ornek.com" />
          </FormField>
          <FormField label="SMTP portu" required>
            <Input type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} />
          </FormField>
          <FormField label="Güvenlik" required hint="465 genelde SSL/TLS, 587 genelde STARTTLS. Seçiminiz uygulanır.">
            <Select value={form.smtpSecurity} onChange={(e) => setForm({ ...form, smtpSecurity: e.target.value as "SSL_TLS" | "STARTTLS" })}>
              <option value="STARTTLS">STARTTLS</option>
              <option value="SSL_TLS">SSL/TLS</option>
            </Select>
          </FormField>
          <FormField label="SMTP kullanıcı adı" required>
            <Input value={form.smtpUsername} onChange={(e) => setForm({ ...form, smtpUsername: e.target.value })} autoComplete="username" name="smtp-username" />
          </FormField>
          <FormField
            label="SMTP şifresi / uygulama şifresi"
            required={email?.passwordDecryptable === false || !email?.hasPassword}
            hint="Gmail uygulama şifresini yazın. Placeholder eski şifreyi göndermez; alanı gerçekten doldurmanız gerekir."
            className="sm:col-span-2"
          >
            <Input
              ref={smtpPasswordRef}
              type="password"
              name="smtpPassword"
              value={form.smtpPassword}
              onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
              placeholder={email?.hasPassword ? "Uygulama şifresini yeniden girin" : ""}
              autoComplete="new-password"
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>
          <p className="text-[12px] text-muted sm:col-span-2">
            Kaydettikten sonra bağlantı otomatik test edilir.
          </p>
          {formError ? <p className="text-[13px] text-danger sm:col-span-2">{formError}</p> : null}
        </form>
      </FormModal>

      <Modal
        open={testOpen}
        title="Test e-postası gönder"
        onClose={() => setTestOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTestOpen(false)}>Vazgeç</Button>
            <Button
              disabled={pending || !testRecipient.trim()}
              onClick={() =>
                void runEmailAction(async () => {
                  const result = await sendAdminEmailTest(auth!, testRecipient.trim());
                  setTestOpen(false);
                  if (result.delivery.status !== "SENT") {
                    throw new ApiError(400, result.delivery.safeErrorSummary || "Test e-postası gönderilemedi.");
                  }
                }, "Test e-postası gönderildi.")
              }
            >
              Gönder
            </Button>
          </>
        }
      >
        <FormField label="Alıcı e-posta" hint="Varsayılan olarak platform bildirim adresi kullanılır.">
          <Input type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} />
        </FormField>
      </Modal>

      <Modal open={Boolean(detail)} title="Entegrasyon detayı" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted">Tenant:</span> {detail.tenant.name}</p>
            <p><span className="text-muted">Durum:</span> {CONNECTION_LABELS[detail.connectionStatus] ?? detail.connectionStatus}</p>
            <p><span className="text-muted">WABA:</span> {detail.wabaLinked ? "Bağlı" : "Yok"}</p>
            <p><span className="text-muted">Görünen numara:</span> {detail.displayPhoneNumber || "—"}</p>
            <p><span className="text-muted">Son kontrol:</span> {formatDateTr(detail.lastCheckedAt)}</p>
            <p><span className="text-muted">Son hata:</span> {detail.lastError || "—"}</p>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
