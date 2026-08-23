"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  createAdminUserNote,
  deactivateAdminUser,
  getAdminUser,
  listAdminUserAuditLogs,
  resendAdminUserInvite,
  type AdminAuditLog,
  type AdminUserDetail,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

type Tab = "genel" | "abonelik" | "gecmis";

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("genel");
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<"activate" | "deactivate" | null>(null);

  const load = useCallback(async () => {
    if (!auth || !id) return;
    setLoading(true);
    setError("");
    try {
      const [{ user: next }, logRes] = await Promise.all([
        getAdminUser(auth, id),
        listAdminUserAuditLogs(auth, id, { page: 1, perPage: 20 }),
      ]);
      setUser(next);
      setLogs(logRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kullanıcı yüklenemedi.");
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

  if (loading && !user) {
    return <PageContainer><p className="text-sm text-muted">Yükleniyor…</p></PageContainer>;
  }
  if (error || !user) {
    return <PageContainer><p className="text-sm text-danger">{error || "Kullanıcı bulunamadı."}</p></PageContainer>;
  }

  const sub = user.subscription;

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/admin/kullanicilar"
        backLabel="Kullanıcılara dön"
        title={user.fullName}
        description={`${user.email}${user.tenant ? ` · ${user.tenant.name}` : ""} · ${roleLabel(user.role)}`}
        status={<StatusBadge active={user.isActive} />}
        actions={
          <>
            {user.tenant ? (
              <Link href={`/app/admin/tenantlar/${user.tenant.id}`}>
                <Button size="sm" variant="secondary">Tenant’a git</Button>
              </Link>
            ) : null}
            {user.tenant ? (
              <Link href="/app/admin/abonelikler">
                <Button size="sm" variant="secondary">Aboneliğe git</Button>
              </Link>
            ) : null}
            {user.isActive ? (
              <Button size="sm" variant="secondary" onClick={() => setConfirm("deactivate")}>Pasife al</Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => resendAdminUserInvite(auth!, id),
                      "Davet e-postası yeniden gönderildi.",
                    )
                  }
                >
                  Davet E-postasını Yeniden Gönder
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirm("activate")}>Aktifleştir</Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Abonelik" value={sub ? SUB_STATUS_LABELS[sub.status] : "Yok"} hint={sub ? PLAN_LABELS[sub.plan] : undefined} />
        <StatCard label="Siteler" value={String(user.usage.sites)} />
        <StatCard label="Kullanım" value={String(user.usage.messages)} hint="İletişim kaydı" />
        <StatCard label="Son giriş" value={formatDateTr(user.lastLoginAt)} />
      </div>

      <DetailTabs
        tabs={[
          { id: "genel", label: "Genel" },
          { id: "abonelik", label: "Abonelik" },
          { id: "gecmis", label: "İşlem Geçmişi" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "genel" ? (
        <div className="max-w-xl space-y-4 text-sm">
          <p><span className="text-muted">Oluşturulma:</span> {formatDateTr(user.createdAt)}</p>
          <p><span className="text-muted">Tenant rolü:</span> {roleLabel(user.role)}</p>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tenant support notu" />
          <Button
            disabled={pending || !note.trim() || !user.tenant}
            onClick={() =>
              void run(async () => {
                await createAdminUserNote(auth!, id, note.trim());
                setNote("");
              }, "Not eklendi.")
            }
          >
            Admin notu ekle
          </Button>
        </div>
      ) : null}

      {tab === "abonelik" ? (
        <p className="text-sm">
          {sub
            ? `${PLAN_LABELS[sub.plan]} · ${SUB_STATUS_LABELS[sub.status]} · ${formatDateTr(sub.startsAt)} – ${formatDateTr(sub.endsAt)}${remainingLabel(sub) ? ` · ${remainingLabel(sub)}` : ""}`
            : "Abonelik kaydı yok."}
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

      <ConfirmDialog
        open={confirm === "deactivate"}
        title="Kullanıcı pasife alınsın mı?"
        description="Hesap giriş yapamaz. Şifre gösterilmez."
        danger
        pending={pending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run(() => deactivateAdminUser(auth!, id), "Kullanıcı pasife alındı.")}
      />
      <ConfirmDialog
        open={confirm === "activate"}
        title="Kullanıcı aktifleştirilsin mi?"
        description="Hesap yeniden giriş yapabilir."
        pending={pending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run(() => activateAdminUser(auth!, id), "Kullanıcı aktifleştirildi.")}
      />
    </PageContainer>
  );
}
