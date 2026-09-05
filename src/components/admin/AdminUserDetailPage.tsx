"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  History,
  KeyRound,
  LogIn,
  Mail,
  Pencil,
  StickyNote,
  User as UserIcon,
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
  resolveLicenseUiKind,
  userLicenseActions,
  type UserLicenseAction,
} from "@/components/admin/detail/licenseActionMatrix";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  AUDIT_ACTION_LABELS,
  PLAN_LABELS,
  SUB_STATUS_LABELS,
  remainingLabel,
  roleLabel,
} from "@/components/admin/labels";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  activateAdminUser,
  convertAdminAnnual,
  createAdminUserNote,
  deactivateAdminUser,
  deleteAdminUser,
  extendAdminDemo,
  extendAdminTenantSubscription,
  getAdminUser,
  listAdminUserActivity,
  listAdminUserAuditLogs,
  listAdminUserCommunications,
  listAdminUserNotes,
  listAdminUserTenantSites,
  previewAdminUserDelete,
  reactivateAdminSubscription,
  resendAdminUserInvite,
  renewAdminAnnual,
  startAdminAnnual,
  startAdminDemo,
  suspendAdminSubscription,
  updateAdminUser,
  updateAdminUserAccess,
  type AdminAuditLog,
  type AdminNote,
  type AdminUserActivityItem,
  type AdminUserCommunicationItem,
  type AdminUserDeletePreview,
  type AdminUserDetail,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

type Tab =
  | "genel"
  | "organizasyon"
  | "siteler"
  | "islem"
  | "iletisim"
  | "notlar";

type QuickModal =
  | "edit"
  | "note"
  | "access"
  | "license"
  | "deactivate"
  | "delete"
  | "extend"
  | "convert"
  | "renew"
  | "startAnnual"
  | "startDemo"
  | "customEnds"
  | "reactivate"
  | "suspend"
  | null;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function interventionLabel(status: AdminUserDetail["interventionStatus"]) {
  switch (status) {
    case "passive":
      return "Pasif";
    case "activation_pending":
      return "Aktivasyon bekliyor";
    case "org_blocked":
      return "Organizasyon nedeniyle erişemiyor";
    default:
      return "Normal";
  }
}

function buildUserInterventionReasons(user: AdminUserDetail): string[] {
  const reasons: string[] = [];
  const sub = user.subscription;

  if (!user.isActive || user.interventionStatus === "passive") {
    reasons.push("Kullanıcı pasif");
  }
  if (user.activationPending || user.membershipStatus === "INVITED" || user.interventionStatus === "activation_pending") {
    reasons.push("Aktivasyon tamamlanmamış");
  }
  if (user.interventionStatus === "org_blocked" || (user.tenant && !user.tenant.isActive)) {
    reasons.push("Organizasyon askıda / pasif");
  }
  if (!sub) {
    if (user.tenant) reasons.push("Lisans yok");
  } else {
    if (sub.status === "SUSPENDED") reasons.push("Lisans askıda");
    const expired =
      sub.status === "EXPIRED" || Boolean(sub.isExpired) || sub.remainingDays < 0 || Boolean(sub.readOnly);
    if (expired) {
      reasons.push(sub.plan === "DEMO" ? "Demo süresi sona ermiş" : "Yıllık lisans süresi dolmuş");
    }
  }
  for (const block of user.accessBlocks) {
    if (!reasons.includes(block)) reasons.push(block);
  }
  return [...new Set(reasons)];
}

const LICENSE_ONLY_ACTIONS: UserLicenseAction[] = [
  "demoPlus3",
  "demoExtend",
  "convertAnnual",
  "renewAnnual",
  "customEnds",
  "startDemo",
  "startAnnual",
  "manage",
  "reactivateLicense",
  "suspendLicense",
];

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const { showToast, toastError } = useToast();

  const listReturnHref = useMemo(() => {
    const from = searchParams.get("from");
    return from ? `/app/admin/kullanicilar?${from}` : "/app/admin/kullanicilar";
  }, [searchParams]);

  const [tab, setTab] = useState<Tab>("genel");
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [modal, setModal] = useState<QuickModal>(null);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [noteText, setNoteText] = useState("");
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePreview, setDeletePreview] = useState<AdminUserDeletePreview | null>(null);

  const [accessRole, setAccessRole] = useState("");
  const [accessAllSites, setAccessAllSites] = useState(true);
  const [accessSiteIds, setAccessSiteIds] = useState<string[]>([]);
  const [tenantSites, setTenantSites] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);

  const [licenseDays, setLicenseDays] = useState("3");
  const [licenseReason, setLicenseReason] = useState("");
  const [licenseMode, setLicenseMode] = useState<"extend" | "convert" | "renew">("extend");
  const [endsAt, setEndsAt] = useState("");

  const [activity, setActivity] = useState<AdminUserActivityItem[]>([]);
  const [activityNote, setActivityNote] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const [comms, setComms] = useState<AdminUserCommunicationItem[]>([]);
  const [commsLoading, setCommsLoading] = useState(false);
  const [commsError, setCommsError] = useState("");

  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [notesScopeNote, setNotesScopeNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");

  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>([]);

  const load = useCallback(async () => {
    if (!auth || !id) return;
    setLoading(true);
    setError("");
    try {
      const { user: next } = await getAdminUser(auth, id);
      setUser(next);
      setEditName(next.fullName);
      if (next.subscription?.plan === "ANNUAL") setLicenseMode("renew");
      else setLicenseMode("extend");
      const primary = next.memberships[0];
      if (primary) {
        setAccessRole(primary.role);
        setAccessAllSites(primary.allSites);
        setAccessSiteIds(primary.siteAccesses.map((s) => s.siteId));
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 403) setError("Bu sayfaya erişim yetkiniz yok.");
      else if (status === 404) setError("Kullanıcı bulunamadı.");
      else setError(err instanceof ApiError ? err.message : "Kullanıcı yüklenemedi.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [auth, id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const loadActivity = useCallback(async () => {
    if (!auth || !id) return;
    setActivityLoading(true);
    setActivityError("");
    try {
      const res = await listAdminUserActivity(auth, id, { page: 1, perPage: 40 });
      setActivity(res.items);
      setActivityNote(res.coverageNote ?? "");
    } catch (err) {
      setActivityError(err instanceof ApiError ? err.message : "İşlem geçmişi yüklenemedi.");
    } finally {
      setActivityLoading(false);
    }
  }, [auth, id]);

  const loadComms = useCallback(async () => {
    if (!auth || !id) return;
    setCommsLoading(true);
    setCommsError("");
    try {
      const res = await listAdminUserCommunications(auth, id, { page: 1, perPage: 40 });
      setComms(res.items);
    } catch (err) {
      setCommsError(err instanceof ApiError ? err.message : "İletişim kayıtları yüklenemedi.");
    } finally {
      setCommsLoading(false);
    }
  }, [auth, id]);

  const loadNotes = useCallback(async () => {
    if (!auth || !id) return;
    setNotesLoading(true);
    setNotesError("");
    try {
      const [noteRes, logRes] = await Promise.all([
        listAdminUserNotes(auth, id),
        listAdminUserAuditLogs(auth, id, { page: 1, perPage: 20 }),
      ]);
      setNotes(noteRes.items);
      setNotesScopeNote(noteRes.note ?? "");
      setAdminLogs(logRes.items);
    } catch (err) {
      setNotesError(err instanceof ApiError ? err.message : "Notlar yüklenemedi.");
    } finally {
      setNotesLoading(false);
    }
  }, [auth, id]);

  useEffect(() => {
    if (!user) return;
    if (tab === "islem") void loadActivity();
    if (tab === "iletisim") void loadComms();
    if (tab === "notlar") void loadNotes();
  }, [tab, user, loadActivity, loadComms, loadNotes]);

  async function run(action: () => Promise<unknown>, message: string) {
    setPending(true);
    try {
      await action();
      showToast(message);
      setModal(null);
      setConfirmActivate(false);
      await load();
      if (tab === "islem") await loadActivity();
      if (tab === "iletisim") await loadComms();
      if (tab === "notlar") await loadNotes();
    } catch (err) {
      toastError(err, "İşlem tamamlanamadı.");
    } finally {
      setPending(false);
    }
  }

  async function openAccessModal() {
    if (!auth || !id || !user?.memberships[0]) return;
    setModal("access");
    try {
      const sites = await listAdminUserTenantSites(auth, id);
      setTenantSites(sites.items);
    } catch (err) {
      toastError(err, "Siteler yüklenemedi.");
    }
  }

  async function openDeleteModal() {
    if (!auth || !id) return;
    setModal("delete");
    setDeleteReason("");
    setDeleteEmail("");
    try {
      setDeletePreview(await previewAdminUserDelete(auth, id));
    } catch (err) {
      toastError(err, "Silme önizlemesi alınamadı.");
      setModal(null);
    }
  }

  const licenseDaysNum = Number(licenseDays);

  if (loading && !user) {
    return (
      <AdminDetailShell>
        <p className="text-[13px] text-muted">Yükleniyor…</p>
      </AdminDetailShell>
    );
  }

  if (error || !user) {
    return (
      <AdminDetailShell>
        <AdminDetailHeader backHref={listReturnHref} backLabel="Kullanıcı listesi" title="Kullanıcı" />
        <EmptyState
          title={error || "Kullanıcı bulunamadı."}
          action={
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Yeniden dene
            </Button>
          }
        />
      </AdminDetailShell>
    );
  }

  const sub = user.subscription;
  const primary = user.memberships[0] ?? null;
  const tenantId = user.tenant?.id;
  const licenseKind = resolveLicenseUiKind(sub);
  const quickActionKeys = userLicenseActions(licenseKind, user.isActive, Boolean(primary)).filter(
    (key) => user.tenant || !LICENSE_ONLY_ACTIONS.includes(key),
  );
  const hasAction = (key: UserLicenseAction) => quickActionKeys.includes(key);

  const interventionReasons = buildUserInterventionReasons(user);
  const needsIntervention = interventionReasons.length > 0 || user.interventionStatus !== "normal";
  const remaining = remainingLabel(sub);

  const orgLicenseValue = sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "Lisans yok";
  const orgLicenseHint = sub
    ? [SUB_STATUS_LABELS[sub.status], remaining, `Bitiş ${formatDateTr(sub.endsAt)}`].filter(Boolean).join(" · ")
    : user.tenant
      ? "Organizasyon lisansı yok"
      : "Organizasyon yok";

  const siteAccessValue = user.primaryAccess
    ? user.primaryAccess.allSites
      ? `Tüm siteler (${user.primaryAccess.siteCount})`
      : String(user.primaryAccess.siteCount)
    : "—";

  const usageValue =
    typeof user.usage.activityLast30d === "number" && user.usage.activityLast30d > 0
      ? `${user.usage.activityLast30d} işlem`
      : "—";
  const usageHint =
    typeof user.usage.tenantMessages === "number" && user.usage.tenantMessages > 0
      ? `Son 30 gün · tenant mesaj: ${user.usage.tenantMessages}`
      : "Kullanım verisi yok";

  function openExtend(days = "3") {
    setLicenseDays(days);
    setLicenseReason("");
    setModal("extend");
  }

  return (
    <AdminDetailShell>
      <AdminDetailHeader
        backHref={listReturnHref}
        backLabel="Kullanıcı listesi"
        leading={
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-slate-50 text-[12px] font-medium text-ink">
            {initials(user.fullName)}
          </div>
        }
        title={user.fullName}
        subtitle={user.email}
        badges={
          <>
            <Badge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? "Aktif" : "Pasif"}</Badge>
            {sub ? (
              <Badge tone={sub.plan === "DEMO" ? "info" : "brand"}>{PLAN_LABELS[sub.plan] ?? sub.plan}</Badge>
            ) : null}
            {remaining ? (
              <Badge tone={sub && sub.remainingDays <= 7 ? "warning" : "neutral"}>{remaining}</Badge>
            ) : null}
            <Badge tone="neutral">{roleLabel(user.role)}</Badge>
            {user.isPlatformAdmin ? <Badge tone="brand">Platform admin</Badge> : null}
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditName(user.fullName);
              setModal("edit");
            }}
          >
            <Pencil className="size-3.5" aria-hidden />
            Düzenle
          </Button>
        }
      />

      <AdminDetailStatsRow>
        <AdminDetailStatCard
          label="Organizasyon Lisansı"
          value={orgLicenseValue}
          hint={[user.tenant?.name, orgLicenseHint].filter(Boolean).join(" · ")}
          icon={CalendarDays}
          tone={sub?.plan === "ANNUAL" ? "green" : sub ? "blue" : "amber"}
        />
        <AdminDetailStatCard
          label="Site Erişimi"
          value={siteAccessValue}
          hint={`${roleLabel(user.role)}${user.isPlatformAdmin ? " · Platform admin" : ""}${user.primaryAccess?.primarySiteName ? ` · ${user.primaryAccess.primarySiteName}` : ""}`}
          icon={KeyRound}
          tone="teal"
        />
        <AdminDetailStatCard
          label="Kullanım"
          value={usageValue}
          hint={usageHint}
          icon={History}
          tone="blue"
        />
        <AdminDetailStatCard
          label="Giriş"
          value={formatDateTr(user.lastLoginAt)}
          hint={`Oluşturma ${formatDateTr(user.createdAt)} · ${user.activationPending ? "Aktivasyon bekliyor" : "Aktivasyon tamam"}`}
          icon={LogIn}
          tone="amber"
        />
      </AdminDetailStatsRow>

      <AdminDetailQuickActions description="Bu kullanıcı için platform işlemlerini tek yerden yönetin.">
        {hasAction("edit") ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditName(user.fullName);
              setModal("edit");
            }}
          >
            Kullanıcıyı Düzenle
          </Button>
        ) : null}
        {hasAction("resendInvite") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              void run(() => resendAdminUserInvite(auth!, id), "Aktivasyon daveti gönderildi.")
            }
          >
            Aktivasyon Daveti
          </Button>
        ) : null}
        {hasAction("access") ? (
          <Button size="sm" variant="secondary" onClick={() => void openAccessModal()}>
            Site Erişimleri
          </Button>
        ) : null}
        {hasAction("note") ? (
          <Button size="sm" variant="secondary" onClick={() => setModal("note")}>
            Admin Notu
          </Button>
        ) : null}
        {hasAction("demoPlus3") ? (
          <Button size="sm" variant="secondary" disabled={pending || !tenantId} onClick={() => openExtend("3")}>
            +3 Gün
          </Button>
        ) : null}
        {hasAction("demoExtend") ? (
          <Button size="sm" variant="secondary" disabled={pending || !tenantId} onClick={() => openExtend("7")}>
            Demo Süresi Ekle
          </Button>
        ) : null}
        {hasAction("convertAnnual") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setModal("convert");
            }}
          >
            Yıllığa Dönüştür
          </Button>
        ) : null}
        {hasAction("renewAnnual") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setModal("renew");
            }}
          >
            Yıllık Yenile
          </Button>
        ) : null}
        {hasAction("customEnds") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setEndsAt("");
              setModal("customEnds");
            }}
          >
            Özel Süre Ekle
          </Button>
        ) : null}
        {hasAction("startDemo") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseDays("7");
              setLicenseReason("");
              setModal("startDemo");
            }}
          >
            Demo Başlat
          </Button>
        ) : null}
        {hasAction("startAnnual") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setModal("startAnnual");
            }}
          >
            Yıllık Lisans Başlat
          </Button>
        ) : null}
        {hasAction("suspendLicense") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setModal("suspend");
            }}
          >
            Askıya Al
          </Button>
        ) : null}
        {hasAction("reactivateLicense") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setModal("reactivate");
            }}
          >
            Yeniden Etkinleştir
          </Button>
        ) : null}
        {hasAction("manage") ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !tenantId}
            onClick={() => {
              setLicenseReason("");
              setLicenseMode(sub?.plan === "ANNUAL" ? "renew" : "extend");
              setModal("license");
            }}
          >
            Lisansı Yönet
          </Button>
        ) : null}
        {hasAction("deactivate") ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDeactivateReason("");
              setModal("deactivate");
            }}
          >
            Pasife Al
          </Button>
        ) : null}
        {hasAction("activate") ? (
          <Button size="sm" variant="secondary" onClick={() => setConfirmActivate(true)}>
            Aktifleştir
          </Button>
        ) : null}
      </AdminDetailQuickActions>

      <AdminDetailTabs
        tabs={[
          { id: "genel", label: "Genel", icon: UserIcon },
          { id: "organizasyon", label: "Organizasyon ve Lisans", icon: Building2 },
          { id: "siteler", label: "Site Erişimleri", icon: KeyRound },
          { id: "islem", label: "İşlem Geçmişi", icon: History },
          { id: "iletisim", label: "İletişim", icon: Mail },
          { id: "notlar", label: "Admin Notları", icon: StickyNote },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === "genel" ? (
          <div className="space-y-3">
            <AdminDetailPanel
              title="Genel Özet"
              description="Kullanıcı kimliği, organizasyon ve müdahale durumu"
            >
              <AdminDetailInfoGrid wide>
                <AdminDetailInfoBox label="Ad soyad" value={user.fullName} />
                <AdminDetailInfoBox label="E-posta" value={user.email} />
                <AdminDetailInfoBox label="Organizasyon" value={user.tenant?.name ?? "—"} />
                <AdminDetailInfoBox label="Durum" value={user.isActive ? "Aktif" : "Pasif"} />
                <AdminDetailInfoBox
                  label="Organizasyon lisansı"
                  value={
                    sub
                      ? `${PLAN_LABELS[sub.plan]} · ${SUB_STATUS_LABELS[sub.status]}`
                      : "Lisans yok"
                  }
                />
                <AdminDetailInfoBox
                  label="Müdahale"
                  value={
                    needsIntervention
                      ? interventionReasons[0] ?? interventionLabel(user.interventionStatus)
                      : "Normal"
                  }
                />
              </AdminDetailInfoGrid>
              {needsIntervention && interventionReasons.length > 0 ? (
                <div className="mt-3 rounded-[12px] border border-rose-200/70 bg-rose-50/40 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-rose-800">Müdahale nedenleri</p>
                  <ul className="mt-1 space-y-0.5 text-[12px] text-ink">
                    {interventionReasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </AdminDetailPanel>
            <AdminDetailPanel title="Yetki özeti">
              <AdminDetailInfoGrid wide>
                <AdminDetailInfoBox label="Tenant rolü" value={roleLabel(user.role)} />
                <AdminDetailInfoBox label="Platform admin" value={user.isPlatformAdmin ? "Evet" : "Hayır"} />
                <AdminDetailInfoBox
                  label="Site erişimi"
                  value={
                    user.primaryAccess
                      ? user.primaryAccess.allSites
                        ? `Tüm siteler (${user.primaryAccess.siteCount})`
                        : user.primaryAccess.sites.map((s) => s.siteName).join(", ") || "—"
                      : "—"
                  }
                />
                <AdminDetailInfoBox label="Üyelik durumu" value={user.membershipStatus ?? "—"} />
                <AdminDetailInfoBox label="Oluşturulma" value={formatDateTr(user.createdAt)} />
                <AdminDetailInfoBox label="Son giriş" value={formatDateTr(user.lastLoginAt)} />
              </AdminDetailInfoGrid>
            </AdminDetailPanel>
          </div>
        ) : null}

        {tab === "organizasyon" ? (
          <AdminDetailPanel
            title="Organizasyon lisansı"
            description="Bu lisans organizasyona aittir ve organizasyondaki kullanıcıları kapsar. Kullanıcıya özel lisans kaydı yoktur."
            action={
              user.tenant ? (
                <Link href={`/app/admin/tenantlar/${user.tenant.id}`}>
                  <Button size="sm" variant="secondary">
                    Tenant detayına git
                  </Button>
                </Link>
              ) : null
            }
          >
            <AdminDetailInfoGrid wide>
              <AdminDetailInfoBox label="Organizasyon" value={user.tenant?.name ?? "—"} />
              <AdminDetailInfoBox
                label="Organizasyon durumu"
                value={user.tenant ? (user.tenant.isActive ? "Aktif" : "Pasif") : "—"}
              />
              <AdminDetailInfoBox label="Plan" value={sub ? PLAN_LABELS[sub.plan] : "—"} />
              <AdminDetailInfoBox label="Durum" value={sub ? SUB_STATUS_LABELS[sub.status] : "—"} />
              <AdminDetailInfoBox label="Başlangıç" value={sub ? formatDateTr(sub.startsAt) : "—"} />
              <AdminDetailInfoBox label="Bitiş" value={sub ? formatDateTr(sub.endsAt) : "—"} />
              <AdminDetailInfoBox
                label="Kalan gün"
                value={sub ? remainingLabel(sub) || String(sub.remainingDays) : "—"}
              />
              <AdminDetailInfoBox label="Site sayısı" value={String(user.usage.tenantSites)} />
            </AdminDetailInfoGrid>
          </AdminDetailPanel>
        ) : null}

        {tab === "siteler" ? (
          <AdminDetailPanel
            title="Site erişimleri"
            action={
              primary ? (
                <Button size="sm" variant="secondary" onClick={() => void openAccessModal()}>
                  Düzenle
                </Button>
              ) : null
            }
          >
            {!primary ? (
              <EmptyState title="Üyelik kaydı yok." />
            ) : (
              <>
                <p className="mb-3 text-[12px] text-muted">
                  Rol: {roleLabel(primary.role)} ·{" "}
                  {primary.allSites ? "Tüm siteler" : `${primary.siteAccesses.length} site`} · Atanma{" "}
                  {formatDateTr(primary.createdAt)}
                </p>
                <Table>
                  <TableElement>
                    <THead>
                      <TR>
                        <TH>Site</TH>
                        <TH>Rol</TH>
                        <TH>Erişim</TH>
                        <TH>Atanma</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {primary.allSites ? (
                        <TR>
                          <TD>Tüm siteler (organizasyon)</TD>
                          <TD>{roleLabel(primary.role)}</TD>
                          <TD>Tam erişim</TD>
                          <TD>{formatDateTr(primary.createdAt)}</TD>
                        </TR>
                      ) : primary.siteAccesses.length === 0 ? (
                        <TR>
                          <TD colSpan={4} className="text-muted">
                            Atanmış site yok.
                          </TD>
                        </TR>
                      ) : (
                        primary.siteAccesses.map((site) => (
                          <TR key={site.siteId}>
                            <TD>{site.siteName}</TD>
                            <TD>{roleLabel(primary.role)}</TD>
                            <TD>{site.isActive ? "Aktif" : "Pasif site"}</TD>
                            <TD>{formatDateTr(primary.createdAt)}</TD>
                          </TR>
                        ))
                      )}
                    </TBody>
                  </TableElement>
                </Table>
                <p className="mt-2 text-[11px] text-muted">
                  Başka tenant sitesi atanamaz. Platform admin rolü buradan değiştirilemez.
                </p>
              </>
            )}
          </AdminDetailPanel>
        ) : null}

        {tab === "islem" ? (
          <AdminDetailPanel title="Kullanıcının işlem geçmişi">
            {activityLoading ? <p className="text-[12px] text-muted">Yükleniyor…</p> : null}
            {activityError ? (
              <EmptyState
                title={activityError}
                action={
                  <Button size="sm" variant="secondary" onClick={() => void loadActivity()}>
                    Yeniden dene
                  </Button>
                }
              />
            ) : null}
            {!activityLoading && !activityError && activity.length === 0 ? (
              <EmptyState title="Kayıtlı işlem yok." description={activityNote || undefined} />
            ) : null}
            {!activityLoading && activity.length > 0 ? (
              <>
                {activityNote ? <p className="mb-2 text-[11px] text-muted">{activityNote}</p> : null}
                <Table>
                  <TableElement>
                    <THead>
                      <TR>
                        <TH>Tarih</TH>
                        <TH>İşlem</TH>
                        <TH>Hedef</TH>
                        <TH>Organizasyon</TH>
                        <TH>Sonuç</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {activity.map((item) => (
                        <TR key={item.id}>
                          <TD>{formatDateTr(item.createdAt)}</TD>
                          <TD>{AUDIT_ACTION_LABELS[item.action] ?? item.action}</TD>
                          <TD className="font-mono text-[11px]">{item.targetType}</TD>
                          <TD>{item.tenantName}</TD>
                          <TD>Başarılı</TD>
                        </TR>
                      ))}
                    </TBody>
                  </TableElement>
                </Table>
              </>
            ) : null}
          </AdminDetailPanel>
        ) : null}

        {tab === "iletisim" ? (
          <AdminDetailPanel
            title="Platform iletişimleri"
            action={
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  void run(() => resendAdminUserInvite(auth!, id), "Aktivasyon daveti gönderildi.")
                }
              >
                Daveti yeniden gönder
              </Button>
            }
          >
            {commsLoading ? <p className="text-[12px] text-muted">Yükleniyor…</p> : null}
            {commsError ? (
              <EmptyState
                title={commsError}
                action={
                  <Button size="sm" variant="secondary" onClick={() => void loadComms()}>
                    Yeniden dene
                  </Button>
                }
              />
            ) : null}
            {!commsLoading && !commsError && comms.length === 0 ? (
              <EmptyState title="Bu kullanıcıya ait e-posta kaydı yok." />
            ) : null}
            {!commsLoading && comms.length > 0 ? (
              <Table>
                <TableElement>
                  <THead>
                    <TR>
                      <TH>Tarih</TH>
                      <TH>Kanal</TH>
                      <TH>Konu / tür</TH>
                      <TH>Durum</TH>
                      <TH>Hata</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {comms.map((item) => (
                      <TR key={item.id}>
                        <TD>{formatDateTr(item.createdAt)}</TD>
                        <TD>{item.channel}</TD>
                        <TD>
                          <div className="text-[12px]">{item.subject || item.type}</div>
                          <div className="text-[11px] text-muted">{item.recipientEmail}</div>
                        </TD>
                        <TD>{item.status}</TD>
                        <TD className="text-[11px] text-muted">{item.errorSummary || "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </TableElement>
              </Table>
            ) : null}
          </AdminDetailPanel>
        ) : null}

        {tab === "notlar" ? (
          <div className="space-y-3">
            <AdminDetailPanel
              title="Admin notları"
              action={
                <Button size="sm" variant="secondary" onClick={() => setModal("note")}>
                  Not ekle
                </Button>
              }
            >
              {notesScopeNote ? <p className="mb-2 text-[11px] text-muted">{notesScopeNote}</p> : null}
              {notesLoading ? <p className="text-[12px] text-muted">Yükleniyor…</p> : null}
              {notesError ? (
                <EmptyState
                  title={notesError}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => void loadNotes()}>
                      Yeniden dene
                    </Button>
                  }
                />
              ) : null}
              {!notesLoading && !notesError && notes.length === 0 ? <EmptyState title="Not yok." /> : null}
              <div className="space-y-2">
                {notes.map((item) => (
                  <div key={item.id} className="rounded-md border border-line px-3 py-2">
                    <p className="whitespace-pre-wrap text-[12px] text-ink">{item.content}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {item.adminUser.fullName} · {formatDateTr(item.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </AdminDetailPanel>
            <AdminDetailPanel title="Bu kullanıcıya yapılan admin işlemleri" bodyClassName="px-0 py-0">
              {adminLogs.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-muted">Kayıt yok.</p>
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
                      {adminLogs.map((item) => (
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
          </div>
        ) : null}
      </div>

      <AdminDangerZone open={dangerOpen} onToggle={() => setDangerOpen((v) => !v)}>
        <p className="mb-2 text-[12px] text-muted">
          Kalıcı silme öncesi önizleme yapılır. İlişkili kayıt varsa silme engellenir.
        </p>
        <Button size="sm" variant="danger" onClick={() => void openDeleteModal()}>
          Kullanıcıyı Sil
        </Button>
      </AdminDangerZone>

      <Modal open={modal === "edit"} title="Kullanıcıyı düzenle" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <label className="block text-[12px]">
            <span className="text-muted">Ad soyad</span>
            <Input className="mt-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </label>
          <label className="block text-[12px]">
            <span className="text-muted">E-posta (salt okunur)</span>
            <Input className="mt-1" value={user.email} disabled />
          </label>
          <p className="text-[11px] text-muted">
            E-posta değişikliği doğrulama altyapısı olmadığı için kapalı. Organizasyon taşıma bu ekranda yok.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || editName.trim().length < 2}
              onClick={() =>
                void run(
                  () => updateAdminUser(auth!, id, { fullName: editName.trim() }),
                  "Kullanıcı bilgileri güncellendi.",
                )
              }
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "note"} title="Admin notu ekle" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Örn. Telefon görüşmesi yapıldı."
            rows={4}
          />
          <p className="text-[11px] text-muted">
            Not organizasyon düzeyinde saklanır; yalnız platform adminler görür.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || !noteText.trim() || !user.tenant}
              onClick={() =>
                void run(async () => {
                  await createAdminUserNote(auth!, id, noteText.trim());
                  setNoteText("");
                }, "Admin notu eklendi.")
              }
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "access"} title="Site erişimlerini yönet" onClose={() => setModal(null)}>
        {!primary ? (
          <p className="text-[12px] text-muted">Üyelik yok.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[12px]">
              <span className="text-muted">Rol</span>
              <Select className="mt-1" value={accessRole} onChange={(e) => setAccessRole(e.target.value)}>
                <option value="ORGANIZASYON_SAHIBI">Organizasyon sahibi</option>
                <option value="SITE_YONETICISI">Site yöneticisi</option>
                <option value="YONETICI">Yönetici</option>
                <option value="MUHASEBE">Muhasebe</option>
                <option value="OPERASYON">Operasyon</option>
                <option value="GORUNTULEYICI">Görüntüleyici</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={accessAllSites}
                onChange={(e) => setAccessAllSites(e.target.checked)}
              />
              Tüm siteler
            </label>
            {!accessAllSites ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                {tenantSites.map((site) => {
                  const checked = accessSiteIds.includes(site.id);
                  return (
                    <label key={site.id} className="flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAccessSiteIds((prev) =>
                            checked ? prev.filter((x) => x !== site.id) : [...prev, site.id],
                          )
                        }
                      />
                      {site.name}
                      {!site.isActive ? <span className="text-muted">(pasif)</span> : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
                İptal
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  void run(
                    () =>
                      updateAdminUserAccess(auth!, id, {
                        membershipId: primary.id,
                        role: accessRole,
                        allSites: accessAllSites,
                        siteIds: accessAllSites ? [] : accessSiteIds,
                      }),
                    "Site erişimi güncellendi.",
                  )
                }
              >
                Kaydet
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal === "license"} title="Organizasyon lisansı" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <p className="text-[12px] text-muted">
            Değişiklik kullanıcıya değil organizasyon aboneliğine uygulanır.
          </p>
          <Select value={licenseMode} onChange={(e) => setLicenseMode(e.target.value as typeof licenseMode)}>
            <option value="extend">Demo uzat (+ gün)</option>
            <option value="convert">Yıllığa dönüştür</option>
            <option value="renew">Yıllık yenile (365)</option>
          </Select>
          {licenseMode === "extend" ? (
            <Input value={licenseDays} onChange={(e) => setLicenseDays(e.target.value)} placeholder="Gün (ör. 3)" />
          ) : null}
          {licenseMode === "convert" ? (
            <p className="text-[12px] text-muted">Varsayılan: 4.000 ₺ net + KDV.</p>
          ) : null}
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || licenseReason.trim().length < 5 || !user.tenant}
              onClick={() =>
                void run(async () => {
                  const tid = user.tenant!.id;
                  const reason = licenseReason.trim();
                  const days = Number(licenseDays) || 3;
                  if (licenseMode === "extend") {
                    await extendAdminDemo(auth!, tid, { days, reason });
                  } else if (licenseMode === "convert") {
                    await convertAdminAnnual(auth!, tid, { reason, netPrice: 4000 });
                  } else {
                    await renewAdminAnnual(auth!, tid, { reason });
                  }
                }, "Organizasyon lisansı güncellendi.")
              }
            >
              Uygula
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "extend"} title="Demo süresi uzat" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Input
            type="number"
            min={1}
            max={90}
            value={licenseDays}
            onChange={(e) => setLicenseDays(e.target.value)}
            placeholder="Gün"
          />
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={
                pending ||
                !tenantId ||
                !Number.isFinite(licenseDaysNum) ||
                licenseDaysNum < 1 ||
                licenseReason.trim().length < 5
              }
              onClick={() =>
                void run(
                  () => extendAdminDemo(auth!, tenantId!, { days: licenseDaysNum, reason: licenseReason.trim() }),
                  "Demo süresi güncellendi.",
                )
              }
            >
              Onayla
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "startDemo"} title="Demo başlat" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Input
            type="number"
            min={1}
            max={90}
            value={licenseDays}
            onChange={(e) => setLicenseDays(e.target.value)}
            placeholder="Gün"
          />
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={
                pending ||
                !tenantId ||
                !Number.isFinite(licenseDaysNum) ||
                licenseDaysNum < 1 ||
                licenseReason.trim().length < 5
              }
              onClick={() =>
                void run(
                  () => startAdminDemo(auth!, tenantId!, { days: licenseDaysNum, reason: licenseReason.trim() }),
                  "Demo lisansı başlatıldı.",
                )
              }
            >
              Başlat
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "convert"} title="Yıllığa dönüştür" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <p className="text-[12px] text-muted">Varsayılan: 4.000 ₺ net + %20 KDV.</p>
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || !tenantId || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => convertAdminAnnual(auth!, tenantId!, { reason: licenseReason.trim(), netPrice: 4000 }),
                  "Yıllık lisansa dönüştürüldü.",
                )
              }
            >
              Dönüştür
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "renew"} title="Yıllık yenile (365)" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || !tenantId || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => renewAdminAnnual(auth!, tenantId!, { reason: licenseReason.trim() }),
                  "Yıllık lisans yenilendi.",
                )
              }
            >
              Yenile
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "startAnnual"} title="Yıllık lisans başlat" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <p className="text-[12px] text-muted">Varsayılan: 4.000 ₺ net + KDV · 365 gün</p>
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || !tenantId || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => startAdminAnnual(auth!, tenantId!, { reason: licenseReason.trim(), netPrice: 4000 }),
                  "Yıllık lisans başlatıldı.",
                )
              }
            >
              Başlat
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "customEnds"} title="Özel süre ekle" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || !tenantId || !endsAt || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () =>
                    extendAdminTenantSubscription(auth!, tenantId!, {
                      endsAt: new Date(endsAt).toISOString(),
                      reason: licenseReason.trim(),
                    }),
                  "Bitiş tarihi güncellendi.",
                )
              }
            >
              Uygula
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "reactivate"} title="Lisansı yeniden etkinleştir" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={pending || !tenantId || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => reactivateAdminSubscription(auth!, tenantId!, licenseReason.trim()),
                  "Lisans yeniden etkinleştirildi.",
                )
              }
            >
              Etkinleştir
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "suspend"} title="Lisansı askıya al" onClose={() => setModal(null)}>
        <div className="space-y-3">
          <p className="text-[12px] text-muted">
            Askıya alınan organizasyon yazma işlemleri yapamaz. Yeniden etkinleştirme ile geri alınır.
          </p>
          <Textarea
            value={licenseReason}
            onChange={(e) => setLicenseReason(e.target.value)}
            placeholder="Gerekçe (zorunlu)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending || !tenantId || licenseReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => suspendAdminSubscription(auth!, tenantId!, licenseReason.trim()),
                  "Lisans askıya alındı.",
                )
              }
            >
              Askıya Al
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "deactivate"} title="Kullanıcıyı pasife al" onClose={() => setModal(null)}>
        <div className="space-y-3 text-[12px]">
          <p>
            Bu kullanıcı pasife alındığında sisteme giriş yapamayacaktır. Geçmiş kayıtları korunacaktır.
          </p>
          <ul className="space-y-1 text-muted">
            <li>Kullanıcı: {user.fullName}</li>
            <li>Organizasyon: {user.tenant?.name ?? "—"}</li>
            <li>Rol: {roleLabel(user.role)}</li>
            <li>
              Site erişimi:{" "}
              {user.primaryAccess?.allSites ? "Tüm siteler" : `${user.primaryAccess?.siteCount ?? 0} site`}
            </li>
            <li>Son giriş: {formatDateTr(user.lastLoginAt)}</li>
            <li>Platform admin: {user.isPlatformAdmin ? "Evet" : "Hayır"}</li>
          </ul>
          <Textarea
            value={deactivateReason}
            onChange={(e) => setDeactivateReason(e.target.value)}
            placeholder="Gerekçe (zorunlu, en az 5 karakter)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending || deactivateReason.trim().length < 5}
              onClick={() =>
                void run(
                  () => deactivateAdminUser(auth!, id, deactivateReason.trim()),
                  "Kullanıcı pasife alındı.",
                )
              }
            >
              Pasife al
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "delete"} title="Kullanıcıyı sil" onClose={() => setModal(null)}>
        <div className="space-y-3 text-[12px]">
          {deletePreview && !deletePreview.canDelete ? (
            <>
              <p className="text-danger">
                Bu kullanıcının geçmiş işlem kayıtları bulunduğu için silinemez. Hesabı pasife alabilirsiniz.
              </p>
              <ul className="space-y-1 text-muted">
                {deletePreview.blockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setModal(null)}>
                  Tamam
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>Bu işlem geri alınamaz. İlişkisiz ve uygun kullanıcılar silinebilir.</p>
              <Input
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder="Onay için kullanıcı e-postasını yazın"
              />
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Gerekçe (zorunlu)"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModal(null)}>
                  İptal
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending || deleteReason.trim().length < 5 || !deleteEmail.trim()}
                  onClick={() =>
                    void run(async () => {
                      await deleteAdminUser(auth!, id, {
                        reason: deleteReason.trim(),
                        confirmEmail: deleteEmail.trim(),
                      });
                      router.push(listReturnHref);
                    }, "Kullanıcı silindi.")
                  }
                >
                  Kalıcı sil
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmActivate}
        title="Kullanıcı aktifleştirilsin mi?"
        description="Hesap yeniden giriş yapabilir."
        pending={pending}
        onClose={() => setConfirmActivate(false)}
        onConfirm={() =>
          void run(() => activateAdminUser(auth!, id), "Kullanıcı yeniden aktifleştirildi.")
        }
      />
    </AdminDetailShell>
  );
}
