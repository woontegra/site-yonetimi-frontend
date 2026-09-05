"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { PLAN_LABELS, SUB_STATUS_LABELS } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { listAdminTenantStats, type AdminTenantStatsItem } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function AdminTenantStatsPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminTenantStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminTenantStats(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İstatistikler yüklenemedi.");
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
        title="Tenant İstatistikleri"
        description="Kullanım göstergeleri. Tahsilat tutarı veya borç bakiyesi gösterilmez."
        search={
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Organizasyon ara" />
        }
      />
      {error ? <p className="mb-3 text-[12px] text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Organizasyon</TH>
              <TH>Site</TH>
              <TH>Bina</TH>
              <TH>Daire</TH>
              <TH>Kullanıcı</TH>
              <TH>Aktiflik</TH>
              <TH>Kullanım</TH>
              <TH>Lisans</TH>
              <TH>Son giriş</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={9} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={9} className="p-0"><TableEmptyState title="Kayıt yok." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.id}`} className="font-medium text-ink hover:text-accent">
                      {item.name}
                    </Link>
                    <div className="mt-0.5"><StatusBadge active={item.isActive} /></div>
                  </TD>
                  <TD>{item.siteCount}</TD>
                  <TD>{item.buildingCount}</TD>
                  <TD>{item.apartmentCount}</TD>
                  <TD>{item.userCount}</TD>
                  <TD>
                    <div className="text-[12px]">7g: {item.activeUsers7d}</div>
                    <div className="text-[11px] text-muted">30g: {item.activeUsers30d}</div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <Flag on={item.usageFlags.hasDebts} label="Borç" />
                      <Flag on={item.usageFlags.hasPayments} label="Tahsilat" />
                      <Flag on={item.usageFlags.hasBankImport} label="Banka" />
                      <Flag on={item.usageFlags.whatsappConnected} label="WA" />
                    </div>
                  </TD>
                  <TD>
                    {item.subscription ? (
                      <div>
                        <p className="text-[12px]">{PLAN_LABELS[item.subscription.plan]}</p>
                        <p className="text-[11px] text-muted">{SUB_STATUS_LABELS[item.subscription.status]}</p>
                      </div>
                    ) : "—"}
                  </TD>
                  <TD>{item.lastLoginAt ? formatDateTr(item.lastLoginAt) : "—"}</TD>
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

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={on ? "rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700" : "rounded bg-slate-100 px-1.5 py-0.5 text-slate-500"}>
      {label}
    </span>
  );
}
