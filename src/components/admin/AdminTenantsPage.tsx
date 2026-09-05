"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PLAN_LABELS, SUB_STATUS_LABELS, remainingLabel } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  createAdminTenant,
  listAdminTenants,
  resendAdminTenantNotification,
  resendAdminUserInvite,
  type AdminTenantListItem,
  type CreateAdminTenantResult,
  type EmailDelivery,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

function deliveryLabel(item: EmailDelivery | null): string {
  if (!item) return "Gönderilemedi";
  return item.status === "SENT" ? "Gönderildi" : "Gönderilemedi";
}

export function AdminTenantsPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const { showToast, toastError } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminTenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    managerFullName: "",
    managerEmail: "",
    plan: "DEMO" as "DEMO" | "ANNUAL",
    trialDays: "7",
    annualDays: "365",
  });
  const [created, setCreated] = useState<CreateAdminTenantResult | null>(null);

  useEffect(() => {
    if (searchParams.get("yeni") === "1") {
      setFormError("");
      setWizardStep(1);
      setCreateOpen(true);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminTenants(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        filter: filter || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setItems([]);
      setError(err instanceof ApiError ? err.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, filter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function submitCreate() {
    if (!auth || pending) return;
    setPending(true);
    setFormError("");
    try {
      const payload: Parameters<typeof createAdminTenant>[1] = {
        name: form.name.trim(),
        managerFullName: form.managerFullName.trim(),
        managerEmail: form.managerEmail.trim(),
        plan: form.plan,
      };
      if (form.plan === "DEMO") {
        const days = Number(form.trialDays);
        if (!Number.isInteger(days) || days < 1) {
          setFormError("Demo süresi 1–90 gün olmalıdır.");
          setPending(false);
          return;
        }
        payload.trialDays = days;
      } else {
        const days = Number(form.annualDays) || 365;
        payload.annualDays = days;
      }
      const result = await createAdminTenant(auth, payload);
      setCreateOpen(false);
      setCreated(result);
      setForm({
        name: "",
        managerFullName: "",
        managerEmail: "",
        plan: "DEMO",
        trialDays: "7",
        annualDays: "365",
      });
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Tenant oluşturulamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Organizasyon Yönetimi"
        description="Platform müşteri hesapları."
        search={
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Organizasyon, kullanıcı veya e-posta"
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
              <option value="">Tüm durumlar</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
              <option value="demo">Demo</option>
              <option value="annual">Yıllık</option>
            </Select>
            <Button
              onClick={() => {
                setFormError("");
                setWizardStep(1);
                setCreateOpen(true);
              }}
            >
              Yeni organizasyon
            </Button>
          </div>
        }
      />

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Tenant / Müşteri</TH>
              <TH>Ana kullanıcı</TH>
              <TH>Site</TH>
              <TH>Daire</TH>
              <TH>Kullanıcı</TH>
              <TH>Plan</TH>
              <TH>Durum</TH>
              <TH>Oluşturulma</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR>
                <TD colSpan={9} className="text-muted">
                  Yükleniyor…
                </TD>
              </TR>
            ) : items.length === 0 ? (
              <TR>
                <TD colSpan={9} className="p-0">
                  <TableEmptyState title="Tenant bulunamadı." />
                </TD>
              </TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.id}`} className="font-medium text-ink hover:text-accent">
                      {item.name}
                    </Link>
                  </TD>
                  <TD>
                    <div className="leading-tight">
                      <p>{item.owner?.fullName ?? "—"}</p>
                      <p className="text-caption text-muted">{item.owner?.email}</p>
                    </div>
                  </TD>
                  <TD>{item.siteCount}</TD>
                  <TD>{item.apartmentCount}</TD>
                  <TD>{item.userCount}</TD>
                  <TD>
                    {item.subscription ? (
                      <div>
                        <p>{PLAN_LABELS[item.subscription.plan]}</p>
                        <p className="text-caption text-muted">
                          {SUB_STATUS_LABELS[item.subscription.status]}
                          {remainingLabel(item.subscription) ? ` · ${remainingLabel(item.subscription)}` : ""}
                        </p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    <StatusBadge active={item.isActive} />
                  </TD>
                  <TD>{formatDateTr(item.createdAt)}</TD>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.id}`}>
                      <Button size="sm" variant="secondary">
                        Aç
                      </Button>
                    </Link>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <FormModal
        open={createOpen}
        title="Yeni organizasyon"
        description={`Adım ${wizardStep}/4 — Kayıt yalnız son adımda oluşturulur.`}
        icon={Building2}
        onClose={() => (pending ? undefined : setCreateOpen(false))}
        footer={
          <>
            {wizardStep > 1 ? (
              <Button variant="secondary" disabled={pending} onClick={() => setWizardStep((s) => s - 1)}>
                Geri
              </Button>
            ) : (
              <Button variant="secondary" disabled={pending} onClick={() => setCreateOpen(false)}>
                İptal
              </Button>
            )}
            {wizardStep < 4 ? (
              <Button
                disabled={pending}
                onClick={() => {
                  setFormError("");
                  if (wizardStep === 1 && (!form.name.trim() || form.name.trim().length < 2)) {
                    setFormError("Organizasyon adı zorunludur.");
                    return;
                  }
                  if (wizardStep === 2 && (!form.managerFullName.trim() || !form.managerEmail.trim())) {
                    setFormError("Yönetici adı ve e-posta zorunludur.");
                    return;
                  }
                  setWizardStep((s) => s + 1);
                }}
              >
                İleri
              </Button>
            ) : (
              <Button disabled={pending} onClick={() => void submitCreate()}>
                {pending ? "Oluşturuluyor…" : "Organizasyonu Oluştur"}
              </Button>
            )}
          </>
        }
      >
        {formError ? <p className="mb-3 text-[12px] text-danger">{formError}</p> : null}
        {wizardStep === 1 ? (
          <FormField label="Organizasyon adı" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-modal-autofocus />
          </FormField>
        ) : null}
        {wizardStep === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Yetkili adı soyadı" required>
              <Input value={form.managerFullName} onChange={(e) => setForm({ ...form, managerFullName: e.target.value })} data-modal-autofocus />
            </FormField>
            <FormField label="E-posta" required>
              <Input type="email" value={form.managerEmail} onChange={(e) => setForm({ ...form, managerEmail: e.target.value })} />
            </FormField>
            <p className="sm:col-span-2 text-[11px] text-muted">
              İlk kullanıcı tenant yönetici rolüyle oluşturulur. Açık şifre gösterilmez; aktivasyon e-postası gönderilir.
            </p>
          </div>
        ) : null}
        {wizardStep === 3 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Plan">
              <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as typeof form.plan })}>
                <option value="DEMO">Demo · 7 gün</option>
                <option value="ANNUAL">Yıllık · 365 gün</option>
              </Select>
            </FormField>
            {form.plan === "DEMO" ? (
              <FormField label="Demo süresi (gün)">
                <Input type="number" min={1} max={90} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
              </FormField>
            ) : (
              <FormField label="Lisans süresi (gün)">
                <Input type="number" min={1} value={form.annualDays} onChange={(e) => setForm({ ...form, annualDays: e.target.value })} />
              </FormField>
            )}
            {form.plan === "ANNUAL" ? (
              <p className="sm:col-span-2 rounded-md border border-line bg-canvas/50 px-3 py-2 text-[12px] text-muted">
                Fiyat önizleme: 4.000,00 ₺ net + %20 KDV = 4.800,00 ₺
              </p>
            ) : null}
          </div>
        ) : null}
        {wizardStep === 4 ? (
          <dl className="grid gap-2 text-[12px]">
            <div className="flex justify-between gap-2"><dt className="text-muted">Organizasyon</dt><dd className="font-medium">{form.name}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Yetkili</dt><dd className="font-medium">{form.managerFullName}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">E-posta</dt><dd className="font-medium">{form.managerEmail}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Plan</dt><dd className="font-medium">{form.plan === "DEMO" ? `Demo · ${form.trialDays} gün` : `Yıllık · ${form.annualDays} gün`}</dd></div>
            <p className="mt-2 text-[11px] text-muted">
              Oluşturulacaklar: organizasyon, ilk yönetici kullanıcı, üyelik, lisans kaydı. Hata olursa hiçbir kayıt bırakılmaz.
            </p>
          </dl>
        ) : null}
      </FormModal>

      <Modal
        open={Boolean(created)}
        title={
          created?.emails.welcome?.status === "SENT"
            ? "Organizasyon oluşturuldu ve aktivasyon e-postası gönderildi."
            : "Organizasyon oluşturuldu ancak aktivasyon e-postası gönderilemedi."
        }
        onClose={() => setCreated(null)}
        footer={
          <>
            <Link href="/app/admin/entegrasyonlar">
              <Button variant="secondary">E-posta Ayarlarına Git</Button>
            </Link>
            {created?.tenant.owner && created.emails.welcome?.status !== "SENT" ? (
              <Button
                disabled={pending}
                onClick={() =>
                  void (async () => {
                    if (!auth || !created.tenant.owner) return;
                    setPending(true);
                    try {
                      const result = await resendAdminUserInvite(auth, created.tenant.owner.id);
                      setCreated({ ...created, emails: { ...created.emails, welcome: result.welcome } });
                      showToast(
                        result.welcome?.status === "SENT"
                          ? "Aktivasyon daveti gönderildi."
                          : "Aktivasyon daveti gönderilemedi.",
                        result.welcome?.status === "SENT" ? "success" : "error",
                      );
                    } catch (err) {
                      toastError(err, "Yeniden gönderilemedi.");
                    } finally {
                      setPending(false);
                    }
                  })()
                }
              >
                Aktivasyon Davetini Yeniden Gönder
              </Button>
            ) : null}
            {created?.emails.platformNotification?.status !== "SENT" ? (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  void (async () => {
                    if (!auth || !created) return;
                    setPending(true);
                    try {
                      const result = await resendAdminTenantNotification(auth, created.tenant.id);
                      setCreated({
                        ...created,
                        emails: { ...created.emails, platformNotification: result.platformNotification },
                      });
                      showToast(
                        result.platformNotification?.status === "SENT"
                          ? "Platform bildirimi gönderildi."
                          : "Platform bildirimi gönderilemedi.",
                        result.platformNotification?.status === "SENT" ? "success" : "error",
                      );
                    } catch (err) {
                      toastError(err, "Yeniden gönderilemedi.");
                    } finally {
                      setPending(false);
                    }
                  })()
                }
              >
                Bildirimi Yeniden Gönder
              </Button>
            ) : null}
            {created ? (
              <Link href={`/app/admin/tenantlar/${created.tenant.id}`}>
                <Button>Tenant detayı</Button>
              </Link>
            ) : null}
          </>
        }
      >
        {created ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted">Organizasyon:</span> {created.tenant.name}
            </p>
            <p className="text-[12px] text-muted">
              {created.emails.welcome?.status === "SENT"
                ? "Yetkiliye aktivasyon e-postası gönderildi. Kullanıcı bağlantıdan kendi şifresini belirleyecektir."
                : "Organizasyon, kullanıcı, üyelik ve lisans kaydı oluşturuldu. Aktivasyon e-postası gönderilemedi; daveti yeniden gönderebilirsiniz."}
            </p>
            <p>
              <span className="text-muted">Kullanıcı bilgilendirme e-postası:</span>{" "}
              {deliveryLabel(created.emails.welcome)}
              {created.emails.welcome?.safeErrorSummary ? ` — ${created.emails.welcome.safeErrorSummary}` : ""}
            </p>
            <p>
              <span className="text-muted">Platform bildirimi:</span>{" "}
              {deliveryLabel(created.emails.platformNotification)}
              {created.emails.platformNotification?.safeErrorSummary
                ? ` — ${created.emails.platformNotification.safeErrorSummary}`
                : ""}
            </p>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
