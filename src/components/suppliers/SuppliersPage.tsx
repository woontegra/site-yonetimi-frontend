"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  SupplierFormModal,
  emptySupplierForm,
  supplierFormToPayload,
  supplierToForm,
  type SupplierFormValues,
} from "@/components/suppliers/SupplierFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  archiveSupplier,
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
  type Supplier,
} from "@/lib/suppliers-api";

const PER_PAGE = 20;

export function SuppliersPage() {
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: false });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [archiving, setArchiving] = useState<Supplier | null>(null);
  const [archivePending, setArchivePending] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      setListError("Sunucuya bağlanılamadı.");
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listSuppliers(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
        status: status === "aktif" || status === "pasif" ? status : undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, page, status]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  function openCreate() {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  async function openEdit(supplier: Supplier) {
    if (!auth) return;
    setFormError("");
    try {
      const result = await getSupplier(auth, supplier.id);
      setEditing(result.supplier);
      setFormOpen(true);
    } catch (error) {
      toastError(error, "Tedarikçi yüklenemedi.");
    }
  }

  async function handleSubmit(values: SupplierFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const payload = supplierFormToPayload(values);
      if (editing) {
        await updateSupplier(auth, editing.id, payload);
        showToast("Tedarikçi güncellendi.");
      } else {
        await createSupplier(auth, payload);
        showToast("Tedarikçi oluşturuldu.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !archiving || archivePending) return;
    setArchivePending(true);
    try {
      await archiveSupplier(auth, archiving.id);
      showToast("Tedarikçi arşivlendi.");
      setArchiving(null);
      await load();
    } catch (error) {
      toastError(error, "Tedarikçi arşivlenemedi.");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Tedarikçiler"
        description="Tedarikçi kayıtlarını yönetin."
        search={
          <SearchInput
            placeholder="Tedarikçi ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Tedarikçi ara"
          />
        }
        actions={
          <>
            <Select
              className="w-full min-w-0 text-sm sm:w-auto"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Tüm durumlar</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </Select>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Yeni Tedarikçi
            </Button>
          </>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Tedarikçi</TH>
              <TH>Yetkili</TH>
              <TH>Şehir</TH>
              <TH>Telefon</TH>
              <TH>E-posta</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                    <TD colSpan={7}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}

            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                  Henüz tedarikçi bulunmuyor.
                </TD>
              </TR>
            ) : null}

            {!loading
              ? items.map((supplier) => (
                  <TR key={supplier.id}>
                    <TD className="font-medium">
                      <Link href={`/app/tedarikciler/${supplier.id}`} className="hover:text-brand">
                        {supplier.name}
                      </Link>
                    </TD>
                    <TD>{supplier.contactPerson || "—"}</TD>
                    <TD>{supplier.city || "—"}</TD>
                    <TD>{supplier.phone || "—"}</TD>
                    <TD>{supplier.email || "—"}</TD>
                    <TD>
                      <StatusBadge active={supplier.isActive} />
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label={`${supplier.name} işlemleri`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/tedarikciler/${supplier.id}`}>Detay</DropdownItem>
                        <DropdownItem onClick={() => void openEdit(supplier)}>Düzenle</DropdownItem>
                        <DropdownItem danger onClick={() => setArchiving(supplier)}>
                          Arşivle
                        </DropdownItem>
                      </Dropdown>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>

      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <SupplierFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Tedarikçiyi Düzenle" : "Yeni Tedarikçi"}
        initialValues={editing ? supplierToForm(editing) : emptySupplierForm()}
        pending={formPending}
        error={formError}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Tedarikçi arşivlensin mi?"
        description="Tedarikçi arşivlenecek. Geçmiş gider kayıtları korunacaktır."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
        danger
        pending={archivePending}
        onConfirm={() => void handleArchive()}
        onClose={() => (archivePending ? undefined : setArchiving(null))}
      />
    </PageContainer>
  );
}
