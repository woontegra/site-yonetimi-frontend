"use client";

import { useEffect, useState } from "react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  classifyBankDebit,
  type BankTransaction,
  type ClassifyBankDebitPayload,
} from "@/lib/banks-api";
import { normalizeApiError } from "@/lib/api-error";
import { formatDateTr, formatMoney } from "@/lib/money";
import { listExpenseTypes, type ExpenseType } from "@/lib/expenses-api";
import { listSuppliers, type Supplier } from "@/lib/suppliers-api";

type AuthCtx = { token: string; tenantId: string; siteId?: string | null };

type BankDebitClassifyModalProps = {
  open: boolean;
  auth: AuthCtx | null;
  transaction: BankTransaction | null;
  onClose: () => void;
  onDone: (message: string) => void;
};

type Step = "menu" | "expense";

/**
 * Kasa / banka arası transfer / avans domain'de yok — UI'da disabled gösterilir.
 */
export function BankDebitClassifyModal({
  open,
  auth,
  transaction,
  onClose,
  onDone,
}: BankDebitClassifyModalProps) {
  const [step, setStep] = useState<Step>("menu");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [title, setTitle] = useState("");
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open || !transaction) {
      setStep("menu");
      setError("");
      setPending(false);
      return;
    }
    setTitle(transaction.description.slice(0, 120));
    setExpenseDate(transaction.transactionDate.slice(0, 10));
    setReferenceNo(transaction.referenceNo ?? "");
    setDescription(transaction.description);
    setExpenseTypeId("");
    setSupplierId("");
    setStep("menu");
  }, [open, transaction]);

  useEffect(() => {
    if (!open || !auth || step !== "expense") return;
    let cancelled = false;
    void Promise.all([
      listExpenseTypes(auth, { activeOnly: true }),
      listSuppliers(auth, { status: "aktif", perPage: 100 }),
    ])
      .then(([types, supplierList]) => {
        if (cancelled) return;
        setExpenseTypes(types.items);
        setSuppliers(supplierList.items);
      })
      .catch(() => {
        if (!cancelled) setError("Gider formu yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth, step]);

  async function run(payload: ClassifyBankDebitPayload, successMessage: string) {
    if (!auth || !transaction || pending) return;
    setPending(true);
    setError("");
    try {
      await classifyBankDebit(auth, transaction.id, payload);
      onDone(successMessage);
      onClose();
    } catch (err) {
      setError(normalizeApiError(err, "Sınıflandırma başarısız.").userMessage);
    } finally {
      setPending(false);
    }
  }

  async function submitExpense() {
    if (!title.trim() || !expenseTypeId || !expenseDate) {
      setError("Gider türü, başlık ve tarih zorunludur.");
      return;
    }
    await run(
      {
        action: "CREATE_EXPENSE",
        title: title.trim(),
        expenseTypeId,
        expenseDate,
        paymentMethod: "BANK_TRANSFER",
        ...(supplierId ? { supplierId } : {}),
        ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      },
      "Gider kaydedildi ve banka hareketine bağlandı.",
    );
  }

  return (
    <FormModal
      open={open}
      onClose={pending ? () => undefined : onClose}
      title="Giden hareketi sınıflandır"
      description={
        transaction
          ? `${formatDateTr(transaction.transactionDate)} · ${formatMoney(transaction.amount)} · ${transaction.description.slice(0, 80)}`
          : undefined
      }
      size="md"
      footer={
        step === "expense" ? (
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setStep("menu")}>
              Geri
            </Button>
            <Button disabled={pending} onClick={() => void submitExpense()}>
              {pending ? "Kaydediliyor…" : "Gideri Kaydet"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Kapat
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

        {step === "menu" ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              ATM çekimi otomatik gider değildir. Kararı siz verin.
            </p>
            <Button
              className="w-full justify-start"
              variant="secondary"
              disabled={pending}
              onClick={() => setStep("expense")}
            >
              Gider Olarak Kaydet
            </Button>
            <Button className="w-full justify-start" variant="secondary" disabled title="Kasa modeli yok">
              Kasaya Aktarıldı (kapsam dışı)
            </Button>
            <Button className="w-full justify-start" variant="secondary" disabled title="Avans modeli yok">
              Avans Olarak Kaydet (kapsam dışı)
            </Button>
            <Button
              className="w-full justify-start"
              variant="secondary"
              disabled
              title="Hesaplar arası transfer modeli yok"
            >
              Banka Transferi (kapsam dışı)
            </Button>
            <Button
              className="w-full justify-start"
              variant="secondary"
              disabled={pending}
              onClick={() => void run({ action: "EXCLUDE" }, "Hareket hariç tutuldu.")}
            >
              Hariç Tut
            </Button>
            <Button
              className="w-full justify-start"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                onDone("Daha sonra işlenecek — sınıflandırılmadı olarak bırakıldı.");
                onClose();
              }}
            >
              Daha Sonra İşle
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <AlertBanner tone="info" title="Gider kaydı">
              Onaydan sonra tek bir Expense oluşur ve bu banka hareketine bağlanır. Aynı hareketten
              ikinci gider oluşmaz.
            </AlertBanner>
            <FormField label="Başlık" htmlFor="debit-exp-title" required>
              <Input
                id="debit-exp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>
            <FormField label="Gider türü" htmlFor="debit-exp-type" required>
              <Select
                id="debit-exp-type"
                value={expenseTypeId}
                onChange={(e) => setExpenseTypeId(e.target.value)}
              >
                <option value="">Seçin</option>
                {expenseTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="İşlem tarihi" htmlFor="debit-exp-date" required>
              <Input
                id="debit-exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </FormField>
            <FormField label="Tutar">
              <Input value={transaction ? formatMoney(transaction.amount) : ""} disabled />
            </FormField>
            <FormField label="Tedarikçi" htmlFor="debit-exp-supplier">
              <Select
                id="debit-exp-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Belge / fiş no" htmlFor="debit-exp-ref">
              <Input
                id="debit-exp-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </FormField>
            <FormField label="Açıklama" htmlFor="debit-exp-desc">
              <Input
                id="debit-exp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>
        )}
      </div>
    </FormModal>
  );
}
