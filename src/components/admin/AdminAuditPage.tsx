"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { AUDIT_ACTION_LABELS } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { listAdminAuditLogs, type AdminAuditLog } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function AdminAuditPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminAuditLogs(auth, { page, perPage: PER_PAGE, search: debouncedSearch });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Denetim kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch]);

  useEffect(() => setPage(1), [debouncedSearch]);
  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <PageHeader
        title="Denetim kayıtları"
        description="Platform admin işlemleri. Kayıtlar silinmez."
        search={<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İşlem veya admin" />}
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>İşlem</TH>
              <TH>Hedef</TH>
              <TH>Tenant</TH>
              <TH>Admin</TH>
              <TH>Tarih</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={5} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={5} className="p-0"><TableEmptyState title="Kayıt yok." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>{AUDIT_ACTION_LABELS[item.action] ?? item.action}</TD>
                  <TD>{item.targetType}</TD>
                  <TD>
                    {item.tenant ? (
                      <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="hover:text-accent">{item.tenant.name}</Link>
                    ) : "—"}
                  </TD>
                  <TD>{item.adminUser.fullName}</TD>
                  <TD>{formatDateTr(item.createdAt)}</TD>
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
