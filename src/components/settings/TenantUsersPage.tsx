"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/SurfaceCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { hasPermission } from "@/lib/permissions";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import { listActiveSites, type SiteSummary } from "@/lib/sites-api";
import {
  getTenantUserCatalog,
  inviteTenantUser,
  listTenantUsers,
  removeTenantUser,
  resendTenantInvite,
  setTenantUserStatus,
  updateTenantUser,
  type TenantMember,
  type TenantUserCatalog,
} from "@/lib/tenant-users-api";

function withViewDeps(selected: string[], viewOf: Record<string, string>) {
  const next = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const code of [...next]) {
      const view = viewOf[code];
      if (view && !next.has(view)) {
        next.add(view);
        changed = true;
      }
    }
  }
  for (const [write, view] of Object.entries(viewOf)) {
    if (!next.has(view)) next.delete(write);
  }
  return [...next];
}

const STATUS: Record<TenantMember["status"], { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Aktif", tone: "success" },
  INVITED: { label: "Davet Bekliyor", tone: "warning" },
  EXPIRED: { label: "Davet Süresi Dolmuş", tone: "danger" },
  DISABLED: { label: "Pasif", tone: "neutral" },
};

export function TenantUsersPage() {
  const { ready, user } = useAuth();
  const auth = useApiAuth({ requireSite: false });
  const searchParams = useSearchParams();
  const { showToast, toastError } = useToast();
  const canInvite = hasPermission(user, "users.invite") || hasPermission(user, "users.manage") || !user.permissions?.length;
  const canManage = hasPermission(user, "users.manage") || !user.permissions?.length;

  const [items, setItems] = useState<TenantMember[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, invited: 0, disabled: 0 });
  const [catalog, setCatalog] = useState<TenantUserCatalog | null>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"invite" | "edit" | null>(null);
  const [selected, setSelected] = useState<TenantMember | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("GORUNTULEYICI");
  const [allSites, setAllSites] = useState(true);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [inviteHint, setInviteHint] = useState("");

  const load = useCallback(async () => {
    if (!auth) return;
    setError("");
    try {
      const [list, cat, activeSites] = await Promise.all([
        listTenantUsers(auth),
        getTenantUserCatalog(auth),
        listActiveSites(auth),
      ]);
      const rows = list.items ?? [];
      setItems(rows);
      setSummary(
        list.summary ?? {
          total: rows.length,
          active: rows.filter((row) => row.status === "ACTIVE").length,
          invited: rows.filter((row) => row.status === "INVITED" || row.status === "EXPIRED").length,
          disabled: rows.filter((row) => row.status === "DISABLED").length,
        },
      );
      setCatalog(cat);
      setSites(activeSites.items ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kullanıcılar yüklenemedi.");
    }
  }, [auth]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const inviteOpenedRef = useRef(false);
  useEffect(() => {
    if (!ready || !canInvite || inviteOpenedRef.current) return;
    if (searchParams.get("invite") !== "1") return;
    inviteOpenedRef.current = true;
    setSelected(null);
    setFullName("");
    setEmail("");
    setAllSites(true);
    setSiteIds([]);
    setInviteHint("");
    setRole("GORUNTULEYICI");
    setPermissions(catalog?.roles.find((item) => item.value === "GORUNTULEYICI")?.permissions ?? []);
    setModal("invite");
  }, [ready, canInvite, searchParams, catalog]);

  const viewOnly = useMemo(
    () => catalog?.groups.flatMap((group) => group.items.map((item) => item.code)).filter((code) => code.endsWith(".view")) ?? [],
    [catalog],
  );

  function applyRole(nextRole: string) {
    setRole(nextRole);
    setPermissions(catalog?.roles.find((item) => item.value === nextRole)?.permissions ?? []);
  }

  function openInvite() {
    setSelected(null);
    setFullName("");
    setEmail("");
    setAllSites(true);
    setSiteIds([]);
    setInviteHint("");
    applyRole("GORUNTULEYICI");
    setModal("invite");
  }

  function openEdit(member: TenantMember) {
    setSelected(member);
    setFullName(member.fullName);
    setEmail(member.email);
    setRole(member.role);
    setAllSites(member.allSites);
    setSiteIds(member.siteIds ?? []);
    setPermissions(member.permissions);
    setInviteHint("");
    setModal("edit");
  }

  async function save() {
    if (!auth) return;
    setSaving(true);
    try {
      if (modal === "invite") {
        const result = await inviteTenantUser(auth, { fullName, email, role, allSites, siteIds, permissions });
        const sent = result.invite?.status === "SENT";
        setInviteHint(sent ? "Davet e-postası gönderildi." : "Kullanıcı oluşturuldu ancak davet e-postası gönderilemedi.");
        showToast(sent ? "Kullanıcı daveti gönderildi." : "Kullanıcı kaydedildi; e-posta gönderilemedi.", sent ? "success" : "error");
        await load();
      } else if (selected) {
        await updateTenantUser(auth, selected.id, { role, allSites, siteIds, permissions });
        showToast("Yetkiler güncellendi.");
        setModal(null);
        await load();
      }
    } catch (err) {
      toastError(err, "İşlem tamamlanamadı.");
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      showToast(success);
      await load();
    } catch (err) {
      toastError(err, "İşlem tamamlanamadı.");
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Kullanıcılar ve Yetkiler"
        description="Yalnızca bu organizasyondaki kullanıcıları davet edin ve modül yetkilerini yönetin."
        actions={canInvite ? <Button onClick={openInvite}>Yeni Kullanıcı Davet Et</Button> : null}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam kullanıcı" value={String(summary.total)} />
        <StatCard label="Aktif" value={String(summary.active)} />
        <StatCard label="Davet bekleyen" value={String(summary.invited)} />
        <StatCard label="Pasif" value={String(summary.disabled)} />
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Ad soyad</TH>
              <TH>E-posta</TH>
              <TH>Rol</TH>
              <TH>Site erişimi</TH>
              <TH>Durum</TH>
              <TH>Son giriş</TH>
              <TH>Davet</TH>
              <TH>İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {items.length === 0 ? (
              <TR>
                <TD colSpan={8}>
                  <TableEmptyState title="Henüz kullanıcı yok" description="İlk kullanıcıyı davet ederek yetki matrisini tanımlayın." />
                </TD>
              </TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD className="font-medium text-ink">{item.fullName}</TD>
                  <TD>{item.email}</TD>
                  <TD>{item.roleLabel}</TD>
                  <TD>{item.allSites ? "Tüm siteler" : item.siteNames.join(", ") || "—"}</TD>
                  <TD>
                    <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
                  </TD>
                  <TD>{item.lastLoginAt ? formatDateTr(item.lastLoginAt) : "—"}</TD>
                  <TD>{formatDateTr(item.invitedAt)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {canManage ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                          Yetkileri Yönet
                        </Button>
                      ) : null}
                      {canInvite && (item.status === "INVITED" || item.status === "EXPIRED") && auth ? (
                        <Button size="sm" variant="secondary" onClick={() => void run(() => resendTenantInvite(auth, item.id), "Davet yeniden gönderildi.")}>
                          Daveti Yeniden Gönder
                        </Button>
                      ) : null}
                      {canManage && item.status === "ACTIVE" && auth ? (
                        <Button size="sm" variant="secondary" onClick={() => void run(() => setTenantUserStatus(auth, item.id, false), "Kullanıcı pasife alındı.")}>
                          Pasife Al
                        </Button>
                      ) : null}
                      {canManage && item.status === "DISABLED" && auth ? (
                        <Button size="sm" variant="secondary" onClick={() => void run(() => setTenantUserStatus(auth, item.id, true), "Kullanıcı aktifleştirildi.")}>
                          Aktifleştir
                        </Button>
                      ) : null}
                      {canManage && auth ? (
                        <Button size="sm" variant="danger" onClick={() => void run(() => removeTenantUser(auth, item.id), "Üyelik kaldırıldı.")}>
                          Üyeliği Kaldır
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>

      <FormModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "invite" ? "Yeni kullanıcı davet et" : "Yetkileri yönet"}
        description="Rol bir başlangıç şablonudur. Asıl yetki aşağıdaki matristen kaydedilir."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Kapat
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {modal === "invite" ? "Davet Et" : "Değişiklikleri kaydet"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Ad soyad</span>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={modal === "edit"} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">E-posta</span>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={modal === "edit"} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Rol</span>
            <Select value={role} onChange={(event) => applyRole(event.target.value)}>
              {(catalog?.roles ?? []).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Site erişimi</span>
            <Select value={allSites ? "all" : "selected"} onChange={(event) => setAllSites(event.target.value === "all")}>
              <option value="all">Tüm siteler</option>
              <option value="selected">Yalnızca seçilen siteler</option>
            </Select>
          </label>
        </div>
        {!allSites ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {sites.map((site) => (
              <label key={site.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={siteIds.includes(site.id)}
                  onChange={(event) =>
                    setSiteIds((current) => (event.target.checked ? [...current, site.id] : current.filter((id) => id !== site.id)))
                  }
                />
                {site.name}
              </label>
            ))}
          </div>
        ) : null}
        {inviteHint ? <p className="mt-3 text-sm text-accent">{inviteHint}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPermissions(catalog?.groups.flatMap((group) => group.items.map((item) => item.code)) ?? [])}>
            Tümünü seç
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPermissions([])}>
            Tümünü kaldır
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPermissions(viewOnly)}>
            Yalnızca görüntüleme
          </Button>
          <Button size="sm" variant="secondary" onClick={() => applyRole(role)}>
            Rol varsayılanlarını uygula
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {(catalog?.groups ?? []).map((group) => (
            <div key={group.id} className="rounded-lg border border-line">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
                onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: current[group.id] === false }))}
              >
                {group.label}
                <span className="text-muted">{openGroups[group.id] === false ? "Aç" : "Gizle"}</span>
              </button>
              {openGroups[group.id] === false ? null : (
                <div className="grid gap-2 border-t border-line px-3 py-3 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <label key={item.code} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={permissions.includes(item.code)}
                        onChange={(event) =>
                          setPermissions(
                            withViewDeps(
                              event.target.checked ? [...permissions, item.code] : permissions.filter((code) => code !== item.code),
                              catalog?.viewOf ?? {},
                            ),
                          )
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </FormModal>
    </PageContainer>
  );
}
