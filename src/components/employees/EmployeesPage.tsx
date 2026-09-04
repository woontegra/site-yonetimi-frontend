"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  EmployeeFormModal,
  emptyEmployeeForm,
  employeeFormToCreatePayload,
  employeeFormToUpdatePayload,
  employeeToForm,
  type EmployeeFormValues,
} from "@/components/employees/EmployeeFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  archiveEmployee,
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
  type Employee,
} from "@/lib/employees-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

const PER_PAGE = 20;

export function EmployeesPage() {
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const debouncedJobTitle = useDebouncedValue(jobTitle, 300);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [archiving, setArchiving] = useState<Employee | null>(null);
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
      const result = await listEmployees(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
        status: status === "aktif" || status === "pasif" ? status : undefined,
        jobTitle: debouncedJobTitle.trim() || undefined,
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
  }, [auth, debouncedJobTitle, debouncedSearch, page, status]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, debouncedJobTitle]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  async function openEdit(employee: Employee) {
    if (!auth) return;
    setFormError("");
    try {
      const result = await getEmployee(auth, employee.id);
      setEditing(result.employee);
      setFormOpen(true);
    } catch (error) {
      toastError(error, "Çalışan yüklenemedi.");
    }
  }

  async function handleSubmit(values: EmployeeFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      if (editing) {
        await updateEmployee(auth, editing.id, employeeFormToUpdatePayload(values));
        showToast("Çalışan güncellendi.");
      } else {
        if (!values.siteId) {
          setFormError("Site seçimi zorunludur.");
          setFormPending(false);
          return;
        }
        await createEmployee(
          { ...auth, siteId: values.siteId },
          employeeFormToCreatePayload(values),
        );
        showToast("Çalışan oluşturuldu.");
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
      await archiveEmployee(auth, archiving.id);
      showToast("Çalışan arşivlendi.");
      setArchiving(null);
      await load();
    } catch (error) {
      toastError(error, "Çalışan arşivlenemedi.");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Çalışanlar"
        description={
          site?.name ? `${site.name} için çalışan kayıtlarını yönetin.` : "Çalışanları yönetin."
        }
        search={
          <SearchInput
            placeholder="Çalışan ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Çalışan ara"
          />
        }
        actions={
          <>
            <Select
              className="h-10 w-full min-w-0 text-sm sm:w-auto"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Durum filtresi"
            >
              <option value="">Tüm durumlar</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </Select>
            <Input
              className="h-10 w-full min-w-0 text-sm sm:w-auto"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Görev filtresi"
              aria-label="Görev filtresi"
            />
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Çalışan Ekle
            </Button>
          </>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Ad Soyad</TH>
              <TH>Telefon</TH>
              <TH>E-posta</TH>
              <TH>Görevi</TH>
              <TH>Görev Yeri</TH>
              <TH>İşe Giriş</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                    <TD colSpan={8}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}

            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={8} className="py-8 text-center text-sm text-muted">
                  Henüz çalışan bulunmuyor.
                </TD>
              </TR>
            ) : null}

            {!loading
              ? items.map((employee) => (
                  <TR key={employee.id}>
                    <TD className="font-medium">
                      <Link href={`/app/calisanlar/${employee.id}`} className="hover:text-brand">
                        {employee.fullName}
                      </Link>
                    </TD>
                    <TD>{employee.phone || "—"}</TD>
                    <TD>{employee.email || "—"}</TD>
                    <TD>{employee.jobTitle}</TD>
                    <TD>{employee.assignmentSummary || "—"}</TD>
                    <TD>{formatDateTr(employee.hireDate)}</TD>
                    <TD>
                      <StatusBadge active={employee.isActive} />
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label={`${employee.fullName} işlemleri`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/calisanlar/${employee.id}`}>Detay</DropdownItem>
                        <DropdownItem onClick={() => void openEdit(employee)}>Düzenle</DropdownItem>
                        <DropdownItem danger onClick={() => setArchiving(employee)}>
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

      <EmployeeFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Çalışanı Düzenle" : "Yeni Çalışan"}
        initialValues={
          editing ? employeeToForm(editing, siteId ?? "") : emptyEmployeeForm(siteId ?? "")
        }
        pending={formPending}
        error={formError}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Çalışan arşivlensin mi?"
        description="Çalışan arşivlenecek. Geçmiş görevlendirmeler korunur."
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
