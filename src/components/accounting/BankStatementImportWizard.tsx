"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileSpreadsheet, Plus, Upload } from "lucide-react";
import {
  StatementReviewWorkspace,
  countUnresolvedDirection,
  emptyRowWork,
  type RowWorkState,
} from "@/components/accounting/StatementReviewWorkspace";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { Apartment } from "@/lib/apartments-api";
import { listApartments } from "@/lib/apartments-api";
import { isGenericMatchKey } from "@/lib/bank-statement-counterparty";
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
import { normalizeApiError } from "@/lib/api-error";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

type Step = 1 | 2 | 3 | 4;

type AuthCtx = { token: string; tenantId: string; siteId?: string | null };

type WizardProps = {
  open: boolean;
  auth: AuthCtx;
  accounts: BankAccount[];
  apartments: Apartment[];
  onClose: () => void;
  onDone: (result?: {
    createdCount: number;
    processedPayments: number;
    duplicateSkipped: number;
    matchedWithoutPayment: number;
  }) => void;
  /** Hesap oluşturulunca üst listeyi yenile (sihirbaz kapanmaz). */
  onAccountsChanged?: () => void | Promise<void>;
};

const STEPS = [
  { id: 1 as const, label: "Hesap ve Dosya" },
  { id: 2 as const, label: "Kolonları Eşle" },
  { id: 3 as const, label: "Hareketleri Kontrol Et" },
  { id: 4 as const, label: "Onayla ve Aktar" },
];

function defaultAccountId(list: BankAccount[]): string {
  if (list.length === 1) return list[0]!.id;
  return "";
}

export function BankStatementImportWizard({
  open,
  auth,
  accounts,
  apartments: apartmentsProp,
  onClose,
  onDone,
  onAccountsChanged,
}: WizardProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [pending, setPending] = useState(false);
  /** DEFER = kaydet, tahsilatı sonra onayla (varsayılan). COLLECT_NOW = onaylananları şimdi tahsilata aktar. */
  const [paymentTiming, setPaymentTiming] = useState<"DEFER" | "COLLECT_NOW">("DEFER");
  const [localAccounts, setLocalAccounts] = useState<BankAccount[]>(accounts);
  const [apartments, setApartments] = useState<Apartment[]>(apartmentsProp);
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
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
  const [rowWork, setRowWork] = useState<Record<number, RowWorkState>>({});
  const [templates, setTemplates] = useState<BankColumnTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestGenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function abortActiveWork() {
    abortRef.current?.abort();
    abortRef.current = null;
    requestGenRef.current += 1;
  }

  const reset = useCallback(() => {
    abortActiveWork();
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
    setRowWork({});
    setTemplateName("");
    setError("");
    setPending(false);
    setPaymentTiming("DEFER");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [accounts]);

  useEffect(() => {
    if (!open) {
      abortActiveWork();
      return;
    }
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

  // Manuel eşleştirme combobox: aktif sitedeki daireleri taze yükle (boş aramada tüm daireler).
  useEffect(() => {
    if (!open || !auth) return;
    setApartments(apartmentsProp);
    let cancelled = false;
    setApartmentsLoading(true);
    void listApartments(auth, { status: "aktif", perPage: 200 })
      .then((result) => {
        if (!cancelled) setApartments(result.items);
      })
      .catch(() => {
        if (!cancelled && apartmentsProp.length > 0) setApartments(apartmentsProp);
      })
      .finally(() => {
        if (!cancelled) setApartmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth, apartmentsProp]);

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

    abortActiveWork();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestGen = requestGenRef.current;
    const previewTimeout = window.setTimeout(() => {
      if (!controller.signal.aborted) controller.abort();
    }, 60_000);

    setError("");
    setPending(true);
    setPendingFile(file);
    setParseProgress("Dosya doğrulanıyor…");
    try {
      const parsed = await parseBankStatementFile(file, {
        password,
        signal: controller.signal,
        timeoutMs: 45_000,
        onProgress: (phase: PdfParseProgress, detail) => {
          if (requestGen !== requestGenRef.current) return;
          if (phase === "opening") setParseProgress("PDF açılıyor…");
          else if (phase === "extracting_text")
            setParseProgress(detail ? `${detail} sayfa okunuyor…` : "Metin çıkarılıyor…");
          else if (phase === "detecting_transactions")
            setParseProgress("Hareketler belirleniyor…");
          else if (phase === "preparing_preview") setParseProgress("Önizleme hazırlanıyor…");
        },
      });

      if (requestGen !== requestGenRef.current || controller.signal.aborted) return;

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
        setParseProgress("Tablo okunuyor…");
        const matrixResult = await readStatementMatrix(file);
        if (requestGen !== requestGenRef.current || controller.signal.aborted) return;
        setMatrix(matrixResult.matrix);
        if (!parsed.accountHints) {
          setAccountHints(detectAccountHints(matrixResult.matrix, parsed.headerRowIndex));
        }
      }

      let selectedId = bankAccountId;
      const hints = parsed.accountHints;
      if (hints) {
        setParseProgress("Hesap eşleştiriliyor…");
        const matched = await tryMatchAccountFromHints(hints, localAccounts);
        if (requestGen !== requestGenRef.current || controller.signal.aborted) return;
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
        setParseProgress("Önizleme hazırlanıyor…");
        await runPreview(parsed.rows, selectedId, {
          signal: controller.signal,
          requestGen,
          clearProgressOnSuccess: true,
          nested: true,
        });
      } else if (parsed.sourceKind === "pdf") {
        setError("PDF okundu ancak banka hareketleri belirlenemedi.");
        setStep(1);
      } else {
        setStep(2);
      }
    } catch (err) {
      if (requestGen !== requestGenRef.current) return;
      if (
        (err instanceof PdfStatementError && (err.code === "ABORTED" || err.code === "TIMEOUT")) ||
        (err instanceof ApiError && err.code === "ABORTED") ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        const timedOut =
          (err instanceof PdfStatementError && err.code === "TIMEOUT") ||
          controller.signal.aborted;
        setError(
          timedOut
            ? "PDF beklenen sürede işlenemedi. Dosyayı yeniden deneyin veya farklı formatta yükleyin."
            : "İşlem iptal edildi.",
        );
        setParseProgress("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
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
      if (err instanceof PdfStatementError) {
        const messages: Partial<Record<PdfStatementError["code"], string>> = {
          SCANNED: "PDF’de okunabilir metin bulunamadı. Dosya taranmış olabilir.",
          NO_TRANSACTIONS: "PDF okundu ancak banka hareketleri belirlenemedi.",
          TIMEOUT: "PDF beklenen sürede işlenemedi.",
          WORKER_FAILED: "PDF işlenirken bir hata oluştu. Dosyayı yeniden deneyin.",
          PARSE_FAILED: "PDF işlenirken bir hata oluştu. Dosyayı yeniden deneyin.",
        };
        setError(messages[err.code] ?? err.message);
        setParseProgress("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setError(err instanceof Error ? err.message : "Dosya okunamadı.");
      setParseProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      window.clearTimeout(previewTimeout);
      if (requestGen === requestGenRef.current) {
        setPending(false);
        // Keep progress only while still pending; clear when this generation finishes.
        setParseProgress("");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  async function runPreview(
    rows: ParsedStatementRow[] = parsedRows,
    accountId = bankAccountId,
    options?: {
      signal?: AbortSignal;
      requestGen?: number;
      clearProgressOnSuccess?: boolean;
      nested?: boolean;
    },
  ) {
    if (!auth || !accountId) {
      setError("Banka hesabı seçin.");
      return;
    }
    if (rows.length === 0) {
      setError("Önizlenecek satır yok.");
      return;
    }

    const nested = Boolean(options?.nested);
    const ownsController = !options?.signal;
    const controller = options?.signal
      ? null
      : (() => {
          abortActiveWork();
          const next = new AbortController();
          abortRef.current = next;
          return next;
        })();
    const signal = options?.signal ?? controller!.signal;
    const requestGen = options?.requestGen ?? requestGenRef.current;
    const timeoutId = ownsController
      ? window.setTimeout(() => {
          if (!signal.aborted) (controller as AbortController).abort();
        }, 60_000)
      : null;

    if (!nested) {
      setPending(true);
      setParseProgress("Önizleme hazırlanıyor…");
    }
    setError("");
    try {
      const result = await previewBankStatementImport(
        auth,
        {
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
        },
        { signal },
      );
      if (requestGen !== requestGenRef.current || signal.aborted) return;
      setPreviewRows(result.rows);
      setRowWork(
        Object.fromEntries(
          result.rows.map((row) => {
            const base = emptyRowWork();
            if (row.previewStatus === "DUPLICATE" || row.previewStatus === "INVALID") {
              base.decision = "EXCLUDE";
            } else if (
              row.direction === "DEBIT" ||
              row.previewStatus === "DEBIT_SKIP_PAYMENT"
            ) {
              base.decision = "BANK_ONLY";
            }
            return [row.rowIndex, base];
          }),
        ),
      );
      setPreviewSummary(result.summary);
      setStep(3);
      if (options?.clearProgressOnSuccess) setParseProgress("");
      showToast({
        title: `Ekstre başarıyla okundu. ${result.rows.length} hareket bulundu.`,
        tone: "info",
      });
    } catch (err) {
      if (requestGen !== requestGenRef.current) return;
      if (
        (err instanceof ApiError && err.code === "ABORTED") ||
        (err instanceof DOMException && err.name === "AbortError") ||
        signal.aborted
      ) {
        setError(
          ownsController
            ? "Önizleme beklenen sürede tamamlanamadı veya iptal edildi."
            : "İşlem iptal edildi.",
        );
        return;
      }
      const normalized = normalizeApiError(err, "Önizleme başarısız.");
      setError(normalized.userMessage);
    } finally {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (!nested && requestGen === requestGenRef.current) {
        setPending(false);
        setParseProgress("");
      }
    }
  }

  function handleCancelOrClose() {
    abortActiveWork();
    setPending(false);
    setParseProgress("");
    onClose();
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

  function patchRowWork(rowIndex: number, patch: Partial<RowWorkState>) {
    setRowWork((prev) => ({
      ...prev,
      [rowIndex]: { ...(prev[rowIndex] ?? emptyRowWork()), ...patch },
    }));
  }

  function patchRowWorkBatch(indexes: number[], patch: Partial<RowWorkState>) {
    setRowWork((prev) => {
      const next = { ...prev };
      for (const rowIndex of indexes) {
        const current = next[rowIndex] ?? emptyRowWork();
        const row = previewRows.find((item) => item.rowIndex === rowIndex);
        const merged = { ...current, ...patch };
        // Yüksek güven onayında daireyi öneriden al
        if (patch.decision === "COLLECT" && !merged.apartmentId && row?.match?.apartmentId) {
          merged.apartmentId = row.match.apartmentId;
          merged.personId = row.match.personId;
        }
        next[rowIndex] = merged;
      }
      return next;
    });
  }

  const directionSuspectIds = useMemo(() => {
    const set = new Set<number>();
    const isDirectionWarning = (text: string) =>
      text.toLocaleLowerCase("tr-TR").includes("tutar yönü");
    for (const row of previewRows) {
      const parsed = parsedRows.find((item) => item.sourceRowNumber === row.sourceRowNumber);
      if (parsed?.warnings?.some((w) => isDirectionWarning(w))) {
        set.add(row.rowIndex);
      }
    }
    for (const err of parseErrors) {
      if (!isDirectionWarning(err.message)) continue;
      const row = previewRows.find((item) => item.sourceRowNumber === err.rowNumber);
      if (row) set.add(row.rowIndex);
    }
    return set;
  }, [previewRows, parsedRows, parseErrors]);

  const unresolvedDirectionCount = countUnresolvedDirection(
    previewRows,
    rowWork,
    directionSuspectIds,
  );

  const commitPreviewCounts = useMemo(() => {
    let collect = 0;
    let collectAmount = 0;
    for (const row of previewRows) {
      const w = rowWork[row.rowIndex] ?? emptyRowWork();
      const dir = w.directionOverride ?? row.direction;
      if (w.decision === "COLLECT" && dir === "CREDIT") {
        collect += 1;
        collectAmount += row.amount;
      }
    }
    return { collect, collectAmount };
  }, [previewRows, rowWork]);

  async function handleCommit() {
    if (!auth || !bankAccountId || previewRows.length === 0) return;
    if (unresolvedDirectionCount > 0) {
      setError(
        `${unresolvedDirectionCount} satırda tutar yönü doğrulanmadan içe aktarım yapılamaz.`,
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      const rows = previewRows.map((row) => {
        const w = rowWork[row.rowIndex] ?? emptyRowWork();
        const direction = w.directionOverride ?? row.direction;
        const decision =
          w.decision ??
          (direction === "DEBIT" || row.previewStatus === "DEBIT_SKIP_PAYMENT"
            ? "BANK_ONLY"
            : null);
        const matchedApartmentId =
          decision === "COLLECT"
            ? (w.apartmentId ?? row.match?.apartmentId ?? null)
            : null;
        const matchedPersonId =
          decision === "COLLECT" ? (w.personId ?? row.match?.personId ?? null) : null;
        const skip =
          decision === "EXCLUDE" ||
          row.previewStatus === "DUPLICATE" ||
          row.previewStatus === "INVALID";
        const processPayment =
          paymentTiming === "COLLECT_NOW" &&
          decision === "COLLECT" &&
          direction === "CREDIT" &&
          Boolean(matchedApartmentId) &&
          !skip;
        const ruleText = w.ruleText.trim();
        const createRule =
          Boolean(w.createRule && processPayment && matchedApartmentId && ruleText) &&
          !isGenericMatchKey(ruleText);

        return {
          transactionDate: row.transactionDate,
          valueDate: row.valueDate,
          direction,
          amount: row.amount,
          description: row.description,
          referenceNo: row.referenceNo,
          balanceAfter: row.balanceAfter,
          sourceRowNumber: row.sourceRowNumber,
          sourcePage: row.sourcePage ?? null,
          fingerprint: row.fingerprint,
          matchedApartmentId,
          matchedPersonId,
          processPayment,
          createRule,
          containsText: createRule ? ruleText : undefined,
          skip,
        };
      });

      const result = await commitBankStatementImport(auth, { bankAccountId, rows });
      onDone(result);
      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err, "Aktarım başarısız.");
      setError(normalized.userMessage);
    } finally {
      setPending(false);
    }
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
        handleCancelOrClose();
      }}
      title="Ekstre İçe Aktar"
      description="Banka ekstresini yükleyin, eşleştirin ve onay sonrası tahsilata aktarın. Onay öncesi ödeme oluşmaz."
      size={step >= 3 ? "workspace" : "xl"}
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
          <div className="flex flex-wrap items-center gap-2">
            {pending ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  abortActiveWork();
                  setPending(false);
                  setParseProgress("");
                  setError("İşlem iptal edildi.");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                İşlemi İptal Et
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={handleCancelOrClose}>
                İptal
              </Button>
            )}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">
                  Tahsilat: {commitPreviewCounts.collect} /{" "}
                  {formatMoney(commitPreviewCounts.collectAmount)}
                  {unresolvedDirectionCount > 0
                    ? ` · Şüpheli yön: ${unresolvedDirectionCount}`
                    : ""}
                </span>
                <Button
                  type="button"
                  disabled={pending || unresolvedDirectionCount > 0}
                  onClick={() => setStep(4)}
                >
                  Onaya Geç
                </Button>
              </div>
            ) : null}
            {step === 4 ? (
              <Button
                type="button"
                disabled={pending || unresolvedDirectionCount > 0}
                onClick={() => void handleCommit()}
              >
                {pending
                  ? "Aktarılıyor…"
                  : `${
                      previewRows.filter((row) => {
                        const w = rowWork[row.rowIndex] ?? emptyRowWork();
                        return (
                          w.decision !== "EXCLUDE" &&
                          row.previewStatus !== "DUPLICATE" &&
                          row.previewStatus !== "INVALID"
                        );
                      }).length
                    } Hareketi İçe Aktar`}
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
              {parseProgress}
            </p>
          ) : null}

          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center hover:border-accent/50",
              !bankAccountId && "pointer-events-none opacity-50",
              pending && "opacity-70",
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
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              disabled={!bankAccountId || pending}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                void handleFile(next);
              }}
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
        <div className="space-y-3">
          {step === 4 ? (
            <div className="space-y-2">
              <AlertBanner tone="warning" title="Son onay">
                Son onay verilmeden tahsilat oluşmaz. Aşağıdaki seçeneğe göre hareketler kaydedilir.
              </AlertBanner>
              <div className="rounded-xl border border-line bg-canvas px-3 py-3 space-y-2">
                <p className="text-sm font-medium text-ink">Tahsilat zamanlaması</p>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="paymentTiming"
                    checked={paymentTiming === "DEFER"}
                    onChange={() => setPaymentTiming("DEFER")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Hareketleri kaydet, tahsilatları daha sonra onaylayacağım</span>
                    <span className="block text-xs text-muted">
                      Varsayılan güvenli seçenek. Eşleşmeler onay bekleyen olarak kalır; Payment oluşmaz.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="paymentTiming"
                    checked={paymentTiming === "COLLECT_NOW"}
                    onChange={() => setPaymentTiming("COLLECT_NOW")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Onayladığım eşleşmeleri şimdi tahsilata aktar</span>
                    <span className="block text-xs text-muted">
                      Kararı &quot;Tahsilata aktar&quot; olan gelen hareketler için Payment oluşturulur.
                    </span>
                  </span>
                </label>
              </div>
              {(previewSummary?.unmatchedCount ?? 0) > 0 ? (
                <AlertBanner tone="info" title="Eşleşmeyen hareketler">
                  {previewSummary!.unmatchedCount} hareket henüz daireyle eşleştirilmedi. Bunlar
                  banka kaydı olarak aktarılabilir; tahsilat oluşmaz.
                </AlertBanner>
              ) : null}
              {(pdfMeta?.warnings?.length ?? 0) > 0 ? (
                <AlertBanner tone="warning" title="Ayrıştırma uyarıları">
                  {pdfMeta!.warnings.length} satırda ayrıştırma uyarısı bulunuyor.
                </AlertBanner>
              ) : null}
            </div>
          ) : null}
          <StatementReviewWorkspace
            step={step}
            rows={previewRows}
            summary={previewSummary}
            apartments={apartments}
            apartmentsLoading={apartmentsLoading}
            work={rowWork}
            onWorkChange={patchRowWork}
            onWorkBatch={patchRowWorkBatch}
            warnings={[
              ...(pdfMeta?.warnings ?? []),
              ...(pdfMeta?.balanceChainOk === false
                ? ["Ekstre bakiyesiyle ayrıştırılan hareketler arasında fark var."]
                : []),
            ]}
            directionSuspectIds={directionSuspectIds}
            parseErrorCount={parseErrors.length}
          />
        </div>
      ) : null}
    </FormModal>
  );
}
