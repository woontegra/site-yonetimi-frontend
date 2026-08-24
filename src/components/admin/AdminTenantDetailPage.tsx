"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Cable,
  FileText,
  History,
  LayoutGrid,
  Pencil,
  Plug,
  StickyNote,
  Users,
} from "lucide-react";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  AUDIT_ACTION_LABELS,
  CONNECTION_LABELS,
  PLAN_LABELS,
  SUB_STATUS_LABELS,
  remainingLabel,
  roleLabel,
} from "@/components/admin/labels";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  activateAdminTenant,
  changeAdminSubscriptionPlan,
  createAdminTenantNote,
  deactivateAdminTenant,
  deleteAdminTenant,
  extendAdminTenantSubscription,
  getAdminTenant,
  listAdminTenantAuditLogs,
  listAdminTenantNotes,
  listAdminTenantSites,
  listAdminTenantUsers,
  resendAdminTenantNotification,
  trialAdminTenantSubscription,
  type AdminAuditLog,
  type AdminNote,
  type AdminTenantDetail,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

type Tab = "genel" | "siteler" | "kullanicilar" | "abonelik" | "entegrasyonlar" | "gecmis" | "notlar";
type QuickModal = "trial" | "plan" | "subscription" | "note" | "delete" | "edit" | null;

type TenantSiteRow = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  isActive: boolean;
  setupStatus: string;
  buildingCount: number;
  createdAt: string;
};

type TenantUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function addDaysIso(iso: string | undefined, days: number): string | null {
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-line bg-slate-50 px-3 py-3 sm:rounded-[14px]">
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function clearDeletedTenantClientState(tenantId: string, currentTenantId: string | null) {
  try {
    window.localStorage.removeItem(`sy_active_site:${tenantId}`);
    if (currentTenantId === tenantId) {
      window.localStorage.removeItem("sy_active_site");
      document.cookie = "sy_site_id=; path=/; Max-Age=0; SameSite=Lax";
    }
  } catch {
    /* ignore */
  }
}

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, tenantId: sessionTenantId } = useAuth();
  const auth = useAdminAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("genel");
  const [tenant, setTenant] = useState<AdminTenantDetail | null>(null);
  const [sites, setSites] = useState<TenantSiteRow[]>([]);
  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<"deactivate" | "activate" | null>(null);
  const [quickModal, setQuickModal] = useState<QuickModal>(null);
  const [trialDays, setTrialDays] = useState("7");
  const [plan, setPlan] = useState("STANDARD");
  const [endsAt, setEndsAt] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const load = useCallback(async () => {
    if (!auth || !id) return;
    setLoading(true);
    setError("");
    try {
      const [{ tenant: next }, siteRes, userRes, noteRes, logRes] = await Promise.all([
        getAdminTenant(auth, id),
        listAdminTenantSites(auth, id),
        listAdminTenantUsers(auth, id),
        listAdminTenantNotes(auth, id),
        listAdminTenantAuditLogs(auth, id, { page: 1, perPage: 20 }),
      ]);
      setTenant(next);
      setSites(siteRes.items as TenantSiteRow[]);
      setUsers(userRes.items as TenantUserRow[]);
      setNotes(noteRes.items);
      setLogs(logRes.items);
      if (next.subscription) setPlan(next.subscription.plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tenant yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function run(action: () => Promise<unknown>, message: string) {
    setPending(true);
    try {
      await action();
      showToast(message);
      setQuickModal(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  const sub = tenant?.subscription ?? null;
  const trialDaysNum = Number(trialDays);
  const trialPreview = useMemo(
    () => (Number.isFinite(trialDaysNum) && trialDaysNum > 0 ? addDaysIso(undefined, trialDaysNum) : null),
    [trialDaysNum],
  );

  const needsIntervention = Boolean(
    tenant &&
      (!tenant.isActive ||
        (sub && (sub.status === "EXPIRED" || sub.remainingDays <= 7)) ||
        tenant.whatsapp?.connectionStatus === "ERROR"),
  );

  if (loading && !tenant) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Yükleniyor…</p>
      </PageContainer>
    );
  }

  if (error || !tenant) {
    return (
      <PageContainer>
        <p className="text-sm text-danger">{error || "Tenant bulunamadı."}</p>
      </PageContainer>
    );
  }

  const remaining = remainingLabel(sub) ?? (sub ? `${sub.remainingDays} gün kaldı` : null);
  const whatsappLabel = tenant.whatsapp
    ? CONNECTION_LABELS[tenant.whatsapp.connectionStatus] ?? tenant.whatsapp.connectionStatus
    : "Bağlı değil";
  const emailLabel = tenant.email?.connected ? "E-posta bağlı" : "E-posta bağlı değil";
  const connectedCount = tenant.integrationSummary?.connectedCount ?? Number(Boolean(tenant.whatsapp?.connectionStatus === "CONNECTED")) + Number(Boolean(tenant.email?.connected));

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/admin/tenantlar"
        backLabel="Tenant listesi"
        title={tenant.name}
        description={
          <div className="space-y-2">
            <p className="break-words">{tenant.owner?.fullName ?? "—"}</p>
            <p className="break-all text-muted">{tenant.owner?.email ?? "—"}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <StatusBadge active={tenant.isActive} />
              {sub ? <Badge tone="brand">{PLAN_LABELS[sub.plan] ?? sub.plan}</Badge> : <Badge>Plan yok</Badge>}
              {remaining ? <Badge tone={sub && sub.remainingDays <= 7 ? "warning" : "neutral"}>{remaining}</Badge> : null}
              {needsIntervention ? <Badge tone="danger">Müdahale Gerekli</Badge> : null}
            </div>
          </div>
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => setQuickModal("edit")}>
            <Pencil className="size-3.5" aria-hidden />
            Düzenle
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Abonelik"
          value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"}
          hint={sub ? remaining ?? formatDateTr(sub.endsAt) : "Kayıt yok"}
          icon={CalendarDays}
        />
        <StatCard
          label="Organizasyon"
          value={`${tenant.usage.sites} site`}
          hint={`${tenant.usage.apartments} daire`}
          icon={Building2}
        />
        <StatCard
          label="Kullanım"
          value={`${tenant.usage.users} kullanıcı`}
          hint={`${tenant.usage.messages} iletişim kaydı`}
          icon={LayoutGrid}
        />
        <StatCard
          label="Entegrasyonlar"
          value={`${connectedCount} bağlı`}
          hint={`${whatsappLabel} · ${emailLabel}`}
          icon={Cable}
        />
      </div>

      <SectionCard
        className="mb-5"
        title="Hızlı İşlemler"
        description="Bu tenant için platform işlemlerini tek yerden yönetin."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() =>
              void run(() => resendAdminTenantNotification(auth!, id), "Davet e-postası yeniden gönderildi.")
            }
          >
            Davet E-postasını Yeniden Gönder
          </Button>
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => setQuickModal("trial")}>
            Deneme Süresi Ekle
          </Button>
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => setQuickModal("plan")}>
            Planı Değiştir
          </Button>
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => setQuickModal("subscription")}>
            Aboneliği Yönet
          </Button>
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => setQuickModal("note")}>
            Admin Notu Ekle
          </Button>
          {tenant.isActive ? (
            <Button variant="secondary" className="w-full" onClick={() => setConfirm("deactivate")}>
              Pasife Al
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setConfirm("activate")}>
              Aktifleştir
            </Button>
          )}
          <div className="sm:col-span-2 lg:col-span-3 mt-1 border-t border-line pt-3">
            <Button
              variant="danger"
              className="w-full sm:w-auto"
              disabled={tenant.isProtected}
              onClick={() => {
                setDeleteConfirmName("");
                setQuickModal("delete");
              }}
            >
              Tenantı Kalıcı Olarak Sil
            </Button>
            {tenant.isProtected ? (
              <p className="mt-2 text-caption text-muted">Korumalı ana tenant silinemez.</p>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <DetailTabs
        tabs={[
          { id: "genel", label: "Genel", icon: LayoutGrid },
          { id: "siteler", label: "Siteler", icon: Building2 },
          { id: "kullanicilar", label: "Kullanıcılar", icon: Users },
          { id: "abonelik", label: "Abonelik", icon: CalendarDays },
          { id: "entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
          { id: "gecmis", label: "İşlem Geçmişi", icon: History },
          { id: "notlar", label: "Admin Notları", icon: StickyNote },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "genel" ? (
        <SurfaceCard>
          <h2 className="text-section text-ink">Genel Özet</h2>
          <p className="mt-1 text-sm text-muted">Organizasyon kimliği ve mevcut kullanım durumu</p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <InfoBox label="Organizasyon adı" value={dash(tenant.name)} />
            <InfoBox label="Yönetici" value={dash(tenant.owner?.fullName)} />
            <InfoBox label="Yönetici e-postası" value={dash(tenant.owner?.email)} />
            <InfoBox label="Oluşturulma tarihi" value={formatDateTr(tenant.createdAt)} />
            <InfoBox label="Slug" value={dash(tenant.slug)} />
            <InfoBox label="Durum" value={tenant.isActive ? "Aktif" : "Pasif"} />
          </div>
        </SurfaceCard>
      ) : null}

      {tab === "siteler" ? (
        <SurfaceCard padding="none">
          {sites.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Site kaydı yok" description="Bu tenant altında henüz site bulunmuyor." icon={Building2} />
            </div>
          ) : (
            <Table>
              <TableElement>
                <THead>
                  <TR>
                    <TH>Site</TH>
                    <TH>Şehir</TH>
                    <TH>Bina</TH>
                    <TH>Durum</TH>
                  </TR>
                </THead>
                <TBody>
                  {sites.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <Link href={`/app/admin/siteler/${item.id}`} className="hover:text-accent">
                          {item.name}
                        </Link>
                      </TD>
                      <TD>{[item.city, item.district].filter(Boolean).join(" / ") || "—"}</TD>
                      <TD>{item.buildingCount}</TD>
                      <TD>
                        <StatusBadge active={item.isActive} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableElement>
            </Table>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "kullanicilar" ? (
        <SurfaceCard padding="none">
          {users.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Kullanıcı kaydı yok" description="Bu tenant altında kullanıcı bulunmuyor." icon={Users} />
            </div>
          ) : (
            <Table>
              <TableElement>
                <THead>
                  <TR>
                    <TH>Ad Soyad</TH>
                    <TH>E-posta</TH>
                    <TH>Rol</TH>
                    <TH>Durum</TH>
                  </TR>
                </THead>
                <TBody>
                  {users.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <Link href={`/app/admin/kullanicilar/${item.id}`} className="hover:text-accent">
                          {item.fullName}
                        </Link>
                      </TD>
                      <TD className="max-w-[220px] break-all">{item.email}</TD>
                      <TD>{roleLabel(item.role)}</TD>
                      <TD>
                        <StatusBadge active={item.isActive} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableElement>
            </Table>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "abonelik" ? (
        <SurfaceCard>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[12px] border border-line bg-slate-50 p-4 sm:rounded-[14px]">
              <h3 className="text-sm font-medium text-ink">Abonelik Bilgileri</h3>
              <div className="mt-3 grid gap-3">
                <InfoBox label="Abonelik türü" value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"} />
                <InfoBox label="Durum" value={sub ? SUB_STATUS_LABELS[sub.status] ?? sub.status : "—"} />
                <InfoBox label="Başlangıç tarihi" value={sub ? formatDateTr(sub.startsAt) : "—"} />
                <InfoBox label="Bitiş tarihi" value={sub ? formatDateTr(sub.endsAt) : "—"} />
                <InfoBox label="Kalan gün" value={sub ? String(sub.remainingDays) : "—"} />
              </div>
            </div>
            <div className="rounded-[12px] border border-line bg-slate-50 p-4 sm:rounded-[14px]">
              <h3 className="text-sm font-medium text-ink">Plan Bilgileri</h3>
              <div className="mt-3 grid gap-3">
                <InfoBox label="Mevcut plan" value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"} />
                <InfoBox
                  label="Deneme / ücretli durumu"
                  value={sub ? (sub.status === "TRIAL" ? "Deneme" : "Ücretli / lisans") : "—"}
                />
                <InfoBox label="Son değişiklik" value={sub?.updatedAt ? formatDateTr(sub.updatedAt) : "—"} />
                <InfoBox label="Abonelik notu" value={dash(sub?.note)} />
              </div>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      {tab === "entegrasyonlar" ? (
        <SurfaceCard>
          {tenant.whatsapp || tenant.email ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBox label="WhatsApp" value={whatsappLabel} />
              <InfoBox label="E-posta" value={emailLabel} />
            </div>
          ) : (
            <EmptyState title="Entegrasyon kaydı yok" description="Bu tenant için yerel bağlantı özeti bulunmuyor." icon={Plug} />
          )}
        </SurfaceCard>
      ) : null}

      {tab === "gecmis" ? (
        <SurfaceCard padding="none">
          {logs.length === 0 ? (
            <div className="p-5">
              <EmptyState title="İşlem geçmişi yok" description="Bu tenant için henüz admin işlemi kaydı yok." icon={History} />
            </div>
          ) : (
            <Table>
              <TableElement>
                <THead>
                  <TR>
                    <TH>İşlem</TH>
                    <TH>Admin</TH>
                    <TH>Tarih</TH>
                  </TR>
                </THead>
                <TBody>
                  {logs.map((item) => (
                    <TR key={item.id}>
                      <TD>{AUDIT_ACTION_LABELS[item.action] ?? item.action}</TD>
                      <TD>{item.adminUser.fullName}</TD>
                      <TD>{formatDateTr(item.createdAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </TableElement>
            </Table>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "notlar" ? (
        <SurfaceCard>
          {notes.length === 0 ? (
            <EmptyState title="Admin notu yok" description="Hızlı işlemlerden not ekleyebilirsiniz." icon={FileText} />
          ) : (
            <ul className="divide-y divide-line">
              {notes.map((item) => (
                <li key={item.id} className="py-3 first:pt-0">
                  <p className="text-sm text-ink">{item.content}</p>
                  <p className="mt-1 text-caption text-muted">
                    {item.adminUser.fullName} · {formatDateTr(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      ) : null}

      <ConfirmDialog
        open={confirm === "deactivate"}
        title="Tenant pasife alınsın mı?"
        description="Tenant hesap olarak pasif olur. Kayıt silinmez."
        danger
        pending={pending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run(() => deactivateAdminTenant(auth!, id), "Tenant pasife alındı.")}
      />
      <ConfirmDialog
        open={confirm === "activate"}
        title="Tenant aktifleştirilsin mi?"
        description="Tenant yeniden aktif olur."
        pending={pending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run(() => activateAdminTenant(auth!, id), "Tenant aktifleştirildi.")}
      />

      <Modal
        open={quickModal === "edit"}
        title="Tenant düzenle"
        description="Kimlik alanları Genel sekmesinde görüntülenir. Bu fazda ad güncelleme endpoint’i yoktur."
        onClose={() => setQuickModal(null)}
        footer={<Button variant="secondary" onClick={() => setQuickModal(null)}>Kapat</Button>}
      >
        <div className="grid gap-3">
          <InfoBox label="Organizasyon" value={tenant.name} />
          <InfoBox label="Yönetici" value={dash(tenant.owner?.fullName)} />
        </div>
      </Modal>

      <Modal
        open={quickModal === "trial"}
        title="Deneme Süresi Ekle"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>İptal</Button>
            <Button
              disabled={pending || !Number.isFinite(trialDaysNum) || trialDaysNum < 1}
              onClick={() =>
                void run(() => trialAdminTenantSubscription(auth!, id, trialDaysNum), "Deneme süresi verildi.")
              }
            >
              Onayla
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="text-sm text-ink">
            Eklenecek gün sayısı
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={90}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              data-modal-autofocus
            />
          </label>
          <InfoBox label="Mevcut bitiş tarihi" value={sub ? formatDateTr(sub.endsAt) : "—"} />
          <InfoBox label="İşlem sonrası yeni bitiş tarihi" value={trialPreview ? formatDateTr(trialPreview) : "—"} />
        </div>
      </Modal>

      <Modal
        open={quickModal === "plan"}
        title="Planı Değiştir"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>İptal</Button>
            <Button
              disabled={pending}
              onClick={() => void run(() => changeAdminSubscriptionPlan(auth!, id, plan), "Plan güncellendi.")}
            >
              Planı Uygula
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <InfoBox label="Mevcut plan" value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"} />
          <label className="text-sm text-ink">
            Yeni plan
            <Select className="mt-1" value={plan} onChange={(e) => setPlan(e.target.value)} data-modal-autofocus>
              <option value="DEMO">Demo</option>
              <option value="STANDARD">Standart</option>
              <option value="PROFESSIONAL">Profesyonel</option>
            </Select>
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "subscription"}
        title="Aboneliği Yönet"
        onClose={() => setQuickModal(null)}
        footer={<Button variant="secondary" onClick={() => setQuickModal(null)}>Kapat</Button>}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void run(() => extendAdminTenantSubscription(auth!, id, { days: 7 }), "+7 gün uygulandı.")}
          >
            +7 gün
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void run(() => extendAdminTenantSubscription(auth!, id, { days: 30 }), "+30 gün uygulandı.")}
          >
            +30 gün
          </Button>
        </div>
        <label className="mt-4 block text-sm text-ink">
          Özel bitiş tarihi
          <Input className="mt-1" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <Button
          className="mt-3 w-full sm:w-auto"
          disabled={!endsAt || pending}
          onClick={() =>
            void run(
              () => extendAdminTenantSubscription(auth!, id, { endsAt: new Date(endsAt).toISOString() }),
              "Bitiş tarihi güncellendi.",
            )
          }
        >
          Özel tarihi uygula
        </Button>
      </Modal>

      <Modal
        open={quickModal === "note"}
        title="Admin Notu Ekle"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>İptal</Button>
            <Button
              disabled={pending || !note.trim()}
              onClick={() =>
                void run(async () => {
                  await createAdminTenantNote(auth!, id, note.trim());
                  setNote("");
                }, "Not eklendi.")
              }
            >
              Kaydet
            </Button>
          </>
        }
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Support notu" data-modal-autofocus />
      </Modal>

      <Modal
        open={quickModal === "delete"}
        title="Tenantı kalıcı olarak sil"
        description="Bu işlem geri alınamaz. Tenant ile birlikte kullanıcılar, siteler, binalar, daireler, kişiler, borçlar, tahsilatlar, giderler ve tenant’a ait entegrasyon kayıtları kalıcı olarak silinecektir."
        icon={FileText}
        iconTone="danger"
        variant="confirm"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)} disabled={pending}>
              İptal
            </Button>
            <Button
              variant="danger"
              disabled={pending || deleteConfirmName !== tenant.name}
              onClick={() =>
                void (async () => {
                  setPending(true);
                  try {
                    await deleteAdminTenant(auth!, id, deleteConfirmName);
                    clearDeletedTenantClientState(id, sessionTenantId);
                    showToast("Tenant ve ilişkili verileri kalıcı olarak silindi.");
                    router.push("/app/admin/tenantlar");
                    router.refresh();
                  } catch (err) {
                    showToast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
                  } finally {
                    setPending(false);
                  }
                })()
              }
            >
              Tenantı Kalıcı Olarak Sil
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <InfoBox label="Tenant" value={tenant.name} />
          <InfoBox label="Siteler" value={String(tenant.recordCounts?.sites ?? tenant.usage.sites)} />
          <InfoBox label="Daireler" value={String(tenant.recordCounts?.apartments ?? tenant.usage.apartments)} />
          <InfoBox label="Kullanıcılar" value={String(tenant.recordCounts?.users ?? tenant.usage.users)} />
          <InfoBox label="Kişiler" value={String(tenant.recordCounts?.persons ?? tenant.usage.persons)} />
          <InfoBox label="Borçlar" value={String(tenant.recordCounts?.debts ?? 0)} />
          <InfoBox label="Tahsilatlar" value={String(tenant.recordCounts?.payments ?? 0)} />
          <InfoBox label="Giderler" value={String(tenant.recordCounts?.expenses ?? 0)} />
        </div>
        <label className="mt-4 block text-sm text-ink">
          Onay için tenant adını birebir yazın
          <Input
            className="mt-1"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={tenant.name}
            data-modal-autofocus
          />
        </label>
      </Modal>
    </PageContainer>
  );
}
