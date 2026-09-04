"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import {
  SupplierFormModal,
  supplierFormToPayload,
  supplierToForm,
  type SupplierFormValues,
} from "@/components/suppliers/SupplierFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { cn } from "@/lib/cn";
import { listExpenses, type Expense } from "@/lib/expenses-api";
import { ApiError } from "@/lib/http";
import { EXPENSE_STATUS_LABELS, formatDateTr, formatMoney } from "@/lib/money";
import {
  archiveSupplier,
  getSupplier,
  updateSupplier,
  type SupplierDetail,
} from "@/lib/suppliers-api";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "giderler", label: "Giderler" },
  { id: "gecmis", label: "Geçmiş" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const PER_PAGE = 20;

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: false });

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expensesLoading, setExpensesLoading] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getSupplier(auth, params.id);
      setSupplier(result.supplier);
    } catch (err) {
      setSupplier(null);
      setError(err instanceof ApiError ? err.message : "Tedarikçi yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadExpenses = useCallback(async () => {
    if (!auth || !params.id) return;
    setExpensesLoading(true);
    try {
      const result = await listExpenses(auth, {
        supplierId: params.id,
        page: expensePage,
        perPage: PER_PAGE,
      });
      setExpenses(result.items);
      setExpenseTotal(result.total);
    } catch {
      setExpenses([]);
      setExpenseTotal(0);
    } finally {
      setExpensesLoading(false);
    }
  }, [auth, params.id, expensePage]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || tab !== "giderler") return;
    void loadExpenses();
  }, [ready, tab, loadExpenses]);

  async function handleSubmit(values: SupplierFormValues) {
    if (!auth || !supplier || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateSupplier(auth, supplier.id, supplierFormToPayload(values));
      await load();
      setFormOpen(false);
      showToast("Tedarikçi güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !supplier || archivePending) return;
    setArchivePending(true);
    try {
      await archiveSupplier(auth, supplier.id);
      showToast("Tedarikçi arşivlendi.");
      setArchiveOpen(false);
      await load();
    } catch (err) {
      toastError(err, "Tedarikçi arşivlenemedi.");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/tedarikciler"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tedarikçiler
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {supplier ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">{supplier.name}</h1>
              {supplier.contactPerson ? (
                <p className="mt-1 text-sm text-muted">{supplier.contactPerson}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setFormError("");
                  setFormOpen(true);
                }}
              >
                Düzenle
              </Button>
              {supplier.isActive ? (
                <Dropdown
                  align="right"
                  trigger={
                    <Button variant="secondary" size="sm" aria-label="İşlemler">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                >
                  <DropdownItem danger onClick={() => setArchiveOpen(true)}>
                    Arşivle
                  </DropdownItem>
                </Dropdown>
              ) : null}
            </div>
          </div>

          <div className="mb-4 flex gap-1 border-b border-line">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors duration-micro",
                  tab === item.id
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "genel" ? (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
              <InfoItem label="Tedarikçi" value={supplier.name} />
              <InfoItem label="Yetkili" value={supplier.contactPerson || "—"} />
              <InfoItem label="Telefon" value={supplier.phone || "—"} />
              <InfoItem label="E-posta" value={supplier.email || "—"} />
              <InfoItem label="Vergi No" value={supplier.taxNumber || "—"} />
              <InfoItem label="Vergi Dairesi" value={supplier.taxOffice || "—"} />
              <InfoItem label="Şehir" value={supplier.city || "—"} />
              <InfoItem label="İlçe" value={supplier.district || "—"} />
              <div>
                <dt className="text-xs text-muted">Durum</dt>
                <dd className="mt-0.5">
                  <StatusBadge active={supplier.isActive} />
                </dd>
              </div>
              <div className="col-span-2 md:col-span-4">
                <InfoItem label="Adres" value={supplier.address || "—"} />
              </div>
              <div className="col-span-2 md:col-span-4">
                <InfoItem label="Not" value={supplier.note || "—"} />
              </div>
            </dl>
          ) : null}

          {tab === "giderler" ? (
            <div>
              <p className="mb-3 text-sm text-muted">
                Toplam Gider:{" "}
                <span className="font-medium text-ink">
                  {formatMoney(supplier.summary.completedExpenseTotal)}
                </span>
                <span className="ml-2 text-xs">
                  ({supplier.summary.completedExpenseCount} tamamlanan
                  {supplier.summary.cancelledExpenseCount > 0
                    ? ` · ${supplier.summary.cancelledExpenseCount} iptal`
                    : ""}
                  )
                </span>
              </p>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Tarih</TH>
                      <TH>Gider</TH>
                      <TH>Tip</TH>
                      <TH>Bina</TH>
                      <TH className="text-right">Tutar</TH>
                      <TH>Durum</TH>
                      <TH className="text-right">Detay</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {expensesLoading
                      ? Array.from({ length: 4 }).map((_, index) => (
                          <TR key={`es-${index}`} className="hover:bg-transparent">
                            <TD colSpan={7}>
                              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                            </TD>
                          </TR>
                        ))
                      : null}
                    {!expensesLoading && expenses.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                          Henüz gider kaydı bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!expensesLoading
                      ? expenses.map((expense) => (
                          <TR key={expense.id}>
                            <TD>{formatDateTr(expense.expenseDate)}</TD>
                            <TD className="font-medium">{expense.title}</TD>
                            <TD>{expense.expenseType.name}</TD>
                            <TD>{expense.building?.name || "Genel Gider"}</TD>
                            <TD className="text-right">{formatMoney(expense.amount)}</TD>
                            <TD>{EXPENSE_STATUS_LABELS[expense.status]}</TD>
                            <TD className="text-right">
                              <Link
                                href={`/app/muhasebe/giderler/${expense.id}`}
                                className="text-sm text-brand hover:underline"
                              >
                                Detay
                              </Link>
                            </TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>
              <Pagination
                page={expensePage}
                perPage={PER_PAGE}
                total={expenseTotal}
                onPageChange={setExpensePage}
              />
            </div>
          ) : null}

          {tab === "gecmis" ? (
            <p className="py-8 text-center text-sm text-muted">Henüz geçmiş kaydı bulunmuyor.</p>
          ) : null}

          <SupplierFormModal
            open={formOpen}
            title="Tedarikçiyi Düzenle"
            initialValues={supplierToForm(supplier)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <ConfirmDialog
            open={archiveOpen}
            title="Tedarikçi arşivlensin mi?"
            description="Tedarikçi arşivlenecek. Geçmiş gider kayıtları korunacaktır."
            confirmLabel="Arşivle"
            cancelLabel="Vazgeç"
            danger
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => (archivePending ? undefined : setArchiveOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
