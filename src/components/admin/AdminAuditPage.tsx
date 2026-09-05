"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Table, TableElement, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AUDIT_ACTION_LABELS } from "@/components/admin/labels";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { listAdminAuditLogs, type AdminAuditLog } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

const ACTION_OPTIONS = Object.keys(AUDIT_ACTION_LABELS);

export function AdminAuditPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AdminAuditLog | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminAuditLogs(auth, {
        page,
        perPage: PER_PAGE,
        search: debouncedSearch,
        action: action || undefined,
        targetType: targetType || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Denetim kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, page, debouncedSearch, action, targetType, from, to]);

  useEffect(() => setPage(1), [debouncedSearch, action, targetType, from, to]);
  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <PageHeader
        title="Admin Denetim Kayıtları"
        description="Platform admin işlemleri. Kayıtlar arayüzden değiştirilemez veya silinemez."
        search={<SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İşlem veya admin" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-44">
              <option value="">Tüm işlemler</option>
              {ACTION_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {AUDIT_ACTION_LABELS[code] ?? code}
                </option>
              ))}
            </Select>
            <Select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="w-36">
              <option value="">Hedef türü</option>
              <option value="Tenant">Tenant</option>
              <option value="User">User</option>
              <option value="Subscription">Subscription</option>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          </div>
        }
      />
      {error ? <p className="mb-3 text-[12px] text-danger">{error}</p> : null}
      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>İşlem</TH>
              <TH>Hedef</TH>
              <TH>Tenant</TH>
              <TH>Admin</TH>
              <TH>Tarih</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR><TD colSpan={6} className="text-muted">Yükleniyor…</TD></TR>
            ) : items.length === 0 ? (
              <TR><TD colSpan={6} className="p-0"><TableEmptyState title="Kayıt yok." /></TD></TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>{AUDIT_ACTION_LABELS[item.action] ?? item.action}</TD>
                  <TD>
                    <div className="text-[12px]">{item.targetType}</div>
                    <div className="text-[11px] text-muted">{item.targetId.slice(0, 8)}…</div>
                  </TD>
                  <TD>
                    {item.tenantId ? (
                      <Link href={`/app/admin/tenantlar/${item.tenantId}`} className="text-accent hover:underline">
                        Organizasyon
                      </Link>
                    ) : "—"}
                  </TD>
                  <TD>
                    <div className="text-[12px]">{item.adminUser?.fullName ?? "—"}</div>
                    <div className="text-[11px] text-muted">{item.adminUser?.email}</div>
                  </TD>
                  <TD>{formatDateTr(item.createdAt)}</TD>
                  <TD>
                    <Button size="sm" variant="secondary" onClick={() => setDetail(item)}>
                      Detay
                    </Button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <Modal
        open={Boolean(detail)}
        title="Denetim detayı"
        description="Salt okunur. Parola/token alanları kaydedilmez."
        onClose={() => setDetail(null)}
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Kapat</Button>}
      >
        {detail ? (
          <dl className="grid gap-2 text-[12px]">
            <div className="flex justify-between gap-2"><dt className="text-muted">İşlem</dt><dd>{AUDIT_ACTION_LABELS[detail.action] ?? detail.action}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Hedef</dt><dd>{detail.targetType} · {detail.targetId}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Admin</dt><dd>{detail.adminUser?.fullName}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Tarih</dt><dd>{formatDateTr(detail.createdAt)}</dd></div>
            <div>
              <dt className="mb-1 text-muted">Metadata</dt>
              <pre className="overflow-x-auto rounded-md bg-canvas p-2 text-[11px] text-ink">
                {JSON.stringify(detail.metadata ?? {}, null, 2)}
              </pre>
            </div>
          </dl>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
