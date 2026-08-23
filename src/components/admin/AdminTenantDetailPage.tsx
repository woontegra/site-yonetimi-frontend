"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/SurfaceCard";
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
  extendAdminTenantSubscription,
  getAdminTenant,
  listAdminTenantAuditLogs,
  listAdminTenantNotes,
  listAdminTenantSites,
  listAdminTenantUsers,
  resendAdminUserInvite,
  trialAdminTenantSubscription,
  type AdminAuditLog,
  type AdminNote,
  type AdminTenantDetail,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

type Tab = "genel" | "siteler" | "kullanicilar" | "abonelik" | "entegrasyonlar" | "gecmis" | "notlar";

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

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useAuth();
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
  const [endsAtOpen, setEndsAtOpen] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [plan, setPlan] = useState("STANDARD");

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
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

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

  const sub = tenant.subscription;

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/admin/tenantlar"
        backLabel="Tenantlara dön"
        title={tenant.name}
        description={
          <span>
            {tenant.owner ? `${tenant.owner.fullName} · ${tenant.owner.email}` : "Ana kullanıcı yok"}
            {sub ? ` · ${PLAN_LABELS[sub.plan]}` : ""}
          </span>
        }
        status={<StatusBadge active={tenant.isActive} />}
        actions={
          <>
            {users.some((item) => !item.isActive) ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  const target = users.find((item) => !item.isActive);
                  if (!target) return;
                  void run(
                    () => resendAdminUserInvite(auth!, target.id),
                    "Davet e-postası yeniden gönderildi.",
                  );
                }}
              >
                Davet E-postasını Yeniden Gönder
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => trialAdminTenantSubscription(auth!, id, 7), "Deneme süresi verildi.")}>
              Deneme süresi ver
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => extendAdminTenantSubscription(auth!, id, { days: 7 }), "+7 gün")}>
              Aboneliği uzat (+7)
            </Button>
            {tenant.isActive ? (
              <Button size="sm" variant="secondary" onClick={() => setConfirm("deactivate")}>
                Pasife al
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirm("activate")}>
                Aktifleştir
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard label="Siteler" value={String(tenant.usage.sites)} />
        <StatCard label="Daireler" value={String(tenant.usage.apartments)} />
        <StatCard label="Kullanıcılar" value={String(tenant.usage.users)} />
        <StatCard
          label="Abonelik"
          value={sub ? SUB_STATUS_LABELS[sub.status] : "Yok"}
          hint={sub ? remainingLabel(sub) ?? PLAN_LABELS[sub.plan] : undefined}
        />
        <StatCard
          label="WhatsApp"
          value={tenant.whatsapp ? CONNECTION_LABELS[tenant.whatsapp.connectionStatus] ?? tenant.whatsapp.connectionStatus : "Yok"}
        />
        <StatCard label="Kullanım" value={String(tenant.usage.messages)} hint="İletişim kaydı" />
      </div>

      <DetailTabs
        tabs={[
          { id: "genel", label: "Genel" },
          { id: "siteler", label: "Siteler" },
          { id: "kullanicilar", label: "Kullanıcılar" },
          { id: "abonelik", label: "Abonelik" },
          { id: "entegrasyonlar", label: "Entegrasyonlar" },
          { id: "gecmis", label: "İşlem Geçmişi" },
          { id: "notlar", label: "Admin Notları" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "genel" ? (
        <div className="space-y-2 text-sm">
          <p><span className="text-muted">Oluşturulma:</span> {formatDateTr(tenant.createdAt)}</p>
          <p><span className="text-muted">Slug:</span> {tenant.slug}</p>
          <p><span className="text-muted">Kişiler:</span> {tenant.usage.persons}</p>
          <div className="flex flex-wrap gap-2 pt-3">
            <Link href={`/app/admin/siteler?tenant=${tenant.id}`}>
              <Button size="sm" variant="secondary">Siteleri gör</Button>
            </Link>
            <Link href={`/app/admin/kullanicilar?tenant=${tenant.id}`}>
              <Button size="sm" variant="secondary">Kullanıcıları gör</Button>
            </Link>
          </div>
        </div>
      ) : null}

      {tab === "siteler" ? (
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
                    <Link href={`/app/admin/siteler/${item.id}`} className="hover:text-accent">{item.name}</Link>
                  </TD>
                  <TD>{[item.city, item.district].filter(Boolean).join(" / ") || "—"}</TD>
                  <TD>{item.buildingCount}</TD>
                  <TD><StatusBadge active={item.isActive} /></TD>
                </TR>
              ))}
            </TBody>
          </TableElement>
        </Table>
      ) : null}

      {tab === "kullanicilar" ? (
        <Table>
          <TableElement>
            <THead>
              <TR>
                <TH>Ad Soyad</TH>
                <TH>E-posta</TH>
                <TH>Rol</TH>
                <TH>Durum</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {users.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/kullanicilar/${item.id}`} className="hover:text-accent">{item.fullName}</Link>
                  </TD>
                  <TD>{item.email}</TD>
                  <TD>{roleLabel(item.role)}</TD>
                  <TD><StatusBadge active={item.isActive} /></TD>
                  <TD>
                    {!item.isActive ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          void run(
                            () => resendAdminUserInvite(auth!, item.id),
                            "Davet e-postası yeniden gönderildi.",
                          )
                        }
                      >
                        Daveti yeniden gönder
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableElement>
        </Table>
      ) : null}

      {tab === "abonelik" ? (
        <div className="max-w-xl space-y-4">
          <p className="text-sm">
            {sub ? (
              <>
                {PLAN_LABELS[sub.plan]} · {SUB_STATUS_LABELS[sub.status]} · bitiş {formatDateTr(sub.endsAt)}
                {remainingLabel(sub) ? ` · ${remainingLabel(sub)}` : ""}
              </>
            ) : (
              "Henüz abonelik kaydı yok."
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => extendAdminTenantSubscription(auth!, id, { days: 7 }), "+7 gün uygulandı.")}>+7 gün</Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => extendAdminTenantSubscription(auth!, id, { days: 30 }), "+30 gün uygulandı.")}>+30 gün</Button>
            <Button size="sm" variant="secondary" onClick={() => setEndsAtOpen(true)}>Özel bitiş tarihi</Button>
          </div>
          <div className="flex gap-2">
            <Select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-48">
              <option value="DEMO">Demo</option>
              <option value="STANDARD">Standart</option>
              <option value="PROFESSIONAL">Profesyonel</option>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => void run(() => changeAdminSubscriptionPlan(auth!, id, plan), "Plan güncellendi.")}
            >
              Planı uygula
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "entegrasyonlar" ? (
        <p className="text-sm">
          {tenant.whatsapp
            ? `WhatsApp: ${CONNECTION_LABELS[tenant.whatsapp.connectionStatus] ?? tenant.whatsapp.connectionStatus}${tenant.whatsapp.wabaLinked ? " · WABA bağlı" : ""}`
            : "WhatsApp entegrasyonu yok."}
        </p>
      ) : null}

      {tab === "gecmis" ? (
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
      ) : null}

      {tab === "notlar" ? (
        <div className="max-w-xl space-y-4">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Support notu" />
          <Button
            disabled={pending || !note.trim()}
            onClick={() =>
              void run(async () => {
                await createAdminTenantNote(auth!, id, note.trim());
                setNote("");
              }, "Not eklendi.")
            }
          >
            Admin notu ekle
          </Button>
          <ul className="divide-y divide-line">
            {notes.map((item) => (
              <li key={item.id} className="py-3">
                <p className="text-sm text-ink">{item.content}</p>
                <p className="mt-1 text-caption text-muted">
                  {item.adminUser.fullName} · {formatDateTr(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
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
        open={endsAtOpen}
        title="Özel bitiş tarihi"
        onClose={() => setEndsAtOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndsAtOpen(false)}>Vazgeç</Button>
            <Button
              disabled={!endsAt || pending}
              onClick={() =>
                void run(async () => {
                  await extendAdminTenantSubscription(auth!, id, { endsAt: new Date(endsAt).toISOString() });
                  setEndsAtOpen(false);
                }, "Bitiş tarihi güncellendi.")
              }
            >
              Kaydet
            </Button>
          </>
        }
      >
        <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </Modal>
    </PageContainer>
  );
}
