"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { ApartmentCombobox } from "@/components/apartments/ApartmentCombobox";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { Apartment } from "@/lib/apartments-api";
import {
  applyMappingToMatrix,
  detectAccountHints,
  ibanMatchesStored,
  isMappingComplete,
  maskIbanDisplay,
  parseBankStatementFile,
  readStatementMatrix,
  type ColumnMapping,
  type DetectedAccountHints,
  type ParsedStatementRow,
} from "@/lib/bank-statement-parse";
import { PdfStatementError, type PdfParseProgress } from "@/lib/bank-statement-pdf";
import {
  commitBankStatementImport,
  createBankAccount,
  createBankColumnTemplate,
  getBankAccount,
  listBankColumnTemplates,
  previewBankStatementImport,
  type BankAccount,
  type BankColumnTemplate,
  type StatementPreviewRow,
} from "@/lib/banks-api";
import { ApiError } from "@/lib/http";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

type Step = 1 | 2 | 3 | 4;

type AuthCtx = { token: string; tenantId: string; siteId?: string | null };

type ManualOverride = {
  apartmentId: string;
  personId?: string;
  createRule?: boolean;
  containsText?: string;
  processPayment?: boolean;
};

type WizardProps = {
  open: boolean;
  auth: AuthCtx;
  accounts: BankAccount[];
  apartments: Apartment[];
  onClose: () => void;
  onDone: () => void;
  /** Hesap oluşturulunca üst listeyi yenile (sihirbaz kapanmaz). */
  onAccountsChanged?: () => void | Promise<void>;
};

const STEPS = [
  { id: 1 as const, label: "Hesap ve Dosya" },
  { id: 2 as const, label: "Kolonları Eşle" },
  { id: 3 as const, label: "Hareketleri Kontrol Et" },
  { id: 4 as const, label: "Onayla ve Aktar" },
];

function previewStatusLabel(row: StatementPreviewRow): string {
  if (row.previewStatus === "DUPLICATE") return "Mükerrer";
  if (row.previewStatus === "INVALID") return "Geçersiz";
  if (row.previewStatus === "DEBIT_SKIP_PAYMENT") return "Giden";
  if (row.previewStatus === "AMBIGUOUS") return "Birden fazla aday";
  if (row.match?.matchStatus === "SUGGESTED") return "Otomatik Eşleşti";
  if (row.match?.matchStatus === "UNMATCHED") return "Eşleşmedi";
  return "Hazır";
}

function defaultAccountId(list: BankAccount[]): string {
  if (list.length === 1) return list[0]!.id;
  return "";
}

export function BankStatementImportWizard({
  open,
  auth,
  accounts,
  apartments,
  onClose,
  onDone,
  onAccountsChanged,
}: WizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [localAccounts, setLocalAccounts] = useState<BankAccount[]>(accounts);
  const [bankAccountId, setBankAccountId] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({
    bankName: "",
    accountName: "Site Aidat Hesabı",
    iban: "",
    accountNumber: "",
  });
  const [accountMatchNote, setAccountMatchNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileKind, setFileKind] = useState<"spreadsheet" | "pdf" | "">("");
  const [fileSizeLabel, setFileSizeLabel] = useState("");
  const [pdfMeta, setPdfMeta] = useState<{
    pageCount: number;
    warnings: string[];
    balanceChainOk: boolean | null;
    adapterName: string;
  } | null>(null);
  const [parseProgress, setParseProgress] = useState<string>("");
  const [pdfPasswordRequired, setPdfPasswordRequired] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [matrix, setMatrix] = useState<unknown[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    description: "",
  });
  const [parsedRows, setParsedRows] = useState<ParsedStatementRow[]>([]);
  const [parseErrors, setParseErrors] = useState<Array<{ rowNumber: number; message: string }>>(
    [],
  );
  const [accountHints, setAccountHints] = useState<DetectedAccountHints | null>(null);
  const [previewRows, setPreviewRows] = useState<StatementPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{
    totalRows: number;
    creditCount: number;
    debitCount: number;
    invalidCount: number;
    duplicateCount: number;
    autoMatchedCount: number;
    unmatchedCount: number;
    importableCreditTotal: string;
  } | null>(null);
  const [overrides, setOverrides] = useState<Record<number, ManualOverride>>({});
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  const [templates, setTemplates] = useState<BankColumnTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [matchRowIndex, setMatchRowIndex] = useState<number | null>(null);
  const [matchApartmentId, setMatchApartmentId] = useState("");
  const [matchCreateRule, setMatchCreateRule] = useState(true);
  const [matchPattern, setMatchPattern] = useState("");

  const reset = useCallback(() => {
    setStep(1);
    setLocalAccounts(accounts);
    setBankAccountId(defaultAccountId(accounts));
    setShowAccountForm(accounts.length === 0);
    setAccountForm({
      bankName: "",
      accountName: "Site Aidat Hesabı",
      iban: "",
      accountNumber: "",
    });
    setAccountMatchNote("");
    setFileName("");
    setFileKind("");
    setFileSizeLabel("");
    setPdfMeta(null);
    setParseProgress("");
    setPdfPasswordRequired(false);
    setPdfPassword("");
    setPendingFile(null);
    setMatrix([]);
    setHeaders([]);
    setHeaderRowIndex(0);
    setMapping({ date: "", description: "" });
    setParsedRows([]);
    setParseErrors([]);
    setAccountHints(null);
    setPreviewRows([]);
    setPreviewSummary(null);
    setOverrides({});
    setSkipped({});
    setTemplateName("");
    setError("");
    setPending(false);
    setMatchRowIndex(null);
  }, [accounts]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  // Üst listeden gelen hesaplar değişince (sihirbaz açıkken create sonrası) senkronize et;
  // seçili hesap ve dosya ilerlemeyi silme.
  useEffect(() => {
    if (!open) return;
    setLocalAccounts(accounts);
    if (accounts.length === 1 && !bankAccountId) {
      setBankAccountId(accounts[0]!.id);
    }
    if (accounts.length > 0) setShowAccountForm(false);
  }, [accounts, open, bankAccountId]);

  useEffect(() => {
    if (!open || !auth || !bankAccountId) return;
    void listBankColumnTemplates(auth, bankAccountId)
      .then((result) => setTemplates(result.items))
      .catch(() => setTemplates([]));
  }, [open, auth, bankAccountId]);

  async function tryMatchAccountFromHints(
    hints: DetectedAccountHints,
    list: BankAccount[],
  ): Promise<string | null> {
    if (!hints.iban || list.length === 0) return null;
    const maskCandidates = list.filter((account) =>
      ibanMatchesStored(hints.iban!, account.iban, account.ibanFull),
    );
    if (maskCandidates.length !== 1) return null;

    const candidate = maskCandidates[0]!;
    try {
      const detailed = await getBankAccount(auth, candidate.id);
      if (
        ibanMatchesStored(
          hints.iban,
          detailed.bankAccount.iban,
          detailed.bankAccount.ibanFull ?? detailed.bankAccount.iban,
        )
      ) {
        setAccountMatchNote(
          `Ekstre şu hesapla eşleştirildi: ${maskIbanDisplay(detailed.bankAccount.ibanFull ?? detailed.bankAccount.iban)}`,
        );
        return detailed.bankAccount.id;
      }
    } catch {
      return null;
    }
    return null;
  }

  async function handleFile(file: File | null, password?: string) {
    if (!file) return;
    if (!bankAccountId && localAccounts.length > 0) {
      setError("Önce ekstrenin ait olduğu hesabı seçin veya yeni hesap oluşturun.");
      return;
    }
    if (!bankAccountId && localAccounts.length === 0) {
      setError("Dosya yüklemeden önce bir hesap tanımlayın.");
      setShowAccountForm(true);
      return;
    }

    setError("");
    setPending(true);
    setPendingFile(file);
    setParseProgress("Dosya açılıyor…");
    try {
      const parsed = await parseBankStatementFile(file, {
        password,
        onProgress: (phase: PdfParseProgress, detail) => {
          if (phase === "opening") setParseProgress("Dosya açılıyor…");
          else if (phase === "extracting_text")
            setParseProgress(`Metin çıkarılıyor…${detail ? ` (${detail})` : ""}`);
          else if (phase === "detecting_transactions")
            setParseProgress("Hareketler belirleniyor…");
          else if (phase === "preparing_preview") setParseProgress("Kontrol hazırlanıyor…");
        },
      });

      setFileName(file.name);
      setFileKind(parsed.sourceKind === "pdf" ? "pdf" : "spreadsheet");
      setFileSizeLabel(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
      setPdfPasswordRequired(false);
      setPdfPassword("");
      setParseErrors(parsed.errors);
      setAccountHints(parsed.accountHints ?? null);
      setParsedRows(parsed.rows);
      setHeaders(parsed.headers);
      setHeaderRowIndex(parsed.headerRowIndex);
      setMapping(parsed.mapping);

      if (parsed.sourceKind === "pdf" && parsed.pdfMeta) {
        setPdfMeta({
          pageCount: parsed.pdfMeta.pageCount,
          warnings: parsed.pdfMeta.warnings,
          balanceChainOk: parsed.pdfMeta.balanceChainOk,
          adapterName: parsed.pdfMeta.adapterName,
        });
        setMatrix([]);
      } else {
        setPdfMeta(null);
        const matrixResult = await readStatementMatrix(file);
        setMatrix(matrixResult.matrix);
        if (!parsed.accountHints) {
          setAccountHints(detectAccountHints(matrixResult.matrix, parsed.headerRowIndex));
        }
      }

      let selectedId = bankAccountId;
      const hints = parsed.accountHints;
      if (hints) {
        const matched = await tryMatchAccountFromHints(hints, localAccounts);
        if (matched) {
          selectedId = matched;
          setBankAccountId(matched);
        } else {
          setAccountMatchNote("");
        }
      }

      if (!selectedId) {
        setError("Hesap seçilmeden devam edilemez.");
        setStep(1);
        return;
      }

      if (parsed.mappingComplete && parsed.rows.length > 0) {
        await runPreview(parsed.rows, selectedId);
      } else if (parsed.sourceKind === "pdf") {
        setError("PDF metni okundu ancak hareket sütunları otomatik belirlenemedi.");
        setStep(1);
      } else {
        setStep(2);
      }
    } catch (err) {
      if (err instanceof PdfStatementError && err.code === "PASSWORD_REQUIRED") {
        setPdfPasswordRequired(true);
        setPendingFile(file);
        setError(err.message);
        setParseProgress("");
        return;
      }
      if (err instanceof PdfStatementError && err.code === "ENCRYPTED") {
        setPdfPasswordRequired(true);
        setPendingFile(file);
        setError(err.message);
        setParseProgress("");
        return;
      }
      setError(err instanceof Error ? err.message : "Dosya okunamadı.");
      setParseProgress("");
    } finally {
      setPending(false);
      setParseProgress("");
    }
  }

  function reapplyMapping(next: ColumnMapping) {
    setMapping(next);
    if (!isMappingComplete(next) || matrix.length === 0) {
      setParsedRows([]);
      return;
    }
    const result = applyMappingToMatrix(matrix, headerRowIndex, headers, next);
    setParsedRows(result.rows);
    setParseErrors(result.errors);
  }

  async function runPreview(rows: ParsedStatementRow[] = parsedRows, accountId = bankAccountId) {
    if (!auth || !accountId) {
      setError("Banka hesabı seçin.");
      return;
    }
    if (rows.length === 0) {
      setError("Önizlenecek satır yok.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await previewBankStatementImport(auth, {
        bankAccountId: accountId,
        rows: rows.map((row) => ({
          transactionDate: row.transactionDate,
          valueDate: row.valueDate,
          direction: row.direction,
          amount: row.amount,
          description: row.description,
          referenceNo: row.referenceNo,
          balanceAfter: row.balanceAfter,
          sourceRowNumber: row.sourceRowNumber,
          sourcePage: row.sourcePage ?? null,
        })),
      });
      setPreviewRows(result.rows);
      setPreviewSummary(result.summary);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Önizleme başarısız.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveAccount() {
    if (!auth || pending) return;
    if (!accountForm.bankName.trim() || !accountForm.accountName.trim()) {
      setError("Banka adı ve hesap adı zorunludur.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await createBankAccount(auth, {
        bankName: accountForm.bankName.trim(),
        accountName: accountForm.accountName.trim(),
        ...(accountForm.iban.trim() ? { iban: accountForm.iban.trim() } : {}),
        ...(accountForm.accountNumber.trim()
          ? { accountNumber: accountForm.accountNumber.trim() }
          : {}),
      });
      const created = result.bankAccount;
      setLocalAccounts((prev) => {
        if (prev.some((item) => item.id === created.id)) return prev;
        return [...prev, created];
      });
      setBankAccountId(created.id);
      setShowAccountForm(false);
      setAccountForm({
        bankName: "",
        accountName: "Site Aidat Hesabı",
        iban: "",
        accountNumber: "",
      });
      await onAccountsChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Hesap kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  function openMatch(row: StatementPreviewRow) {
    setMatchRowIndex(row.rowIndex);
    setMatchApartmentId(overrides[row.rowIndex]?.apartmentId ?? row.match?.apartmentId ?? "");
    setMatchCreateRule(true);
    setMatchPattern(row.suggestedPattern ?? "");
  }

  function saveMatch() {
    if (matchRowIndex == null || !matchApartmentId) return;
    setOverrides((prev) => ({
      ...prev,
      [matchRowIndex]: {
        apartmentId: matchApartmentId,
        createRule: matchCreateRule,
        containsText: matchPattern.trim() || undefined,
        processPayment: true,
      },
    }));
    setMatchRowIndex(null);
  }

  async function saveTemplate() {
    if (!auth || !templateName.trim() || !isMappingComplete(mapping)) return;
    setPending(true);
    try {
      await createBankColumnTemplate(auth, {
        name: templateName.trim(),
        bankAccountId: bankAccountId || null,
        mapping: {
          date: mapping.date,
          description: mapping.description,
          amount: mapping.amount,
          debit: mapping.debit,
          credit: mapping.credit,
          reference: mapping.reference,
          balance: mapping.balance,
          valueDate: mapping.valueDate,
        },
      });
      setTemplateName("");
      const result = await listBankColumnTemplates(auth, bankAccountId);
      setTemplates(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şablon kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleCommit() {
    if (!auth || !bankAccountId || previewRows.length === 0) return;
    setPending(true);
    setError("");
    try {
      const rows = previewRows.map((row) => {
        const override = overrides[row.rowIndex];
        const matchedApartmentId = override?.apartmentId ?? row.match?.apartmentId ?? null;
        const matchedPersonId = override?.personId ?? row.match?.personId ?? null;
        const autoProcess =
          row.direction === "CREDIT" &&
          Boolean(matchedApartmentId) &&
          row.previewStatus !== "DUPLICATE" &&
          row.previewStatus !== "INVALID" &&
          override?.processPayment !== false &&
          (Boolean(override) ||
            (row.match?.matchStatus === "SUGGESTED" &&
              row.match.confidence !== "LOW" &&
              row.canAutoProcess));

        return {
          transactionDate: row.transactionDate,
          valueDate: row.valueDate,
          direction: row.direction,
          amount: row.amount,
          description: row.description,
          referenceNo: row.referenceNo,
          balanceAfter: row.balanceAfter,
          sourceRowNumber: row.sourceRowNumber,
          sourcePage: row.sourcePage ?? null,
          fingerprint: row.fingerprint,
          matchedApartmentId,
          matchedPersonId,
          processPayment: Boolean(autoProcess),
          createRule: Boolean(override?.createRule && override.containsText),
          containsText: override?.containsText,
          skip: Boolean(skipped[row.rowIndex]) || row.previewStatus === "DUPLICATE",
        };
      });

      await commitBankStatementImport(auth, { bankAccountId, rows });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Aktarım başarısız.");
    } finally {
      setPending(false);
    }
  }

  const mappingFields: Array<{ key: keyof ColumnMapping; label: string }> = [
    { key: "date", label: "İşlem tarihi *" },
    { key: "valueDate", label: "Valör tarihi" },
    { key: "description", label: "Açıklama *" },
    { key: "amount", label: "Tek tutar kolonu" },
    { key: "debit", label: "Borç (giden)" },
    { key: "credit", label: "Alacak (gelen)" },
    { key: "reference", label: "Fiş / referans" },
    { key: "balance", label: "Bakiye" },
  ];

  return (
    <FormModal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Ekstre İçe Aktar"
      description="Banka ekstresini yükleyin, eşleştirin ve onay sonrası tahsilata aktarın. Onay öncesi ödeme oluşmaz."
      size="xl"
      footer={
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending || step === 1}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            Geri
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              İptal
            </Button>
            {step === 2 ? (
              <Button
                type="button"
                disabled={pending || !isMappingComplete(mapping) || !bankAccountId}
                onClick={() => void runPreview()}
              >
                Önizle
              </Button>
            ) : null}
            {step === 3 ? (
              <Button type="button" disabled={pending} onClick={() => setStep(4)}>
                Onaya Geç
              </Button>
            ) : null}
            {step === 4 ? (
              <Button type="button" disabled={pending} onClick={() => void handleCommit()}>
                {pending ? "Aktarılıyor…" : "Onayla ve Aktar"}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="mb-4 flex min-w-0 flex-wrap gap-2">
        {STEPS.map((item) => (
          <div
            key={item.id}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              step === item.id
                ? "bg-accent/15 text-accent"
                : step > item.id
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-muted",
            )}
          >
            {step > item.id ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-muted">
            Banka bağlantısı kurulmaz. Hesap bilgisi yalnızca yüklediğiniz ekstreleri düzenlemek
            ve mükerrer hareketleri önlemek için kullanılır. İnternet bankacılığı şifresi veya
            API anahtarı istenmez.
          </p>

          {localAccounts.length > 0 ? (
            <div className="space-y-2">
              <FormField label="Ekstrenin ait olduğu hesap" htmlFor="stmt-account">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    id="stmt-account"
                    className="min-w-0 flex-1"
                    value={bankAccountId}
                    onChange={(e) => {
                      setBankAccountId(e.target.value);
                      setAccountMatchNote("");
                    }}
                    disabled={pending}
                  >
                    {localAccounts.length > 1 ? <option value="">Hesap seçin</option> : null}
                    {localAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName} — {account.accountName}
                        {account.iban ? ` (${account.iban})` : ""}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    disabled={pending}
                    onClick={() => setShowAccountForm((v) => !v)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Yeni Hesap Ekle
                  </Button>
                </div>
              </FormField>
              {accountMatchNote ? (
                <p className="text-sm text-emerald-700">{accountMatchNote}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">
              Ekstre hareketlerinin hangi hesaba ait olduğunu takip edebilmek ve mükerrer
              aktarımları önlemek için bir hesap tanımlayın.
            </div>
          )}

          {(showAccountForm || localAccounts.length === 0) && (
            <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
              <p className="text-sm font-medium text-ink">Yerel banka hesabı</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Banka adı *" htmlFor="new-bank-name">
                  <Input
                    id="new-bank-name"
                    value={accountForm.bankName}
                    onChange={(e) =>
                      setAccountForm((prev) => ({ ...prev, bankName: e.target.value }))
                    }
                    placeholder="Örn. Ziraat Bankası"
                  />
                </FormField>
                <FormField label="Hesap adı *" htmlFor="new-account-name">
                  <Input
                    id="new-account-name"
                    value={accountForm.accountName}
                    onChange={(e) =>
                      setAccountForm((prev) => ({ ...prev, accountName: e.target.value }))
                    }
                    placeholder="Site Aidat Hesabı"
                  />
                </FormField>
                <FormField label="IBAN" htmlFor="new-iban" hint="Varsa girin; zorunlu değil.">
                  <Input
                    id="new-iban"
                    value={accountForm.iban}
                    onChange={(e) => setAccountForm((prev) => ({ ...prev, iban: e.target.value }))}
                    placeholder="TR…"
                  />
                </FormField>
                <FormField label="Hesap numarası" htmlFor="new-acc-no">
                  <Input
                    id="new-acc-no"
                    value={accountForm.accountNumber}
                    onChange={(e) =>
                      setAccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                    }
                  />
                </FormField>
              </div>
              <p className="text-xs text-muted">Para birimi: TRY</p>
              <Button type="button" disabled={pending} onClick={() => void handleSaveAccount()}>
                {pending ? "Kaydediliyor…" : "Hesabı Kaydet ve Devam Et"}
              </Button>
            </div>
          )}

          {fileName ? (
            <div className="space-y-1 rounded-lg border border-line bg-canvas/50 px-3 py-2 text-sm text-muted">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
                <span className="truncate font-medium text-ink">{fileName}</span>
              </div>
              <p className="text-xs">
                Tür: {fileKind === "pdf" ? "PDF" : fileKind === "spreadsheet" ? "Excel/CSV" : "—"}
                {fileSizeLabel ? ` · ${fileSizeLabel}` : ""}
                {pdfMeta ? ` · ${pdfMeta.pageCount} sayfa` : ""}
                {pdfMeta ? ` · ${pdfMeta.adapterName}` : ""}
              </p>
              {accountHints?.iban ? (
                <p className="text-xs">Dosya IBAN: {maskIbanDisplay(accountHints.iban)}</p>
              ) : null}
              {accountMatchNote ? <p className="text-xs text-accent">{accountMatchNote}</p> : null}
            </div>
          ) : null}

          {pdfPasswordRequired ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-950">Bu PDF parola ile korunuyor.</p>
              <FormField label="PDF parolası" htmlFor="pdf-password">
                <Input
                  id="pdf-password"
                  type="password"
                  autoComplete="off"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="Parola"
                />
              </FormField>
              <p className="text-xs text-amber-900">
                Parola kaydedilmez, loglanmaz ve işlem bitince bellekten temizlenir.
              </p>
              <Button
                type="button"
                disabled={pending || !pdfPassword || !pendingFile}
                onClick={() => {
                  const file = pendingFile;
                  const pwd = pdfPassword;
                  setPdfPassword("");
                  void handleFile(file, pwd);
                }}
              >
                Dosyayı Aç
              </Button>
            </div>
          ) : null}

          {parseProgress ? (
            <p className="text-sm text-muted" aria-live="polite">
              Ekstre okunuyor… {parseProgress}
            </p>
          ) : null}

          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center hover:border-accent/50",
              (!bankAccountId || pending) && "pointer-events-none opacity-50",
            )}
          >
            <Upload className="size-8 text-accent" aria-hidden />
            <div>
              <p className="font-medium text-ink">Banka ekstrenizi buraya bırakın</p>
              <p className="mt-1 text-sm text-muted">XLSX, XLS, CSV veya PDF</p>
              <p className="mt-1 text-xs text-muted">
                En fazla 10 MB · PDF en fazla 100 sayfa · Excel/CSV en fazla 5.000 hareket
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              disabled={!bankAccountId || pending}
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}

      {step > 1 ? (
        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
          <span className="truncate">
            Hesap:{" "}
            {localAccounts.find((a) => a.id === bankAccountId)?.accountName ?? bankAccountId}
          </span>
          {fileName ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{fileName}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {fileKind === "pdf" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              PDF hareketleri otomatik ayrıştırıldı. Kolon eşleme Excel/CSV içindir; şüpheli
              satırları bir sonraki adımda kontrol edin.
            </div>
          ) : null}
          {templates.length > 0 ? (
            <FormField label="Kayıtlı şablon" htmlFor="stmt-template">
              <Select
                id="stmt-template"
                defaultValue=""
                onChange={(e) => {
                  const template = templates.find((item) => item.id === e.target.value);
                  if (!template) return;
                  reapplyMapping({
                    date: template.mapping.date,
                    description: template.mapping.description,
                    amount: template.mapping.amount,
                    debit: template.mapping.debit,
                    credit: template.mapping.credit,
                    reference: template.mapping.reference,
                    balance: template.mapping.balance,
                    valueDate: template.mapping.valueDate,
                  });
                }}
              >
                <option value="">Şablon seç…</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {mappingFields.map((field) => (
              <FormField key={field.key} label={field.label} htmlFor={`map-${field.key}`}>
                <Select
                  id={`map-${field.key}`}
                  value={(mapping[field.key] as string | null | undefined) ?? ""}
                  onChange={(e) =>
                    reapplyMapping({
                      ...mapping,
                      [field.key]: e.target.value || null,
                    })
                  }
                >
                  <option value="">—</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </FormField>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <FormField label="Şablon adı" htmlFor="tpl-name" className="min-w-[160px] flex-1">
              <Input
                id="tpl-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Örn. Garanti Ekstre"
              />
            </FormField>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !templateName.trim() || !isMappingComplete(mapping)}
              onClick={() => void saveTemplate()}
            >
              Şablonu Kaydet
            </Button>
          </div>

          <p className="text-sm text-muted">
            Algılanan satır: {parsedRows.length}
            {parseErrors.length ? ` · Hatalı: ${parseErrors.length}` : ""}
          </p>
        </div>
      ) : null}

      {step === 3 || step === 4 ? (
        <div className="space-y-4">
          {pdfMeta?.warnings?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-medium">PDF uyarıları</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {pdfMeta.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              {pdfMeta.balanceChainOk === false ? (
                <p className="mt-2 font-medium">
                  Ekstre bakiyesiyle ayrıştırılan hareketler arasında fark var.
                </p>
              ) : null}
            </div>
          ) : null}

          {previewSummary ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Toplam", previewSummary.totalRows],
                ["Gelen", previewSummary.creditCount],
                ["Giden", previewSummary.debitCount],
                ["Mükerrer", previewSummary.duplicateCount],
                ["Otomatik", previewSummary.autoMatchedCount],
                ["Eşleşmeyen", previewSummary.unmatchedCount],
                ["Geçersiz", previewSummary.invalidCount],
                ["İçe aktarılacak", formatMoney(previewSummary.importableCreditTotal)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Tarih</TH>
                    <TH>Açıklama</TH>
                    <TH className="text-right">Gelen</TH>
                    <TH className="text-right">Giden</TH>
                    <TH>Sayfa</TH>
                    <TH>Eşleşme</TH>
                    <TH>Durum</TH>
                    {step === 3 ? <TH>İşlem</TH> : <TH>Dağıtım</TH>}
                  </TR>
                </THead>
                <TBody>
                  {previewRows.map((row) => {
                    const override = overrides[row.rowIndex];
                    const aptId = override?.apartmentId ?? row.match?.apartmentId;
                    const apt = apartments.find((item) => item.id === aptId);
                    return (
                      <TR
                        key={row.rowIndex}
                        className={cn(
                          skipped[row.rowIndex] && "opacity-40",
                          parseErrors.some((e) => e.rowNumber === row.sourceRowNumber) &&
                            "bg-amber-50/80",
                        )}
                      >
                        <TD className="whitespace-nowrap text-sm">{row.transactionDate}</TD>
                        <TD className="max-w-[220px] truncate text-sm" title={row.description}>
                          {row.description}
                        </TD>
                        <TD className="text-right text-sm">
                          {row.direction === "CREDIT" ? formatMoney(row.amount) : "—"}
                        </TD>
                        <TD className="text-right text-sm">
                          {row.direction === "DEBIT" ? formatMoney(row.amount) : "—"}
                        </TD>
                        <TD className="text-sm text-muted">
                          {row.sourcePage != null ? String(row.sourcePage) : "—"}
                        </TD>
                        <TD className="text-sm">
                          {apt ? `${apt.building.name} / ${apt.number}` : row.message}
                        </TD>
                        <TD className="text-sm">{previewStatusLabel(row)}</TD>
                        {step === 3 ? (
                          <TD>
                            <div className="flex flex-wrap gap-1">
                              {row.direction === "CREDIT" && row.previewStatus !== "DUPLICATE" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openMatch(row)}
                                >
                                  Eşleştir
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setSkipped((prev) => ({
                                    ...prev,
                                    [row.rowIndex]: !prev[row.rowIndex],
                                  }))
                                }
                              >
                                {skipped[row.rowIndex] ? "Dahil Et" : "Atla"}
                              </Button>
                            </div>
                          </TD>
                        ) : (
                          <TD className="text-xs text-muted">
                            {row.allocationPreview?.length
                              ? row.allocationPreview
                                  .map((item) => `${item.label}: ${formatMoney(item.amount)}`)
                                  .join(" · ")
                              : override
                                ? "Manuel eşleşme — onayda dağıtılır"
                                : "—"}
                          </TD>
                        )}
                      </TR>
                    );
                  })}
                </TBody>
              </TableElement>
            </Table>
          </div>

          {parseErrors.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Parse uyarıları</p>
              <ul className="mt-1 list-disc pl-5">
                {parseErrors.slice(0, 8).map((item) => (
                  <li key={`${item.rowNumber}-${item.message}`}>
                    Satır {item.rowNumber}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {matchRowIndex != null ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-ink">Manuel eşleştirme</p>
          <FormField label="Daire" htmlFor="match-apt">
            <ApartmentCombobox
              id="match-apt"
              apartments={apartments}
              value={matchApartmentId}
              onChange={setMatchApartmentId}
            />
          </FormField>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={matchCreateRule}
              onChange={(e) => setMatchCreateRule(e.target.checked)}
            />
            <span>Bu göndericiyi sonraki işlemlerde aynı daireyle eşleştir</span>
          </label>
          {matchCreateRule ? (
            <FormField label="Kural anahtarı (açıklama parçası)" htmlFor="match-pat">
              <Input
                id="match-pat"
                value={matchPattern}
                onChange={(e) => setMatchPattern(e.target.value)}
                placeholder="Örn. ad soyad veya kısa ibare"
              />
            </FormField>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" onClick={saveMatch} disabled={!matchApartmentId}>
              Kaydet
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMatchRowIndex(null)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : null}
    </FormModal>
  );
}
