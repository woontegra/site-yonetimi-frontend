"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  CalendarDays,
  FileText,
  History,
  LayoutGrid,
  Pencil,
  Plug,
  StickyNote,
  Users,
} from "lucide-react";
import {
  AdminDangerZone,
  AdminDetailHeader,
  AdminDetailInfoBox,
  AdminDetailInfoGrid,
  AdminDetailPanel,
  AdminDetailQuickActions,
  AdminDetailShell,
  AdminDetailStatCard,
  AdminDetailStatsRow,
  AdminDetailTabs,
} from "@/components/admin/detail/AdminDetailPrimitives";
import {
  orgLicenseActions,
  resolveLicenseUiKind,
  type OrgLicenseAction,
} from "@/components/admin/detail/licenseActionMatrix";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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
  convertAdminAnnual,
  createAdminTenantNote,
  deactivateAdminTenant,
  deleteAdminTenant,
  extendAdminDemo,
  extendAdminTenantSubscription,
  getAdminTenant,
  listAdminTenantAuditLogs,
  listAdminTenantNotes,
  listAdminTenantSites,
  listAdminTenantUsers,
  reactivateAdminSubscription,
  renewAdminAnnual,
  resendAdminTenantNotification,
  startAdminAnnual,
  startAdminDemo,
  suspendAdminSubscription,
  type AdminAuditLog,
  type AdminNote,
  type AdminTenantDetail,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

type Tab = "genel" | "siteler" | "kullanicilar" | "abonelik" | "entegrasyonlar" | "gecmis" | "notlar";
type QuickModal =
  | "extend"
  | "convert"
  | "renew"
  | "subscription"
  | "note"
  | "delete"
  | "edit"
  | "startDemo"
  | "startAnnual"
  | "reactivate"
  | "suspend"
  | null;

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

function ModalInfoBox({ label, value }: { label: string; value: string }) {
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

function buildInterventionReasons(tenant: AdminTenantDetail): string[] {
  const sub = tenant.subscription;
  const reasons: string[] = [];
  if (!tenant.isActive) reasons.push("Organizasyon askıda / pasif");
  if (!sub) {
    reasons.push("Lisans yok");
  } else {
    if (sub.status === "SUSPENDED") reasons.push("Lisans askıda");
    if (sub.status === "CANCELLED") reasons.push("Lisans iptal edilmiş");
    const expired =
      sub.status === "EXPIRED" || Boolean(sub.isExpired) || sub.remainingDays < 0 || Boolean(sub.readOnly);
    if (expired) {
      reasons.push(sub.plan === "DEMO" ? "Demo süresi sona ermiş" : "Yıllık lisans süresi dolmuş");
    } else if (sub.status === "ACTIVE" && sub.remainingDays <= 7) {
      reasons.push(sub.plan === "DEMO" ? "Demo süresi bitmek üzere" : "Yıllık lisans bitmek üzere");
    }
  }
  if (tenant.whatsapp?.connectionStatus === "ERROR") {
    reasons.push("WhatsApp entegrasyonu hata durumunda");
  }
  return [...new Set(reasons)];
}

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, tenantId: sessionTenantId } = useAuth();
  const auth = useAdminAuth();
  const { showToast, toastError } = useToast();
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
  const [trialDays, setTrialDays] = useState("3");
  const [endsAt, setEndsAt] = useState("");
  const [licenseReason, setLicenseReason] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);

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
      toastError(err, "İşlem tamamlanamadı.");
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

  const interventionReasons = useMemo(
    () => (tenant ? buildInterventionReasons(tenant) : []),
    [tenant],
  );
  const needsIntervention = interventionReasons.length > 0;

  const licenseKind = resolveLicenseUiKind(sub);
  const quickActionKeys = useMemo(
    () => (tenant ? orgLicenseActions(licenseKind, tenant.isActive) : []),
    [tenant, licenseKind],
  );
  const hasAction = (key: OrgLicenseAction) => quickActionKeys.includes(key);

  if (loading && !tenant) {
    return (
      <AdminDetailShell>
        <p className="text-sm text-muted">Yükleniyor…</p>
      </AdminDetailShell>
    );
  }

  if (error || !tenant) {
    return (
      <AdminDetailShell>
        <p className="text-sm text-danger">{error || "Tenant bulunamadı."}</p>
      </AdminDetailShell>
    );
  }

  const remaining = remainingLabel(sub) ?? (sub ? `${sub.remainingDays} gün kaldı` : null);
  const whatsappLabel = tenant.whatsapp
    ? CONNECTION_LABELS[tenant.whatsapp.connectionStatus] ?? tenant.whatsapp.connectionStatus
    : "Bağlı değil";
  const emailLabel = tenant.email?.connected ? "E-posta bağlı" : "E-posta bağlı değil";

  const activeSiteCount = sites.filter((s) => s.isActive).length;
  const activeUserCount = users.filter((u) => u.isActive).length;
  const siteTotal = tenant.usage.sites;
  const userTotal = tenant.usage.users;
  const messages = tenant.usage.messages;

  const licenseValue = sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "Lisans yok";
  const licenseHint = sub
    ? [remaining, `Bitiş ${formatDateTr(sub.endsAt)}`].filter(Boolean).join(" · ")
    : "Kayıt yok";

  const usageValue =
    typeof messages === "number" && messages > 0 ? `${messages} mesaj` : "—";
  const usageHint =
    typeof messages === "number" && messages > 0
      ? "İletişim kaydı (dönem özeti)"
      : "Kullanım verisi yok";

  const counts = tenant.recordCounts;
  const relatedSites = counts?.sites ?? tenant.usage.sites;
  const relatedUsers = counts?.users ?? tenant.usage.users;
  const relatedDebts = counts?.debts ?? 0;
  const relatedPayments = counts?.payments ?? 0;
  const relatedExpenses = counts?.expenses ?? 0;
  const hardDeleteBlocked =
    Boolean(tenant.isProtected) ||
    relatedSites > 0 ||
    relatedUsers > 0 ||
    relatedDebts > 0 ||
    relatedPayments > 0 ||
    relatedExpenses > 0;

  function openExtend(days = "3") {
    setTrialDays(days);
    setLicenseReason("");
    setQuickModal("extend");
  }

  return (
    <AdminDetailShell>
      <AdminDetailHeader
        backHref="/app/admin/tenantlar"
        backLabel="Organizasyon listesi"
        title={tenant.name}
        subtitle={
          <span className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span>{tenant.owner?.fullName ?? "—"}</span>
            <span className="text-muted">{tenant.owner?.email ?? "—"}</span>
          </span>
        }
        badges={
          <>
            <StatusBadge active={tenant.isActive} />
            {sub ? (
              <Badge tone={sub.plan === "DEMO" ? "info" : "brand"}>
                {PLAN_LABELS[sub.plan] ?? sub.plan}
              </Badge>
            ) : (
              <Badge>Lisans yok</Badge>
            )}
            {remaining ? (
              <Badge tone={sub && sub.remainingDays <= 7 ? "warning" : "neutral"}>{remaining}</Badge>
            ) : null}
            {needsIntervention ? (
              <Badge tone="danger">
                Müdahale gerekli
                {interventionReasons[0] ? ` · ${interventionReasons[0]}` : ""}
              </Badge>
            ) : (
              <Badge tone="success">Normal</Badge>
            )}
          </>
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => setQuickModal("edit")}>
            <Pencil className="size-3.5" aria-hidden />
            Düzenle
          </Button>
        }
      />

      <AdminDetailStatsRow>
        <AdminDetailStatCard
          label="Lisans"
          value={licenseValue}
          hint={licenseHint}
          icon={CalendarDays}
          tone={sub?.plan === "ANNUAL" ? "green" : sub ? "blue" : "amber"}
        />
        <AdminDetailStatCard
          label="Siteler"
          value={`${siteTotal} site`}
          hint={
            sites.length > 0
              ? `${activeSiteCount} aktif`
              : tenant.usage.apartments > 0
                ? `${tenant.usage.apartments} daire`
                : "—"
          }
          icon={Building2}
          tone="teal"
        />
        <AdminDetailStatCard
          label="Kullanıcılar"
          value={`${userTotal} kullanıcı`}
          hint={users.length > 0 ? `${activeUserCount} aktif` : "—"}
          icon={Users}
          tone="blue"
        />
        <AdminDetailStatCard
          label="Kullanım"
          value={usageValue}
          hint={usageHint}
          icon={Activity}
          tone="amber"
        />
      </AdminDetailStatsRow>

      <AdminDetailQuickActions>
        {hasAction("resend") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              void run(() => resendAdminTenantNotification(auth!, id), "Davet e-postası yeniden gönderildi.")
            }
          >
            Davet E-postasını Yeniden Gönder
          </Button>
        ) : null}
        {hasAction("demoPlus3") ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => openExtend("3")}>
            +3 Gün
          </Button>
        ) : null}
        {hasAction("demoExtend") ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => openExtend("7")}>
            Demo Süresi Ekle
          </Button>
        ) : null}
        {hasAction("convertAnnual") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setQuickModal("convert");
            }}
          >
            Yıllığa Dönüştür
          </Button>
        ) : null}
        {hasAction("renewAnnual") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setQuickModal("renew");
            }}
          >
            Yıllık Yenile
          </Button>
        ) : null}
        {hasAction("customEnds") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setEndsAt("");
              setQuickModal("subscription");
            }}
          >
            Özel Süre Ekle
          </Button>
        ) : null}
        {hasAction("startDemo") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setTrialDays("7");
              setLicenseReason("");
              setQuickModal("startDemo");
            }}
          >
            Demo Başlat
          </Button>
        ) : null}
        {hasAction("startAnnual") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setQuickModal("startAnnual");
            }}
          >
            Yıllık Lisans Başlat
          </Button>
        ) : null}
        {hasAction("suspendLicense") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setQuickModal("suspend");
            }}
          >
            Askıya Al
          </Button>
        ) : null}
        {hasAction("reactivateLicense") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setQuickModal("reactivate");
            }}
          >
            Yeniden Etkinleştir
          </Button>
        ) : null}
        {hasAction("manage") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLicenseReason("");
              setEndsAt("");
              setQuickModal("subscription");
            }}
          >
            Lisansı Yönet
          </Button>
        ) : null}
        {hasAction("note") ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setQuickModal("note")}>
            Admin Notu Ekle
          </Button>
        ) : null}
        {hasAction("deactivate") ? (
          <Button size="sm" variant="secondary" onClick={() => setConfirm("deactivate")}>
            Pasife Al
          </Button>
        ) : null}
        {hasAction("activate") ? (
          <Button size="sm" variant="secondary" onClick={() => setConfirm("activate")}>
            Aktifleştir
          </Button>
        ) : null}
      </AdminDetailQuickActions>

      <AdminDetailTabs
        tabs={[
          { id: "genel", label: "Genel", icon: LayoutGrid },
          { id: "siteler", label: "Siteler", icon: Building2 },
          { id: "kullanicilar", label: "Kullanıcılar", icon: Users },
          { id: "abonelik", label: "Lisans", icon: CalendarDays },
          { id: "entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
          { id: "gecmis", label: "İşlem Geçmişi", icon: History },
          { id: "notlar", label: "Admin Notları", icon: StickyNote },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === "genel" ? (
          <AdminDetailPanel
            title="Genel Özet"
            description="Organizasyon kimliği ve mevcut lisans durumu"
          >
            <AdminDetailInfoGrid wide>
              <AdminDetailInfoBox label="Organizasyon adı" value={dash(tenant.name)} />
              <AdminDetailInfoBox label="Yönetici" value={dash(tenant.owner?.fullName)} />
              <AdminDetailInfoBox label="Yönetici e-postası" value={dash(tenant.owner?.email)} />
              <AdminDetailInfoBox label="Oluşturulma tarihi" value={formatDateTr(tenant.createdAt)} />
              <AdminDetailInfoBox label="Durum" value={tenant.isActive ? "Aktif" : "Pasif"} />
              <AdminDetailInfoBox
                label="Lisans"
                value={
                  sub
                    ? `${PLAN_LABELS[sub.plan] ?? sub.plan} · ${SUB_STATUS_LABELS[sub.status] ?? sub.status}`
                    : "Lisans yok"
                }
              />
            </AdminDetailInfoGrid>
            {needsIntervention ? (
              <div className="mt-3 rounded-[12px] border border-rose-200/70 bg-rose-50/40 px-3 py-2.5">
                <p className="text-[11px] font-medium text-rose-800">Müdahale nedenleri</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-ink">
                  {interventionReasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-muted">Müdahale durumu: Normal</p>
            )}
          </AdminDetailPanel>
        ) : null}

        {tab === "siteler" ? (
          <AdminDetailPanel title="Siteler" bodyClassName="px-0 py-0">
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
          </AdminDetailPanel>
        ) : null}

        {tab === "kullanicilar" ? (
          <AdminDetailPanel title="Kullanıcılar" bodyClassName="px-0 py-0">
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
          </AdminDetailPanel>
        ) : null}

        {tab === "abonelik" ? (
          <AdminDetailPanel title="Lisans" description="Organizasyon abonelik ve plan bilgileri">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-[12px] border border-line bg-slate-50 p-4 sm:rounded-[14px]">
                <h3 className="text-sm font-medium text-ink">Lisans Bilgileri</h3>
                <div className="mt-3 grid gap-3">
                  <AdminDetailInfoBox label="Lisans türü" value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"} />
                  <AdminDetailInfoBox label="Durum" value={sub ? SUB_STATUS_LABELS[sub.status] ?? sub.status : "—"} />
                  <AdminDetailInfoBox label="Başlangıç tarihi" value={sub ? formatDateTr(sub.startsAt) : "—"} />
                  <AdminDetailInfoBox label="Bitiş tarihi" value={sub ? formatDateTr(sub.endsAt) : "—"} />
                  <AdminDetailInfoBox label="Kalan gün" value={sub ? String(sub.remainingDays) : "—"} />
                </div>
              </div>
              <div className="rounded-[12px] border border-line bg-slate-50 p-4 sm:rounded-[14px]">
                <h3 className="text-sm font-medium text-ink">Plan Bilgileri</h3>
                <div className="mt-3 grid gap-3">
                  <AdminDetailInfoBox label="Mevcut plan" value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"} />
                  <AdminDetailInfoBox
                    label="Demo / yıllık durumu"
                    value={sub ? (sub.plan === "DEMO" ? "Demo" : "Yıllık lisans") : "—"}
                  />
                  <AdminDetailInfoBox label="Son değişiklik" value={sub?.updatedAt ? formatDateTr(sub.updatedAt) : "—"} />
                  <AdminDetailInfoBox label="Abonelik notu" value={dash(sub?.note)} />
                </div>
              </div>
            </div>
          </AdminDetailPanel>
        ) : null}

        {tab === "entegrasyonlar" ? (
          <AdminDetailPanel title="Entegrasyonlar">
            {tenant.whatsapp || tenant.email ? (
              <AdminDetailInfoGrid>
                <AdminDetailInfoBox label="WhatsApp" value={whatsappLabel} />
                <AdminDetailInfoBox label="E-posta" value={emailLabel} />
              </AdminDetailInfoGrid>
            ) : (
              <EmptyState title="Entegrasyon kaydı yok" description="Bu tenant için yerel bağlantı özeti bulunmuyor." icon={Plug} />
            )}
          </AdminDetailPanel>
        ) : null}

        {tab === "gecmis" ? (
          <AdminDetailPanel title="İşlem Geçmişi" bodyClassName="px-0 py-0">
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
          </AdminDetailPanel>
        ) : null}

        {tab === "notlar" ? (
          <AdminDetailPanel title="Admin Notları">
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
          </AdminDetailPanel>
        ) : null}
      </div>

      <AdminDangerZone open={dangerOpen} onToggle={() => setDangerOpen((v) => !v)}>
        {hardDeleteBlocked ? (
          <div className="space-y-2">
            <p className="text-[12px] text-rose-800">
              Bu organizasyon geçmiş ve ilişkili kayıtları bulunduğu için kalıcı olarak silinemez. Pasife
              alabilirsiniz.
            </p>
            {tenant.isProtected ? (
              <p className="text-[11px] text-muted">Korumalı ana tenant silinemez.</p>
            ) : (
              <p className="text-[11px] text-muted">
                Siteler: {relatedSites} · Kullanıcılar: {relatedUsers} · Borçlar: {relatedDebts} · Tahsilatlar:{" "}
                {relatedPayments} · Giderler: {relatedExpenses}
              </p>
            )}
            <Button size="sm" variant="secondary" onClick={() => setConfirm("deactivate")} disabled={!tenant.isActive}>
              Pasife Al
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] text-muted">
              İlişkili site, kullanıcı veya finansal kayıt yoksa kalıcı silme açılabilir. İşlem geri alınamaz.
            </p>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setDeleteConfirmName("");
                setQuickModal("delete");
              }}
            >
              Organizasyonu Kalıcı Olarak Sil
            </Button>
          </div>
        )}
      </AdminDangerZone>

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
        footer={
          <Button variant="secondary" onClick={() => setQuickModal(null)}>
            Kapat
          </Button>
        }
      >
        <div className="grid gap-3">
          <ModalInfoBox label="Organizasyon" value={tenant.name} />
          <ModalInfoBox label="Yönetici" value={dash(tenant.owner?.fullName)} />
        </div>
      </Modal>

      <Modal
        open={quickModal === "extend"}
        title="Demo süresi uzat"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              disabled={pending || !Number.isFinite(trialDaysNum) || trialDaysNum < 1 || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => extendAdminDemo(auth!, id, { days: trialDaysNum, reason: licenseReason.trim() }),
                  "Demo süresi güncellendi.",
                )
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
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
            />
          </label>
          <ModalInfoBox label="Mevcut bitiş tarihi" value={sub ? formatDateTr(sub.endsAt) : "—"} />
          <ModalInfoBox label="İşlem sonrası yeni bitiş tarihi" value={trialPreview ? formatDateTr(trialPreview) : "—"} />
        </div>
      </Modal>

      <Modal
        open={quickModal === "startDemo"}
        title="Demo başlat"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              disabled={pending || !Number.isFinite(trialDaysNum) || trialDaysNum < 1 || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => startAdminDemo(auth!, id, { days: trialDaysNum, reason: licenseReason.trim() }),
                  "Demo lisansı başlatıldı.",
                )
              }
            >
              Başlat
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="text-sm text-ink">
            Demo gün sayısı
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
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "convert"}
        title="Yıllığa dönüştür"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              disabled={pending || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => convertAdminAnnual(auth!, id, { reason: licenseReason.trim(), netPrice: 4000 }),
                  "Yıllık lisansa dönüştürüldü.",
                )
              }
            >
              Dönüştür
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <ModalInfoBox label="Mevcut plan" value={sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "—"} />
          <p className="text-[12px] text-muted">Varsayılan: 4.000 ₺ net + %20 KDV = 4.800 ₺</p>
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
              data-modal-autofocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "startAnnual"}
        title="Yıllık lisans başlat"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              disabled={pending || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => startAdminAnnual(auth!, id, { reason: licenseReason.trim(), netPrice: 4000 }),
                  "Yıllık lisans başlatıldı.",
                )
              }
            >
              Başlat
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p className="text-[12px] text-muted">Varsayılan: 4.000 ₺ net + %20 KDV = 4.800 ₺ · 365 gün</p>
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
              data-modal-autofocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "renew"}
        title="Yıllık yenile (365)"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              disabled={pending || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => renewAdminAnnual(auth!, id, { reason: licenseReason.trim() }),
                  "Yıllık lisans yenilendi.",
                )
              }
            >
              Yenile
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <ModalInfoBox label="Mevcut bitiş" value={sub ? formatDateTr(sub.endsAt) : "—"} />
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
              data-modal-autofocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "reactivate"}
        title="Lisansı yeniden etkinleştir"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              disabled={pending || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => reactivateAdminSubscription(auth!, id, licenseReason.trim()),
                  "Lisans yeniden etkinleştirildi.",
                )
              }
            >
              Etkinleştir
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <ModalInfoBox label="Mevcut durum" value={sub ? SUB_STATUS_LABELS[sub.status] ?? sub.status : "—"} />
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
              data-modal-autofocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "suspend"}
        title="Lisansı askıya al"
        onClose={() => setQuickModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
            <Button
              variant="danger"
              disabled={pending || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => suspendAdminSubscription(auth!, id, licenseReason.trim()),
                  "Lisans askıya alındı.",
                )
              }
            >
              Askıya Al
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p className="text-[12px] text-muted">
            Askıya alınan organizasyon yazma işlemleri yapamaz. Yeniden etkinleştirme ile geri alınır.
          </p>
          <label className="text-sm text-ink">
            Gerekçe
            <Textarea
              className="mt-1"
              rows={2}
              value={licenseReason}
              onChange={(e) => setLicenseReason(e.target.value)}
              data-modal-autofocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={quickModal === "subscription"}
        title="Lisansı Yönet"
        onClose={() => setQuickModal(null)}
        footer={
          <Button variant="secondary" onClick={() => setQuickModal(null)}>
            Kapat
          </Button>
        }
      >
        <label className="mb-3 block text-sm text-ink">
          Gerekçe
          <Textarea
            className="mt-1"
            rows={2}
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="secondary"
            disabled={pending || licenseReason.trim().length < 5}
            onClick={() =>
              void run(
                () => extendAdminDemo(auth!, id, { days: 3, reason: licenseReason.trim() }),
                "+3 gün uygulandı.",
              )
            }
          >
            +3 gün
          </Button>
          <Button
            variant="secondary"
            disabled={pending || licenseReason.trim().length < 5}
            onClick={() =>
              void run(
                () => extendAdminDemo(auth!, id, { days: 7, reason: licenseReason.trim() }),
                "+7 gün uygulandı.",
              )
            }
          >
            +7 gün
          </Button>
        </div>
        <label className="mt-4 block text-sm text-ink">
          Özel bitiş tarihi
          <Input className="mt-1" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <Button
          className="mt-3 w-full sm:w-auto"
          disabled={!endsAt || pending || licenseReason.trim().length < 5}
          onClick={() =>
            void run(
              () =>
                extendAdminTenantSubscription(auth!, id, {
                  endsAt: new Date(endsAt).toISOString(),
                  reason: licenseReason.trim(),
                }),
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
            <Button variant="secondary" onClick={() => setQuickModal(null)}>
              İptal
            </Button>
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
                    toastError(err, "İşlem tamamlanamadı.");
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
          <ModalInfoBox label="Tenant" value={tenant.name} />
          <ModalInfoBox label="Siteler" value={String(tenant.recordCounts?.sites ?? tenant.usage.sites)} />
          <ModalInfoBox label="Daireler" value={String(tenant.recordCounts?.apartments ?? tenant.usage.apartments)} />
          <ModalInfoBox label="Kullanıcılar" value={String(tenant.recordCounts?.users ?? tenant.usage.users)} />
          <ModalInfoBox label="Kişiler" value={String(tenant.recordCounts?.persons ?? tenant.usage.persons)} />
          <ModalInfoBox label="Borçlar" value={String(tenant.recordCounts?.debts ?? 0)} />
          <ModalInfoBox label="Tahsilatlar" value={String(tenant.recordCounts?.payments ?? 0)} />
          <ModalInfoBox label="Giderler" value={String(tenant.recordCounts?.expenses ?? 0)} />
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
    </AdminDetailShell>
  );
}
