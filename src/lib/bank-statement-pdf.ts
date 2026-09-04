/**
 * Client-side PDF bank statement loading via pdf.js.
 * Text extraction only — no external OCR/AI uploads.
 */

import { isPdfMagic, pdfLooksEncrypted } from "@/lib/bank-statement-pdf-detect";
import type { DetectedAccountHints, ParsedStatementRow, ParseResult, ColumnMapping } from "@/lib/bank-statement-parse";
import {
  extractPdfStatement,
  type PdfPageText,
} from "@/lib/bank-statement-pdf-text";

export type PdfKind = "text" | "scanned" | "encrypted" | "invalid";

export type PdfParseProgress =
  | "opening"
  | "extracting_text"
  | "detecting_transactions"
  | "preparing_preview";

export type PdfParseOptions = {
  password?: string;
  onProgress?: (phase: PdfParseProgress, detail?: string) => void;
  signal?: AbortSignal;
  /** Default 45s for small text PDFs. */
  timeoutMs?: number;
};

export class PdfStatementError extends Error {
  code:
    | "INVALID"
    | "ENCRYPTED"
    | "SCANNED"
    | "NO_TRANSACTIONS"
    | "TOO_MANY_PAGES"
    | "PASSWORD_REQUIRED"
    | "TIMEOUT"
    | "ABORTED"
    | "WORKER_FAILED"
    | "PARSE_FAILED";

  constructor(
    code: PdfStatementError["code"],
    message: string,
  ) {
    super(message);
    this.name = "PdfStatementError";
    this.code = code;
  }
}

const MAX_PDF_PAGES = 100;
const MIN_TEXT_CHARS_PER_PAGE = 40;
const DEFAULT_PDF_TIMEOUT_MS = 45_000;

function emptyMapping(): ColumnMapping {
  return {
    date: "Tarih",
    description: "Açıklama",
    amount: null,
    debit: "Borç",
    credit: "Alacak",
    reference: "Referans",
    balance: "Bakiye",
    valueDate: "Valör",
    currency: null,
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new PdfStatementError("ABORTED", "İşlem iptal edildi.");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PdfStatementError("ABORTED", "İşlem iptal edildi."));
      return;
    }
    const timer = setTimeout(() => {
      reject(
        new PdfStatementError(
          "TIMEOUT",
          "PDF beklenen sürede işlenemedi. Dosyayı yeniden deneyin veya farklı formatta yükleyin.",
        ),
      );
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PdfStatementError("ABORTED", "İşlem iptal edildi."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    const workerSrc = "/pdf.worker.min.mjs";
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    try {
      const probe = await fetch(workerSrc, { method: "HEAD", cache: "force-cache" });
      if (!probe.ok) {
        throw new PdfStatementError(
          "WORKER_FAILED",
          "PDF işlenirken bir hata oluştu. Dosyayı yeniden deneyin.",
        );
      }
    } catch (error) {
      if (error instanceof PdfStatementError) throw error;
      throw new PdfStatementError(
        "WORKER_FAILED",
        "PDF işlenirken bir hata oluştu. Dosyayı yeniden deneyin.",
      );
    }
  }
  return pdfjs;
}

async function extractPages(
  data: Uint8Array,
  password: string | undefined,
  onProgress?: PdfParseOptions["onProgress"],
  signal?: AbortSignal,
): Promise<{ pageCount: number; pages: PdfPageText[]; kind: PdfKind }> {
  onProgress?.("opening");
  throwIfAborted(signal);
  const pdfjs = await loadPdfJs();
  throwIfAborted(signal);

  let doc: { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>; destroy: () => Promise<void> } | null = null;
  try {
    const task = pdfjs.getDocument({
      data: data.slice(),
      password: password || undefined,
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const abortOpen = () => {
      void task.destroy().catch(() => undefined);
    };
    signal?.addEventListener("abort", abortOpen, { once: true });
    try {
      doc = await task.promise;
    } finally {
      signal?.removeEventListener("abort", abortOpen);
    }
  } catch (error) {
    if (error instanceof PdfStatementError) throw error;
    throwIfAborted(signal);
    const name = error && typeof error === "object" && "name" in error ? String((error as { name: string }).name) : "";
    const message = error instanceof Error ? error.message : "";
    if (
      name === "PasswordException" ||
      /password/i.test(message) ||
      /encrypted/i.test(message)
    ) {
      throw new PdfStatementError(
        password ? "ENCRYPTED" : "PASSWORD_REQUIRED",
        password
          ? "Bu PDF parola ile korunuyor. Parola hatalı veya dosya açılamadı."
          : "Bu PDF parola ile korunuyor.",
      );
    }
    throw new PdfStatementError("INVALID", "PDF açılamadı veya dosya bozuk.");
  }

  try {
    throwIfAborted(signal);
    const pageCount = doc!.numPages;
    if (pageCount > MAX_PDF_PAGES) {
      throw new PdfStatementError(
        "TOO_MANY_PAGES",
        `PDF en fazla ${MAX_PDF_PAGES} sayfa olabilir.`,
      );
    }

    onProgress?.("extracting_text", `0/${pageCount}`);
    const pages: PdfPageText[] = [];
    let totalChars = 0;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      throwIfAborted(signal);
      const page = await doc!.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{ str?: string; transform?: number[] }>;

      const buckets = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of items) {
        const text = String(item.str ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const y = item.transform ? Math.round(item.transform[5] ?? 0) : 0;
        const x = item.transform ? Number(item.transform[4] ?? 0) : 0;
        const list = buckets.get(y) ?? [];
        list.push({ x, text });
        buckets.set(y, list);
      }

      const lines = [...buckets.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, parts]) =>
          parts
            .sort((a, b) => a.x - b.x)
            .map((p) => p.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean);

      const pageText = lines.join("\n");
      totalChars += pageText.replace(/\s+/g, "").length;
      pages.push({ pageNumber, lines });
      onProgress?.("extracting_text", `${pageNumber}/${pageCount}`);
    }

    const avgChars = pageCount > 0 ? totalChars / pageCount : 0;
    if (avgChars < MIN_TEXT_CHARS_PER_PAGE) {
      return { pageCount, pages, kind: "scanned" };
    }
    return { pageCount, pages, kind: "text" };
  } finally {
    await doc?.destroy().catch(() => undefined);
  }
}

export async function parseBankStatementPdf(
  file: File,
  options: PdfParseOptions = {},
): Promise<ParseResult & {
  sourceKind: "pdf";
  pdfMeta: {
    pageCount: number;
    kind: PdfKind;
    warnings: string[];
    balanceChainOk: boolean | null;
    adapterId: string;
    adapterName: string;
    skippedLines: number;
    multiLineMerged: number;
  };
}> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PDF_TIMEOUT_MS;
  return withTimeout(parseBankStatementPdfInner(file, options), timeoutMs, options.signal);
}

async function parseBankStatementPdfInner(
  file: File,
  options: PdfParseOptions,
): Promise<ParseResult & {
  sourceKind: "pdf";
  pdfMeta: {
    pageCount: number;
    kind: PdfKind;
    warnings: string[];
    balanceChainOk: boolean | null;
    adapterId: string;
    adapterName: string;
    skippedLines: number;
    multiLineMerged: number;
  };
}> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const stage = (name: string, extra?: Record<string, unknown>) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    console.info(
      JSON.stringify({
        scope: "bank_statement_pdf",
        stage: name,
        elapsedMs: Math.round(now - startedAt),
        fileType: "pdf",
        fileSize: file.size,
        ...extra,
      }),
    );
  };

  options.onProgress?.("opening");
  stage("file_received");
  throwIfAborted(options.signal);

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  stage("file_validated", { byteLength: bytes.byteLength });

  if (!isPdfMagic(bytes)) {
    throw new PdfStatementError("INVALID", "PDF dosya imzası doğrulanamadı.");
  }

  if (pdfLooksEncrypted(bytes) && !options.password) {
    throw new PdfStatementError("PASSWORD_REQUIRED", "Bu PDF parola ile korunuyor.");
  }

  const { pageCount, pages, kind } = await extractPages(
    bytes,
    options.password,
    options.onProgress,
    options.signal,
  );
  stage("text_extracted", { pageCount, kind });

  if (kind === "scanned") {
    throw new PdfStatementError(
      "SCANNED",
      "PDF’de okunabilir metin bulunamadı. Dosya taranmış olabilir.",
    );
  }

  options.onProgress?.("detecting_transactions");
  throwIfAborted(options.signal);
  const extracted = extractPdfStatement(pages);
  stage("transactions_detected", {
    transactionCount: extracted.transactions.length,
    skippedLines: extracted.skippedLines,
  });

  if (extracted.transactions.length === 0) {
    throw new PdfStatementError(
      "NO_TRANSACTIONS",
      "PDF okundu ancak banka hareketleri belirlenemedi.",
    );
  }

  options.onProgress?.("preparing_preview");
  throwIfAborted(options.signal);

  const rows: ParsedStatementRow[] = extracted.transactions.map((tx, index) => ({
    transactionDate: tx.transactionDate,
    valueDate: tx.valueDate ?? null,
    direction: tx.direction,
    amount: tx.amount,
    description: tx.description,
    referenceNo: tx.referenceNo ?? null,
    balanceAfter: tx.balanceAfter ?? null,
    sourceRowNumber: tx.sourceRow || index + 1,
    sourcePage: tx.sourcePage,
    warnings: tx.warnings,
    confidence: tx.confidence,
  }));

  const accountHints: DetectedAccountHints = {
    iban: extracted.accountHints.iban,
    bankName: extracted.accountHints.bankName,
    accountNumber: extracted.accountHints.accountNumber,
    branchName: extracted.accountHints.branchName,
    currency: extracted.accountHints.currency,
  };

  const headers = ["Tarih", "Valör", "Açıklama", "Borç", "Alacak", "Bakiye", "Referans", "Sayfa"];
  const mapping = emptyMapping();
  stage("preview_prepared", { rowCount: rows.length });

  return {
    sourceKind: "pdf",
    headers,
    headerRowIndex: 0,
    mapping,
    mappingComplete: true,
    rows,
    errors: rows
      .filter((r) => (r.warnings?.length ?? 0) > 0)
      .map((r) => ({
        rowNumber: r.sourceRowNumber,
        message: r.warnings!.join(" · "),
      })),
    sheetName: `PDF (${pageCount} sayfa)`,
    accountHints,
    pdfMeta: {
      pageCount,
      kind: "text",
      warnings: extracted.warnings,
      balanceChainOk: extracted.balanceChain.ok,
      adapterId: extracted.adapter.id,
      adapterName: extracted.adapter.name,
      skippedLines: extracted.skippedLines,
      multiLineMerged: extracted.multiLineMerged,
    },
  };
}
