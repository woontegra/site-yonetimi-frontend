"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PLAN_LABELS, SUB_STATUS_LABELS, roleLabel } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import {
  getAdminUserSummary,
  listAdminUsers,
  type AdminUserListItem,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function AdminUsersPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const tenantFromQuery = searchParams.get("tenant") ?? "";
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") || "1") || 1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, trial: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (status) params.set("status", status);
    if (tenantFromQuery) params.set("tenant", tenantFromQuery);
    if (page > 1) params.set("page", String(page));
    return params.toString();
  }, [debouncedSearch, status, tenantFromQuery, page]);

  const detailHref = useCallback(
    (userId: string) => {
      const from = listQuery ? `?from=${encodeURIComponent(listQuery)}` : "";
      return `/app/admin/kullanicilar/${userId}${from}`;
    },
    [listQuery],
  );

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const [list, counts] = await Promise.all([
        listAdminUsers(auth, {
          page,
          perPage: PER_PAGE,
          search: debouncedSearch,
          status: status || undefined,
          tenantId: tenantFromQuery || undefined,
        }),
        getAdminUserSummary(auth),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setSummary(counts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kullanıcılar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, status, tenantFromQuery]);

  useEffect(() => setPage(1), [debouncedSearch, status, tenantFromQuery]);
  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <PageHeader
        title="Kullanıcı Yönetimi"
        description="Giriş yapan sistem hesapları. Site içindeki kişilerle karıştırılmaz. Parola/hash gösterilmez."
        search={
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad veya e-posta" />
        }
        actions={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <option value="">Tümü</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </Select>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Toplam" value={String(summary.total)} />
        <StatCard label="Aktif" value={String(summary.active)} />
        <StatCard label="Pasif" value={String(summary.inactive)} />
        <StatCard label="Deneme" value={String(summary.trial)} />
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Ad Soyad</TH>
              <TH>E-posta</TH>
              <TH>Tenant</TH>
              <TH>Rol</TH>
              <TH>Abonelik</TH>
              <TH>Son giriş</TH>
              <TH>Durum</TH>
              <TH>Oluşturulma</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={9} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={9} className="p-0"><TableEmptyState title="Kullanıcı bulunamadı." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={detailHref(item.id)} className="font-medium hover:text-accent">
                      {item.fullName}
                    </Link>
                    {item.isPlatformAdmin ? (
                      <Badge tone="brand" className="ml-1.5">Platform</Badge>
                    ) : null}
                  </TD>
                  <TD>{item.email}</TD>
                  <TD>
                    {item.tenant ? (
                      <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="hover:text-accent">
                        {item.tenant.name}
                      </Link>
                    ) : "—"}
                  </TD>
                  <TD>{roleLabel(item.role)}</TD>
                  <TD>
                    {item.subscription
                      ? `${PLAN_LABELS[item.subscription.plan]} · ${SUB_STATUS_LABELS[item.subscription.status]}`
                      : "—"}
                  </TD>
                  <TD>{formatDateTr(item.lastLoginAt)}</TD>
                  <TD><StatusBadge active={item.isActive} /></TD>
                  <TD>{formatDateTr(item.createdAt)}</TD>
                  <TD>
                    <Link href={detailHref(item.id)}>
                      <Button size="sm" variant="secondary">Detay</Button>
                    </Link>
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
