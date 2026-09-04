/**
 * Client-side bank statement Excel/CSV/PDF parsing.
 * No financial persistence — only structured rows for preview/commit APIs.
 */

import * as XLSX from "xlsx";
import { isPdfMagic } from "@/lib/bank-statement-pdf-detect";

export type ColumnField =
  | "date"
  | "valueDate"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "reference"
  | "balance"
  | "currency";

export type ColumnMapping = {
  date: string;
  description: string;
  amount?: string | null;
  debit?: string | null;
  credit?: string | null;
  reference?: string | null;
  balance?: string | null;
  valueDate?: string | null;
  currency?: string | null;
};

export type ParsedStatementRow = {
  transactionDate: string;
  valueDate?: string | null;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  description: string;
  referenceNo?: string | null;
  balanceAfter?: number | null;
  sourceRowNumber: number;
  sourcePage?: number | null;
  warnings?: string[];
  confidence?: "high" | "medium" | "low";
};

export type ParseResult = {
  headers: string[];
  headerRowIndex: number;
  mapping: ColumnMapping;
  mappingComplete: boolean;
  rows: ParsedStatementRow[];
  errors: Array<{ rowNumber: number; message: string }>;
  sheetName: string;
  accountHints: DetectedAccountHints;
  sourceKind?: "spreadsheet" | "pdf";
  pdfMeta?: {
    pageCount: number;
    kind: "text" | "scanned" | "encrypted" | "invalid";
    warnings: string[];
    balanceChainOk: boolean | null;
    adapterId: string;
    adapterName: string;
    skippedLines: number;
    multiLineMerged: number;
  };
};

export type DetectedAccountHints = {
  iban: string | null;
  bankName: string | null;
  accountNumber: string | null;
  branchName: string | null;
  currency: string | null;
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;
const HEADER_SCAN_LIMIT = 50;

const TURKISH_CHAR_MAP: Record<string, string> = {
  İ: "i",
  I: "i",
  Ş: "s",
  Ğ: "g",
  Ü: "u",
  Ö: "o",
  Ç: "c",
  ı: "i",
  ş: "s",
  ğ: "g",
  ü: "u",
  ö: "o",
  ç: "c",
};

const FIELD_CANDIDATES: Record<ColumnField, string[]> = {
  date: ["islem tarihi", "işlem tarihi", "tarih", "date", "dekont tarihi"],
  valueDate: ["valor", "valör", "value date", "valor tarihi"],
  description: [
    "aciklama",
    "açıklama",
    "description",
    "islem aciklamasi",
    "işlem açıklaması",
    "ekstredeki aciklama",
    "ekstredeki açıklama",
  ],
  amount: ["islem tutari", "işlem tutarı", "tutar", "amount", "borc/alacak", "borç/alacak"],
  debit: ["borc", "borç", "debit", "giden"],
  credit: ["alacak", "credit", "gelen"],
  reference: [
    "fis no",
    "fiş no",
    "fisno",
    "referans no",
    "referans",
    "belge no",
    "islem no",
    "işlem no",
    "dekont no",
    "voucher",
  ],
  balance: ["bakiye", "balance", "hesap bakiyesi"],
  currency: ["para birimi", "currency", "doviz", "döviz"],
};

function foldTurkish(value: string): string {
  let text = value;
  for (const [from, to] of Object.entries(TURKISH_CHAR_MAP)) {
    text = text.split(from).join(to);
  }
  return text;
}

export function normalizeHeader(value: unknown): string {
  return foldTurkish(
    String(value ?? "")
      .replace(/\uFEFF/g, "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " "),
  );
}

function findHeaderMatch(headers: string[], candidates: string[]): string | null {
  for (const header of headers) {
    const norm = normalizeHeader(header);
    if (!norm) continue;
    if (candidates.some((c) => norm === c || norm.includes(c))) return header;
  }
  return null;
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const date = findHeaderMatch(headers, FIELD_CANDIDATES.date) ?? "";
  const description = findHeaderMatch(headers, FIELD_CANDIDATES.description) ?? "";
  const debit = findHeaderMatch(headers, FIELD_CANDIDATES.debit);
  const credit = findHeaderMatch(headers, FIELD_CANDIDATES.credit);
  let amount = findHeaderMatch(headers, FIELD_CANDIDATES.amount);

  // Prefer separate debit/credit when both exist; avoid using "alacak" as amount.
  if (debit && credit) {
    amount = null;
  } else if (amount && (amount === debit || amount === credit)) {
    amount = null;
  }

  return {
    date,
    description,
    amount: amount ?? null,
    debit: debit ?? null,
    credit: credit ?? null,
    reference: findHeaderMatch(headers, FIELD_CANDIDATES.reference),
    balance: findHeaderMatch(headers, FIELD_CANDIDATES.balance),
    valueDate: findHeaderMatch(headers, FIELD_CANDIDATES.valueDate),
    currency: findHeaderMatch(headers, FIELD_CANDIDATES.currency),
  };
}

export function isMappingComplete(mapping: ColumnMapping): boolean {
  if (!mapping.date || !mapping.description) return false;
  return Boolean(mapping.amount || mapping.debit || mapping.credit);
}

function excelSerialToIso(serial: number): string | null {
  // Excel epoch 1899-12-30
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function parseCellDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToIso(value);
  }
  const text = String(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, "0");
    const month = dmy[2]!.padStart(2, "0");
    let year = dmy[3]!;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

export function parseMoneyCell(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(2));
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/[₺TL\s]/gi, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const neg = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[()]/g, "").replace(/^-/, "");
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  const signed = neg ? -Math.abs(num) : num;
  return Number(signed.toFixed(2));
}

function cellOf(row: Record<string, unknown>, header: string | null | undefined): unknown {
  if (!header) return null;
  return row[header];
}

export function applyMappingToMatrix(
  matrix: unknown[][],
  headerRowIndex: number,
  headers: string[],
  mapping: ColumnMapping,
): { rows: ParsedStatementRow[]; errors: Array<{ rowNumber: number; message: string }> } {
  const rows: ParsedStatementRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      errors.push({ rowNumber: i + 1, message: `En fazla ${MAX_ROWS} satır desteklenir.` });
      break;
    }
    const raw = matrix[i] ?? [];
    if (!raw.some((cell) => cell != null && String(cell).trim() !== "")) continue;

    const record: Record<string, unknown> = {};
    headers.forEach((header, col) => {
      record[header] = raw[col];
    });

    const dateIso = parseCellDate(cellOf(record, mapping.date));
    const description = String(cellOf(record, mapping.description) ?? "").trim();
    if (!dateIso && !description) continue;

    if (!dateIso) {
      errors.push({ rowNumber: i + 1, message: "Geçersiz veya eksik işlem tarihi." });
      continue;
    }
    if (!description) {
      errors.push({ rowNumber: i + 1, message: "Açıklama boş." });
      continue;
    }

    let amount: number | null = null;
    let direction: "CREDIT" | "DEBIT" | null = null;

    if (mapping.debit || mapping.credit) {
      const debit = parseMoneyCell(cellOf(record, mapping.debit));
      const credit = parseMoneyCell(cellOf(record, mapping.credit));
      const debitAbs = debit != null && debit !== 0 ? Math.abs(debit) : null;
      const creditAbs = credit != null && credit !== 0 ? Math.abs(credit) : null;
      if (creditAbs && !debitAbs) {
        amount = creditAbs;
        direction = "CREDIT";
      } else if (debitAbs && !creditAbs) {
        amount = debitAbs;
        direction = "DEBIT";
      } else if (creditAbs && debitAbs) {
        errors.push({ rowNumber: i + 1, message: "Hem borç hem alacak dolu." });
        continue;
      } else {
        errors.push({ rowNumber: i + 1, message: "Borç/alacak tutarı yok." });
        continue;
      }
    } else {
      const signed = parseMoneyCell(cellOf(record, mapping.amount));
      if (signed == null || signed === 0) {
        errors.push({ rowNumber: i + 1, message: "Tutar okunamadı." });
        continue;
      }
      amount = Math.abs(signed);
      direction = signed < 0 ? "DEBIT" : "CREDIT";
    }

    const valueDate = mapping.valueDate
      ? parseCellDate(cellOf(record, mapping.valueDate))
      : null;
    const referenceRaw = cellOf(record, mapping.reference);
    const referenceNo =
      referenceRaw != null && String(referenceRaw).trim()
        ? String(referenceRaw).trim()
        : null;
    const balanceAfter = mapping.balance
      ? parseMoneyCell(cellOf(record, mapping.balance))
      : null;

    rows.push({
      transactionDate: dateIso,
      valueDate,
      direction: direction!,
      amount: amount!,
      description,
      referenceNo,
      balanceAfter,
      sourceRowNumber: i + 1,
    });
  }

  return { rows, errors };
}

function looksLikeSpreadsheet(bytes: Uint8Array): boolean {
  // ZIP (xlsx) PK
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  // OLE compound (xls) D0 CF 11 E0
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return true;
  }
  // CSV / text (not PDF)
  if (isPdfMagic(bytes)) return false;
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 200));
  if (sample.includes(";") || sample.includes(",") || sample.includes("\t")) return true;
  return false;
}

function detectFileKind(bytes: Uint8Array, fileName: string): "pdf" | "spreadsheet" | "unknown" {
  if (isPdfMagic(bytes)) return "pdf";
  if (looksLikeSpreadsheet(bytes)) return "spreadsheet";
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "unknown";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "unknown";
  return "unknown";
}

const IBAN_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/i;

/** Üst bilgi satırlarından IBAN / banka adı gibi hesap ipuçlarını çıkarır. */
export function detectAccountHints(matrix: unknown[][], headerRowIndex: number): DetectedAccountHints {
  const scanRows = matrix.slice(0, Math.max(headerRowIndex, 0) + 3);
  const text = scanRows
    .flat()
    .map((cell) => String(cell ?? "").trim())
    .filter(Boolean)
    .join("\n");

  const ibanMatch = text.replace(/\s+/g, " ").match(IBAN_REGEX);
  const iban = ibanMatch ? ibanMatch[1]!.replace(/\s+/g, "").toUpperCase() : null;

  let bankName: string | null = null;
  let accountNumber: string | null = null;
  let branchName: string | null = null;
  let currency: string | null = null;

  for (const row of scanRows) {
    const cells = (row ?? []).map((c) => String(c ?? "").trim());
    for (let i = 0; i < cells.length; i += 1) {
      const label = normalizeHeader(cells[i]);
      const value = cells[i + 1]?.trim() || "";
      if (!value) continue;
      if (/^(banka|banka adi|bank name)$/.test(label) && !bankName) bankName = value;
      if (/^(hesap no|hesap numarasi|account number)$/.test(label) && !accountNumber) {
        accountNumber = value;
      }
      if (/^(sube|şube|branch)$/.test(label) && !branchName) branchName = value;
      if (/^(para birimi|currency|doviz)$/.test(label) && !currency) currency = value;
    }
  }

  if (!currency && /\bTRY\b|\bTL\b/i.test(text)) currency = "TRY";

  return { iban, bankName, accountNumber, branchName, currency };
}

export function normalizeIban(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, "").toUpperCase();
  return clean || null;
}

/** Maskeli veya tam IBAN ile dosyadaki IBAN eşleşmesini güvenli kontrol eder. */
export function ibanMatchesStored(
  fileIban: string,
  storedMaskedOrFull: string | null | undefined,
  storedFull?: string | null,
): boolean {
  const file = normalizeIban(fileIban);
  if (!file || file.length < 15) return false;
  const full = normalizeIban(storedFull ?? undefined);
  if (full) return full === file;
  const stored = normalizeIban(storedMaskedOrFull);
  if (!stored) return false;
  if (!stored.includes("*")) return stored === file;
  const prefix = stored.slice(0, 4);
  const suffix = stored.slice(-4);
  return file.startsWith(prefix) && file.endsWith(suffix);
}

export function maskIbanDisplay(iban: string | null | undefined): string {
  const clean = normalizeIban(iban);
  if (!clean) return "—";
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

export async function parseBankStatementFile(
  file: File,
  options?: {
    password?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    onProgress?: (
      phase: "opening" | "extracting_text" | "detecting_transactions" | "preparing_preview",
      detail?: string,
    ) => void;
  },
): Promise<ParseResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Dosya izin verilen boyutu aşıyor. En fazla 10 MB yükleyebilirsiniz.");
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const kind = detectFileKind(bytes, file.name);

  if (kind === "pdf") {
    const { parseBankStatementPdf, PdfStatementError } = await import("@/lib/bank-statement-pdf");
    try {
      // Re-wrap bytes as File so PDF parser does not re-read a consumed stream oddly;
      // File from Blob is fine and keeps name for diagnostics.
      const pdfFile = new File([bytes], file.name, { type: file.type || "application/pdf" });
      return await parseBankStatementPdf(pdfFile, options);
    } catch (error) {
      if (error instanceof PdfStatementError) throw error;
      throw new Error(error instanceof Error ? error.message : "PDF okunamadı.");
    }
  }

  if (kind !== "spreadsheet") {
    throw new Error("Dosya içeriği XLSX, XLS, CSV veya PDF olarak doğrulanamadı.");
  }

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Dosyada sayfa bulunamadı.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Sayfa okunamadı.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  }) as unknown[][];

  if (matrix.length === 0) throw new Error("Dosya boş.");

  let headerRowIndex = 0;
  let headers: string[] = [];
  let mapping = detectColumnMapping([]);

  for (let r = 0; r < Math.min(HEADER_SCAN_LIMIT, matrix.length); r += 1) {
    const candidate = (matrix[r] ?? []).map((cell, idx) => {
      const text = String(cell ?? "").trim();
      return text || `Kolon ${idx + 1}`;
    });
    const detected = detectColumnMapping(candidate);
    if (isMappingComplete(detected)) {
      headerRowIndex = r;
      headers = candidate;
      mapping = detected;
      break;
    }
    if (r === 0) {
      headers = candidate;
      mapping = detected;
    }
  }

  // Deduplicate empty-looking headers
  headers = headers.map((h, i) => h || `Kolon ${i + 1}`);

  const { rows, errors } = isMappingComplete(mapping)
    ? applyMappingToMatrix(matrix, headerRowIndex, headers, mapping)
    : { rows: [], errors: [] };

  return {
    sourceKind: "spreadsheet",
    headers,
    headerRowIndex,
    mapping,
    mappingComplete: isMappingComplete(mapping),
    rows,
    errors,
    sheetName,
    accountHints: detectAccountHints(matrix, headerRowIndex),
  };
}

export function reparseWithMapping(
  matrix: unknown[][],
  headerRowIndex: number,
  headers: string[],
  mapping: ColumnMapping,
): { rows: ParsedStatementRow[]; errors: Array<{ rowNumber: number; message: string }> } {
  return applyMappingToMatrix(matrix, headerRowIndex, headers, mapping);
}

export async function readStatementMatrix(file: File): Promise<{
  matrix: unknown[][];
  sheetName: string;
}> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Dosya izin verilen boyutu aşıyor. En fazla 10 MB yükleyebilirsiniz.");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (isPdfMagic(bytes)) {
    throw new Error("PDF için kolon matrisi kullanılmaz; hareketler metinden çıkarılır.");
  }
  if (!looksLikeSpreadsheet(bytes)) {
    throw new Error("Dosya içeriği Excel/CSV olarak doğrulanamadı.");
  }
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Dosyada sayfa bulunamadı.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Sayfa okunamadı.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  }) as unknown[][];
  return { matrix, sheetName };
}
