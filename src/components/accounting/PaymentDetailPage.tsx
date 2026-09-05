"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTr,
  formatMoney,
} from "@/lib/money";
import { cancelPayment, getPayment, previewPaymentCancel, type FinanceCheckResult, type Payment } from "@/lib/payments-api";

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelCheck, setCancelCheck] = useState<FinanceCheckResult | null>(null);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getPayment(auth, params.id);
      setPayment(result.payment);
    } catch (err) {
      setPayment(null);
      setError(err instanceof ApiError ? err.message : "Tahsilat yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function openCancelDialog() {
    if (!auth || !payment) return;
    setCancelOpen(true);
    setCancelCheck(null);
    try {
      const result = await previewPaymentCancel(auth, payment.id);
      setCancelCheck(result.check);
    } catch (err) {
      toastError(err, "İptal önizlemesi alınamadı.");
    }
  }

  async function handleCancel() {
    if (!auth || !payment || cancelPending) return;
    setCancelPending(true);
    try {
      const result = await cancelPayment(auth, payment.id);
      setPayment(result.payment);
      setCancelOpen(false);
      const reopenCount = Array.isArray(cancelCheck?.summary?.reopenLines)
        ? (cancelCheck?.summary?.reopenLines as unknown[]).filter(
            (line) => (line as { willReopen?: boolean }).willReopen,
          ).length
        : payment.allocations.length;
      showToast(
        reopenCount > 0
          ? `Tahsilat iptal edildi; ${reopenCount} borç yeniden açıldı.`
          : "Tahsilat iptal edildi.",
      );
    } catch (err) {
      toastError(err, "Tahsilat iptal edilemedi.");
    } finally {
      setCancelPending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe/tahsilatlar"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tahsilatlar
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {payment ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">Tahsilat Detayı</h1>
              <p className="mt-1 text-sm text-muted">
                {payment.building.name} · Daire {payment.apartment.number}
              </p>
            </div>
            {payment.status === "COMPLETED" ? (
              <Button variant="secondary" onClick={() => void openCancelDialog()}>
                Tahsilatı İptal Et
              </Button>
            ) : null}
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-line pb-5 md:grid-cols-4">
            <InfoItem label="Tarih" value={formatDateTr(payment.paymentDate)} />
            <InfoItem label="Daire" value={payment.apartment.number} />
            <InfoItem label="Bina" value={payment.building.name} />
            <InfoItem label="Ödeyen" value={payment.person?.fullName || "—"} />
            <InfoItem label="Ödeme Yöntemi" value={PAYMENT_METHOD_LABELS[payment.paymentMethod]} />
            <InfoItem label="Toplam Tutar" value={formatMoney(payment.amount)} />
            <InfoItem label="Referans No" value={payment.referenceNo || "—"} />
            <InfoItem label="Durum" value={PAYMENT_STATUS_LABELS[payment.status]} />
            <div className="col-span-2 md:col-span-4">
              <InfoItem label="Açıklama" value={payment.description || "—"} />
            </div>
          </dl>

          <h2 className="mb-2 text-[13px] font-medium text-ink">Borç Dağılımı</h2>
          <Table>
            <TableElement>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Borç</TH>
                  <TH>Vade</TH>
                  <TH className="text-right">Ayrılan Tutar</TH>
                </TR>
              </THead>
              <TBody>
                {payment.allocations.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <Link href={`/app/muhasebe/borclar/${item.debt.id}`} className="hover:text-brand">
                        {item.debt.title}
                      </Link>
                    </TD>
                    <TD>{formatDateTr(item.debt.dueDate)}</TD>
                    <TD className="text-right">{formatMoney(item.amount)}</TD>
                  </TR>
                ))}
              </TBody>
            </TableElement>
          </Table>

          <ConfirmDialog
            open={cancelOpen}
            title="Tahsilat iptal edilsin mi?"
            description={
              typeof cancelCheck?.summary?.openDebtIncrease === "string"
                ? `Bu tahsilat iptal edilirse dairenin açık borcu ${Number(
                    cancelCheck.summary.openDebtIncrease,
                  ).toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ₺ artacaktır.`
                : "Bu tahsilat iptal edildiğinde borçlara dağıtılan tutarlar geri alınacaktır."
            }
            confirmLabel="Tahsilatı İptal Et"
            cancelLabel="Vazgeç"
            danger
            pending={cancelPending}
            alert={
              Array.isArray(cancelCheck?.summary?.reopenLines)
                ? (
                    cancelCheck.summary.reopenLines as Array<{
                      title: string;
                      restoredAmount: string;
                      willReopen: boolean;
                    }>
                  )
                    .filter((line) => line.willReopen)
                    .map(
                      (line) =>
                        `${line.title}: ${Number(line.restoredAmount).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ₺`,
                    )
                    .join("\n") || undefined
                : undefined
            }
            onConfirm={() => void handleCancel()}
            onClose={() => (cancelPending ? undefined : setCancelOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
