"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Button } from "@/components/ui/Button";
import { SETUP_LABELS } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { listAdminSites, type AdminSiteListItem } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function AdminSitesPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminSiteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminSites(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        status: status || undefined,
        tenantId: searchParams.get("tenant") || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Siteler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, status, searchParams]);

  useEffect(() => setPage(1), [debouncedSearch, status]);
  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <PageHeader
        title="Siteler"
        description="Platform genelindeki siteler."
        search={<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Site adı veya şehir" />}
        actions={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <option value="">Tümü</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </Select>
        }
      />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Site</TH>
              <TH>Tenant</TH>
              <TH>Şehir / İlçe</TH>
              <TH>Bina</TH>
              <TH>Daire</TH>
              <TH>Sakin</TH>
              <TH>Durum</TH>
              <TH>Setup</TH>
              <TH>Oluşturulma</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={10} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={10} className="p-0"><TableEmptyState title="Site bulunamadı." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/app/admin/siteler/${item.id}`} className="font-medium hover:text-accent">{item.name}</Link>
                  </TD>
                  <TD>
                    <Link href={`/app/admin/tenantlar/${item.tenant.id}`} className="hover:text-accent">{item.tenant.name}</Link>
                  </TD>
                  <TD>{[item.city, item.district].filter(Boolean).join(" / ") || "—"}</TD>
                  <TD>{item.buildingCount}</TD>
                  <TD>{item.apartmentCount}</TD>
                  <TD>{item.residentCount}</TD>
                  <TD><StatusBadge active={item.isActive} /></TD>
                  <TD>{SETUP_LABELS[item.setupStatus] ?? item.setupStatus}</TD>
                  <TD>{formatDateTr(item.createdAt)}</TD>
                  <TD>
                    <Link href={`/app/admin/siteler/${item.id}`}><Button size="sm" variant="secondary">Aç</Button></Link>
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
