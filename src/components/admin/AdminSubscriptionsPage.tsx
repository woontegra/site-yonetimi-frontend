"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PLAN_LABELS, SUB_STATUS_LABELS, remainingLabel, subscriptionTone } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  changeAdminSubscriptionPlan,
  extendAdminSubscription,
  listAdminSubscriptions,
  reactivateAdminSubscription,
  suspendAdminSubscription,
  type AdminSubscriptionListItem,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function AdminSubscriptionsPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminSubscriptionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [endsAtOpen, setEndsAtOpen] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState("");
  const [planOpen, setPlanOpen] = useState<string | null>(null);
  const [plan, setPlan] = useState("STANDARD");
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminSubscriptions(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        status: status || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Abonelikler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, status]);

  useEffect(() => setPage(1), [debouncedSearch, status]);
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
      setSuspendId(null);
      setEndsAtOpen(null);
      setPlanOpen(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Abonelikler"
        description="Tenant lisans ve deneme süreleri."
        search={<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tenant adı" />}
        actions={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">Tümü</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Plan</TH>
              <TH>Durum</TH>
              <TH>Başlangıç</TH>
              <TH>Bitiş</TH>
              <TH>Kalan gün</TH>
              <TH>Siteler</TH>
              <TH>İşlem</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={8} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={8} className="p-0"><TableEmptyState title="Abonelik bulunamadı." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="font-medium hover:text-accent">
                      {item.tenant.name}
                    </Link>
                  </TD>
                  <TD>{PLAN_LABELS[item.plan]}</TD>
                  <TD>
                    <div>
                      <StatusBadge label={SUB_STATUS_LABELS[item.status]} tone={subscriptionTone(item.status)} />
                      {remainingLabel(item) ? <p className="mt-1 text-caption text-muted">{remainingLabel(item)}</p> : null}
                    </div>
                  </TD>
                  <TD>{formatDateTr(item.startsAt)}</TD>
                  <TD>{formatDateTr(item.endsAt)}</TD>
                  <TD>{item.remainingDays}</TD>
                  <TD>{item.tenant.siteCount}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => extendAdminSubscription(auth!, item.tenant.id, { days: 7 }), "+7 gün")}>+7</Button>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => extendAdminSubscription(auth!, item.tenant.id, { days: 30 }), "+30 gün")}>+30</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setEndsAtOpen(item.tenant.id); setEndsAt(item.endsAt.slice(0, 10)); }}>Tarih</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setPlanOpen(item.tenant.id); setPlan(item.plan); }}>Plan</Button>
                      {item.status === "SUSPENDED" ? (
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => reactivateAdminSubscription(auth!, item.tenant.id), "Yeniden aktif")}>Aktif et</Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setSuspendId(item.tenant.id)}>Askıya al</Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(suspendId)}
        title="Abonelik askıya alınsın mı?"
        description="Tenant aboneliği SUSPENDED olur."
        danger
        pending={pending}
        onClose={() => setSuspendId(null)}
        onConfirm={() => void run(() => suspendAdminSubscription(auth!, suspendId!), "Askıya alındı.")}
      />
      <Modal
        open={Boolean(endsAtOpen)}
        title="Özel bitiş tarihi"
        onClose={() => setEndsAtOpen(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndsAtOpen(null)}>Vazgeç</Button>
            <Button disabled={!endsAt || pending} onClick={() => void run(() => extendAdminSubscription(auth!, endsAtOpen!, { endsAt: new Date(endsAt).toISOString() }), "Bitiş güncellendi.")}>Kaydet</Button>
          </>
        }
      >
        <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </Modal>
      <Modal
        open={Boolean(planOpen)}
        title="Plan değiştir"
        onClose={() => setPlanOpen(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlanOpen(null)}>Vazgeç</Button>
            <Button disabled={pending} onClick={() => void run(() => changeAdminSubscriptionPlan(auth!, planOpen!, plan), "Plan değişti.")}>Kaydet</Button>
          </>
        }
      >
        <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="DEMO">Demo</option>
          <option value="STANDARD">Standart</option>
          <option value="PROFESSIONAL">Profesyonel</option>
        </Select>
      </Modal>
    </PageContainer>
  );
}
