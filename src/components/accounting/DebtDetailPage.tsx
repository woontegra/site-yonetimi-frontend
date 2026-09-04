"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import {
  DebtFormModal,
  debtToForm,
  type DebtFormValues,
} from "@/components/accounting/DebtFormModal";
import { PaymentFormModal } from "@/components/accounting/PaymentFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { cn } from "@/lib/cn";
import {
  cancelApartmentDebt,
  getApartmentDebt,
  updateApartmentDebt,
  type ApartmentDebt,
} from "@/lib/debts-api";
import { ApiError } from "@/lib/http";
import {
  DEBT_STATUS_LABELS,
  DEBT_TYPE_LABELS,
  DUE_STATE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDateTr,
  formatMoney,
  formatPeriod,
} from "@/lib/money";
import { RELATION_TYPE_LABELS } from "@/lib/person-constants";
import { listPersons, type PersonListItem } from "@/lib/persons-api";
import {
  createPayment,
  listPayments,
  type Payment,
  type PaymentPayload,
} from "@/lib/payments-api";
import { listRelations } from "@/lib/relations-api";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "odemeler", label: "Ödemeler" },
  { id: "hareketler", label: "Hareketler" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function DebtDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();

  const [debt, setDebt] = useState<ApartmentDebt | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState("");
  const [persons, setPersons] = useState<PersonListItem[]>([]);
  const [relatedPersons, setRelatedPersons] = useState<
    Array<{ id: string; fullName: string; roleLabel: string }>
  >([]);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getApartmentDebt(auth, params.id);
      setDebt(result.debt);
    } catch (err) {
      setDebt(null);
      setError(err instanceof ApiError ? err.message : "Borç yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadPayments = useCallback(async () => {
    if (!auth || !params.id) return;
    setPaymentsLoading(true);
    try {
      const result = await listPayments(auth, {
        apartmentDebtId: params.id,
        status: "COMPLETED",
        perPage: 100,
      });
      setPayments(result.items);
    } catch {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || tab !== "odemeler") return;
    void loadPayments();
  }, [ready, tab, loadPayments]);

  async function openPaymentModal() {
    if (!auth || !debt) return;
    setPayError("");
    try {
      const [personList, relationList] = await Promise.all([
        listPersons(auth, { status: "aktif", perPage: 100 }),
        listRelations(auth, { apartmentId: debt.apartment.id, active: true, perPage: 50 }),
      ]);
      setPersons(personList.items);
      setRelatedPersons(
        relationList.items.map((item) => ({
          id: item.person.id,
          fullName: item.person.fullName,
          roleLabel: RELATION_TYPE_LABELS[item.relationType],
        })),
      );
      setPayOpen(true);
    } catch (err) {
      toastError(err, "Ödeme formu açılamadı.");
    }
  }

  async function handleSubmit(values: DebtFormValues) {
    if (!auth || !debt || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const unpaid = debt.originalAmount === debt.remainingAmount;
      const result = await updateApartmentDebt(auth, debt.id, {
        title: values.title.trim(),
        dueDate: values.dueDate,
        ...(values.description.trim()
          ? { description: values.description.trim() }
          : { description: "" }),
        ...(unpaid ? { amount: Number(values.amount.replace(",", ".")) } : {}),
      });
      setDebt(result.debt);
      setFormOpen(false);
      showToast("Borç güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !debt || cancelPending) return;
    setCancelPending(true);
    try {
      const result = await cancelApartmentDebt(auth, debt.id);
      setDebt(result.debt);
      setCancelOpen(false);
      showToast("Borç iptal edildi.");
    } catch (err) {
      toastError(err, "Borç iptal edilemedi.");
    } finally {
      setCancelPending(false);
    }
  }

  async function handlePayment(payload: PaymentPayload, submitSiteId: string) {
    if (!auth || payPending) return;
    setPayPending(true);
    setPayError("");
    try {
      await createPayment({ ...auth, siteId: submitSiteId || auth.siteId }, payload, crypto.randomUUID());
      showToast("Tahsilat kaydedildi.");
      setPayOpen(false);
      await Promise.all([load(), loadPayments()]);
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Tahsilat kaydedilemedi.");
    } finally {
      setPayPending(false);
    }
  }

  const unpaid = debt ? debt.originalAmount === debt.remainingAmount : false;
  const canCollect =
    debt?.status === "OPEN" && Number(debt.remainingAmount) > 0;

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Muhasebe
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {debt ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">{debt.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {debt.building.name} · Daire {debt.apartment.number}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCollect ? (
                <Button onClick={() => void openPaymentModal()}>
                  <Plus className="size-4" aria-hidden />
                  Ödeme Al
                </Button>
              ) : null}
              {debt.status === "OPEN" ? (
                <>
                  <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                    Borcu İptal Et
                  </Button>
                  <Button variant="secondary" onClick={() => setFormOpen(true)}>
                    Düzenle
                  </Button>
                </>
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
              <InfoItem label="Borç Türü" value={DEBT_TYPE_LABELS[debt.type]} />
              <InfoItem label="Dönem" value={formatPeriod(debt.periodYear, debt.periodMonth)} />
              <InfoItem label="İlk Tutar" value={formatMoney(debt.originalAmount)} />
              <InfoItem label="Kalan Tutar" value={formatMoney(debt.remainingAmount)} />
              <InfoItem label="Vade" value={formatDateTr(debt.dueDate)} />
              <InfoItem
                label="Durum"
                value={
                  <span>
                    {DEBT_STATUS_LABELS[debt.status]}
                    {debt.dueState === "overdue" ? (
                      <span className="ml-2 text-[12px] text-danger">{DUE_STATE_LABELS.overdue}</span>
                    ) : null}
                  </span>
                }
              />
              <InfoItem label="Oluşturulma" value={formatDateTr(debt.createdAt)} />
              <div className="col-span-2 md:col-span-4">
                <InfoItem label="Açıklama" value={debt.description || "—"} />
              </div>
            </dl>
          ) : null}

          {tab === "odemeler" ? (
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Tarih</TH>
                    <TH>Ödeyen</TH>
                    <TH>Ödeme Yöntemi</TH>
                    <TH className="text-right">Tahsilat</TH>
                    <TH className="text-right">Bu Borca Ayrılan</TH>
                    <TH className="text-right">İşlem</TH>
                  </TR>
                </THead>
                <TBody>
                  {paymentsLoading ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={6}>
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ) : null}
                  {!paymentsLoading && payments.length === 0 ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                        Henüz ödeme kaydı bulunmuyor.
                      </TD>
                    </TR>
                  ) : null}
                  {!paymentsLoading
                    ? payments.map((payment) => {
                        const allocated =
                          payment.allocations.find((item) => item.debt.id === debt.id)?.amount ??
                          "0";
                        return (
                          <TR key={payment.id}>
                            <TD>{formatDateTr(payment.paymentDate)}</TD>
                            <TD>{payment.person?.fullName || "—"}</TD>
                            <TD>{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</TD>
                            <TD className="text-right">{formatMoney(payment.amount)}</TD>
                            <TD className="text-right">{formatMoney(allocated)}</TD>
                            <TD className="text-right">
                              <Link
                                href={`/app/muhasebe/tahsilatlar/${payment.id}`}
                                className="text-sm text-brand hover:underline"
                              >
                                Detay
                              </Link>
                            </TD>
                          </TR>
                        );
                      })
                    : null}
                </TBody>
              </TableElement>
            </Table>
          ) : null}

          {tab === "hareketler" ? (
            <p className="py-6 text-sm text-muted">Henüz hareket bulunmuyor.</p>
          ) : null}

          <DebtFormModal
            open={formOpen}
            title="Borcu Düzenle"
            isEdit
            allowAmountEdit={unpaid}
            initialValues={debtToForm(debt)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <PaymentFormModal
            open={payOpen}
            mode="single"
            debts={[debt]}
            persons={persons}
            relatedPersons={relatedPersons}
            apartmentContext={
              debt
                ? {
                    siteId: auth?.siteId ?? "",
                    label: `${debt.building.name} · Daire ${debt.apartment.number}`,
                  }
                : null
            }
            pending={payPending}
            error={payError}
            onClose={() => (payPending ? undefined : setPayOpen(false))}
            onSubmit={handlePayment}
          />

          <ConfirmDialog
            open={cancelOpen}
            title="Borç iptal edilsin mi?"
            description="Bu borç aktif borç toplamlarından çıkarılacaktır. Finansal geçmiş kaydı korunacaktır."
            confirmLabel="Borcu İptal Et"
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
