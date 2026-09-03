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
};

export class PdfStatementError extends Error {
  code:
    | "INVALID"
    | "ENCRYPTED"
    | "SCANNED"
    | "NO_TRANSACTIONS"
    | "TOO_MANY_PAGES"
    | "PASSWORD_REQUIRED";

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

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

async function extractPages(
  data: Uint8Array,
  password: string | undefined,
  onProgress?: PdfParseOptions["onProgress"],
): Promise<{ pageCount: number; pages: PdfPageText[]; kind: PdfKind }> {
  onProgress?.("opening");
  const pdfjs = await loadPdfJs();

  let doc;
  try {
    const task = pdfjs.getDocument({
      data: data.slice(),
      password: password || undefined,
      useSystemFonts: true,
      isEvalSupported: false,
    });
    doc = await task.promise;
  } catch (error) {
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
    const pageCount = doc.numPages;
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
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{ str?: string; transform?: number[] }>;

      // Group by approximate Y to rebuild lines
      const buckets = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of items) {
        const text = String(item.str ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const y = item.transform ? Math.round(item.transform[5] ?? 0) : 0;
        const x = item.transform ? Number(item.transform[4] ?? 0) : 0;
        const key = y;
        const list = buckets.get(key) ?? [];
        list.push({ x, text });
        buckets.set(key, list);
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
    await doc.destroy().catch(() => undefined);
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
  options.onProgress?.("opening");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (!isPdfMagic(bytes)) {
    throw new PdfStatementError("INVALID", "PDF dosya imzası doğrulanamadı.");
  }

  // Fast encrypted hint before worker (may still need password for open)
  if (pdfLooksEncrypted(bytes) && !options.password) {
    throw new PdfStatementError("PASSWORD_REQUIRED", "Bu PDF parola ile korunuyor.");
  }

  const { pageCount, pages, kind } = await extractPages(bytes, options.password, options.onProgress);

  if (kind === "scanned") {
    throw new PdfStatementError(
      "SCANNED",
      "Bu PDF taranmış görüntülerden oluşuyor. Hareketleri okuyabilmek için metin tanıma işlemi gerekiyor. Bankanızdan metin tabanlı PDF, Excel veya CSV ekstre indirebilirsiniz.",
    );
  }

  options.onProgress?.("detecting_transactions");
  const extracted = extractPdfStatement(pages);

  if (extracted.transactions.length === 0) {
    throw new PdfStatementError(
      "NO_TRANSACTIONS",
      "PDF metni okundu ancak hareket sütunları otomatik belirlenemedi. Ekstrede geçerli banka hareketi bulunamadı.",
    );
  }

  options.onProgress?.("preparing_preview");

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
