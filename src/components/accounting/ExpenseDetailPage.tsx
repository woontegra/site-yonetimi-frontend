"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import {
  ExpenseFormModal,
  emptyExpenseForm,
  expenseFormToPayload,
  expenseToForm,
  type ExpenseFormValues,
} from "@/components/accounting/ExpenseFormModal";
import {
  SupplierFormModal,
  emptySupplierForm,
  supplierFormToPayload,
  type SupplierFormValues,
} from "@/components/suppliers/SupplierFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
import {
  cancelExpense,
  getExpense,
  listExpenseTypes,
  updateExpense,
  type Expense,
  type ExpenseType,
} from "@/lib/expenses-api";
import { ApiError } from "@/lib/http";
import {
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDateTr,
  formatMoney,
} from "@/lib/money";
import { createSupplier } from "@/lib/suppliers-api";

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [applySupplier, setApplySupplier] = useState<{
    id: string;
    name?: string;
    token: number;
  } | null>(null);
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);
  const [supplierQuickPending, setSupplierQuickPending] = useState(false);
  const [supplierQuickError, setSupplierQuickError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getExpense(auth, params.id);
      setExpense(result.expense);
    } catch (err) {
      setExpense(null);
      setError(err instanceof ApiError ? err.message : "Gider yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function openEdit() {
    if (!auth || !expense) return;
    setFormError("");
    setApplySupplier(null);
    try {
      const [buildingList, typeList] = await Promise.all([
        listBuildings(auth, { status: "aktif", perPage: 100 }),
        listExpenseTypes(auth, { activeOnly: true }),
      ]);
      setBuildings(buildingList.items);
      const types = typeList.items;
      if (!types.some((item) => item.id === expense.expenseType.id)) {
        types.unshift({
          id: expense.expenseType.id,
          name: expense.expenseType.name,
          isActive: expense.expenseType.isActive,
          sortOrder: 0,
          createdAt: expense.createdAt,
          deletedAt: null,
          expenseCount: 0,
        });
      }
      setExpenseTypes(types);
      setFormOpen(true);
    } catch (err) {
      toastError(err, "Düzenleme formu açılamadı.");
    }
  }

  async function handleSubmit(values: ExpenseFormValues) {
    if (!auth || !expense || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const payload = expenseFormToPayload(values);
      const result = await updateExpense(auth, expense.id, {
        ...payload,
        buildingId: values.buildingId || null,
        supplierId: values.supplierId || null,
        referenceNo: values.referenceNo.trim() || null,
        description: values.description.trim() || null,
      });
      setExpense(result.expense);
      setFormOpen(false);
      showToast("Gider güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gider kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleQuickSupplierSubmit(values: SupplierFormValues) {
    if (!auth || supplierQuickPending) return;
    setSupplierQuickPending(true);
    setSupplierQuickError("");
    try {
      const result = await createSupplier(auth, supplierFormToPayload(values));
      showToast("Tedarikçi oluşturuldu.");
      setSupplierQuickOpen(false);
      setApplySupplier({ id: result.supplier.id, name: result.supplier.name, token: Date.now() });
    } catch (err) {
      setSupplierQuickError(err instanceof ApiError ? err.message : "Tedarikçi kaydedilemedi.");
    } finally {
      setSupplierQuickPending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !expense || cancelPending) return;
    setCancelPending(true);
    try {
      const result = await cancelExpense(auth, expense.id);
      setExpense(result.expense);
      setCancelOpen(false);
      showToast("Gider iptal edildi.");
    } catch (err) {
      toastError(err, "Gider iptal edilemedi.");
    } finally {
      setCancelPending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe/giderler"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Giderler
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {expense ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">{expense.title}</h1>
              <p className="mt-1 text-sm text-muted">{expense.expenseType.name}</p>
            </div>
            {expense.status === "COMPLETED" ? (
              <div className="flex gap-2">
                <Button onClick={() => void openEdit()}>Düzenle</Button>
                <Dropdown
                  align="right"
                  trigger={
                    <Button variant="secondary" size="sm" aria-label="İşlemler">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                >
                  <DropdownItem onClick={() => setCancelOpen(true)}>Gideri İptal Et</DropdownItem>
                </Dropdown>
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
            <InfoItem label="Gider Türü" value={expense.expenseType.name} />
            <InfoItem label="Bina" value={expense.building?.name ?? "Genel Gider"} />
            <InfoItem
              label="Tedarikçi"
              value={
                expense.supplier ? (
                  <Link href={`/app/tedarikciler/${expense.supplier.id}`} className="hover:text-brand">
                    {expense.supplier.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <InfoItem label="Tarih" value={formatDateTr(expense.expenseDate)} />
            <InfoItem label="Tutar" value={formatMoney(expense.amount)} />
            <InfoItem label="Ödeme Yöntemi" value={PAYMENT_METHOD_LABELS[expense.paymentMethod]} />
            <InfoItem label="Referans No" value={expense.referenceNo || "—"} />
            <InfoItem label="Durum" value={EXPENSE_STATUS_LABELS[expense.status]} />
            <InfoItem label="Oluşturulma Tarihi" value={formatDateTr(expense.createdAt)} />
            <div className="col-span-2 md:col-span-4">
              <InfoItem label="Açıklama" value={expense.description || "—"} />
            </div>
          </dl>

          <ExpenseFormModal
            open={formOpen}
            title="Gideri Düzenle"
            expenseTypes={expenseTypes}
            initialValues={
              expense ? expenseToForm(expense, auth?.siteId ?? "") : emptyExpenseForm()
            }
            pending={formPending}
            error={formError}
            auth={auth}
            applySupplier={applySupplier}
            onQuickCreateSupplier={() => {
              setSupplierQuickError("");
              setSupplierQuickOpen(true);
            }}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <SupplierFormModal
            open={supplierQuickOpen}
            title="Yeni Tedarikçi"
            initialValues={emptySupplierForm()}
            pending={supplierQuickPending}
            error={supplierQuickError}
            onClose={() => (supplierQuickPending ? undefined : setSupplierQuickOpen(false))}
            onSubmit={handleQuickSupplierSubmit}
          />

          <ConfirmDialog
            open={cancelOpen}
            title="Gider iptal edilsin mi?"
            description="Bu gider finansal toplamların dışında bırakılacak ancak geçmiş kaydı korunacaktır."
            confirmLabel="Gideri İptal Et"
            cancelLabel="Vazgeç"
            danger
            pending={cancelPending}
            onConfirm={() => void handleCancel()}
            onClose={() => (cancelPending ? undefined : setCancelOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
