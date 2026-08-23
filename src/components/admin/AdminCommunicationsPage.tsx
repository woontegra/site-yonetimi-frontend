"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Input } from "@/components/ui/Input";
import { MESSAGE_STATUS_LABELS } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { listAdminCommunications, type AdminMessageListItem } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function AdminCommunicationsPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [tenantId, setTenantId] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminMessageListItem[]>([]);
  const [summary, setSummary] = useState({ sent: 0, delivered: 0, read: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedProvider = useDebouncedValue(provider);
  const debouncedTenant = useDebouncedValue(tenantId);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminCommunications(auth, {
        page,
        perPage: PER_PAGE,
        tenantId: /^[0-9a-f-]{36}$/i.test(debouncedTenant) ? debouncedTenant : undefined,
        provider: debouncedProvider || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İletişim kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedTenant, debouncedProvider, status, from, to]);

  useEffect(() => setPage(1), [debouncedTenant, debouncedProvider, status, from, to]);
  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <PageHeader
        title="İletişim geçmişi"
        description="Platform genelindeki gönderimler."
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Tenant id (uuid)" />
        <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Sağlayıcı" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tüm durumlar</option>
          <option value="SENT">Gönderildi</option>
          <option value="DELIVERED">Teslim</option>
          <option value="READ">Okundu</option>
          <option value="FAILED">Başarısız</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Gönderildi" value={String(summary.sent)} />
        <StatCard label="Teslim edildi" value={String(summary.delivered)} />
        <StatCard label="Okundu" value={String(summary.read)} />
        <StatCard label="Başarısız" value={String(summary.failed)} />
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Site</TH>
              <TH>Sağlayıcı</TH>
              <TH>Durum</TH>
              <TH>Tarih</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={6} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={6} className="p-0"><TableEmptyState title="Kayıt bulunamadı." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="hover:text-accent">{item.tenant.name}</Link>
                  </TD>
                  <TD>{item.site.name}</TD>
                  <TD>{item.provider || item.channel}</TD>
                  <TD>
                    <StatusBadge
                      label={MESSAGE_STATUS_LABELS[item.status] ?? item.status}
                      status={item.status === "FAILED" ? "failed" : item.status === "READ" || item.status === "DELIVERED" || item.status === "SENT" ? "active" : "inactive"}
                    />
                  </TD>
                  <TD>{formatDateTr(item.createdAt)}</TD>
                  <TD>
                    <Link href={`/app/admin/iletisim/${item.id}`} className="text-sm text-accent">Detay</Link>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
    </PageContainer>
  );
}
