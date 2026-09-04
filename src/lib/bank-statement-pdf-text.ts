/**
 * Pure PDF statement text → normalized bank rows.
 * No pdfjs dependency — unit-testable from Node.
 */

export type PdfTxDirection = "CREDIT" | "DEBIT";

export type PdfExtractedTransaction = {
  transactionDate: string;
  valueDate?: string | null;
  direction: PdfTxDirection;
  amount: number;
  description: string;
  referenceNo?: string | null;
  balanceAfter?: number | null;
  currency?: string | null;
  sourcePage: number;
  sourceRow: number;
  rawFingerprintMaterial: string;
  warnings: string[];
  confidence: "high" | "medium" | "low";
};

export type PdfAccountHints = {
  iban: string | null;
  bankName: string | null;
  accountNumber: string | null;
  branchName: string | null;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type PdfPageText = {
  pageNumber: number;
  lines: string[];
};

export type BankPdfAdapter = {
  id: string;
  name: string;
  /** True only when format cues are strong enough — never claim untested banks. */
  canHandle: (pages: PdfPageText[], fullText: string) => boolean;
  extractAccountInfo: (pages: PdfPageText[], fullText: string) => PdfAccountHints;
  extractTransactions: (pages: PdfPageText[]) => PdfExtractedTransaction[];
  warnings: (pages: PdfPageText[], txs: PdfExtractedTransaction[]) => string[];
};

const IBAN_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/i;

const SKIP_LINE =
  /(devreden\s*bakiye|onceki\s*bakiye|önceki\s*bakiye|donem\s*toplam|dönem\s*toplam|genel\s*toplam|toplam\s*alacak|toplam\s*borc|toplam\s*borç|sayfa\s*\d+|page\s*\d+|ekstre\s*ozeti|ekstre\s*özeti|hesap\s*ozeti|hesap\s*özeti|ara\s*toplam|subtotal|opening\s*balance|closing\s*balance|brought\s*forward|carried\s*forward)/i;

const HEADER_LINE =
  /^(tarih|islem\s*tarihi|işlem\s*tarihi|aciklama|açıklama|borc|borç|alacak|bakiye|valor|valör|tutar|date|description|debit|credit|balance)\b/i;

function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function parseStatementDate(text: string): string | null {
  const t = text.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!dmy) return null;
  const day = dmy[1]!.padStart(2, "0");
  const month = dmy[2]!.padStart(2, "0");
  let year = dmy[3]!;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

/** Supports TR `2.500,00` and EN `2,500.00` plus optional +/− / (). */
export function parseStatementMoney(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;
  text = text.replace(/[₺$€£]|TL|TRY|USD|EUR/gi, "").trim();
  const neg = /^\(.*\)$/.test(text) || /^[−-]/.test(text) || /-$/.test(text);
  text = text.replace(/[()]/g, "").replace(/^[−+-]/, "").replace(/-$/, "").trim();
  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      // 2.500,00
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      // 2,500.00
      text = text.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = text.split(",");
    if (parts[1] && parts[1].length <= 2) text = parts[0]!.replace(/\./g, "") + "." + parts[1];
    else text = text.replace(/,/g, "");
  } else if (hasDot && !hasComma) {
    const parts = text.split(".");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3 && parts.length === 2 && !parts[1].match(/^\d{1,2}$/))) {
      // thousand separators only
      if (parts.every((p, i) => (i === parts.length - 1 ? true : p.length <= 3))) {
        const last = parts[parts.length - 1]!;
        if (last.length === 3 && parts.length >= 2) text = parts.join("");
      }
    }
  }

  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  const signed = neg ? -Math.abs(num) : num;
  return Number(signed.toFixed(2));
}

const MONEY_TOKEN =
  /[+]?\(?-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\)?(?:\s*(?:TL|TRY|₺))?|[+]?\(?-?\d+[.,]\d{1,2}\)?(?:\s*(?:TL|TRY|₺))?|[+]?\(?-?\d{4,}(?:[.,]\d{1,2})?\)?(?:\s*(?:TL|TRY|₺))?/g;

function extractMoneyTokens(line: string): string[] {
  const matches = line.match(MONEY_TOKEN) ?? [];
  return matches.filter((m) => /\d/.test(m) && !/^\d{1,3}$/.test(m.trim()));
}

function isSkipLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (SKIP_LINE.test(t)) return true;
  if (HEADER_LINE.test(t) && extractMoneyTokens(t).length === 0) return true;
  if (/^[-_=*]{3,}$/.test(t)) return true;
  return false;
}

function detectHintsFromText(fullText: string): PdfAccountHints {
  const compact = fullText.replace(/\s+/g, " ");
  const ibanMatch = compact.match(IBAN_REGEX);
  const iban = ibanMatch ? ibanMatch[1]!.replace(/\s+/g, "").toUpperCase() : null;

  let bankName: string | null = null;
  if (/iş\s*bank|is\s*bank/i.test(fullText)) bankName = "İş Bankası";
  else if (/garanti|bbva/i.test(fullText)) bankName = "Garanti BBVA";
  else if (/yap[ıi]\s*kredi/i.test(fullText)) bankName = "Yapı Kredi";
  else if (/ziraat/i.test(fullText)) bankName = "Ziraat Bankası";
  else if (/akbank/i.test(fullText)) bankName = "Akbank";
  else if (/qnb|finansbank/i.test(fullText)) bankName = "QNB";
  else if (/denizbank/i.test(fullText)) bankName = "Denizbank";
  else if (/halkbank/i.test(fullText)) bankName = "Halkbank";
  else if (/vak[ıi]f/i.test(fullText)) bankName = "VakıfBank";

  const accountMatch = fullText.match(/hesap\s*(?:no|numaras[ıi])\s*[:.]?\s*([0-9\s\-]+)/i);
  const branchMatch = fullText.match(/şube|sube\s*[:.]?\s*([^\n]+)/i);
  const currency = /\bTRY\b|\bTL\b/i.test(fullText) ? "TRY" : null;

  const period =
    fullText.match(/(\d{2}[./]\d{2}[./]\d{4})\s*[-–]\s*(\d{2}[./]\d{2}[./]\d{4})/) ??
    fullText.match(/(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/);

  return {
    iban,
    bankName,
    accountNumber: accountMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    branchName: branchMatch?.[1]?.trim().slice(0, 80) ?? null,
    currency,
    periodStart: period ? parseStatementDate(period[1]!) : null,
    periodEnd: period ? parseStatementDate(period[2]!) : null,
  };
}

function classifyAmountPair(
  tokens: string[],
): { amount: number; direction: PdfTxDirection; balanceAfter: number | null; warnings: string[] } | null {
  const parsed = tokens
    .map((t) => ({ raw: t, value: parseStatementMoney(t) }))
    .filter((t): t is { raw: string; value: number } => t.value != null && t.value !== 0);

  if (parsed.length === 0) return null;

  // Common layouts:
  // 1) signed amount [balance]
  // 2) debit credit [balance]
  // 3) amount only
  if (parsed.length === 1) {
    const v = parsed[0]!.value;
    return {
      amount: Math.abs(v),
      direction: v < 0 ? "DEBIT" : "CREDIT",
      balanceAfter: null,
      warnings: v > 0 ? ["Tutar yönü doğrulanmalı"] : [],
    };
  }

  if (parsed.length === 2) {
    const a = parsed[0]!.value;
    const b = parsed[1]!.value;
    // debit/credit mutually exclusive
    if (a < 0 && b > 0) {
      return { amount: Math.abs(a), direction: "DEBIT", balanceAfter: b, warnings: [] };
    }
    if (b < 0 && a > 0) {
      return { amount: Math.abs(a), direction: "CREDIT", balanceAfter: Math.abs(b), warnings: [] };
    }
    // amount + balance (both positive): prefer first as amount if second looks like running balance
    return {
      amount: Math.abs(a),
      direction: a < 0 ? "DEBIT" : "CREDIT",
      balanceAfter: Math.abs(b),
      warnings: a > 0 ? ["Tutar yönü doğrulanmalı"] : [],
    };
  }

  // 3+: debit, credit, balance
  const debit = parsed.find((p) => p.value < 0);
  const credits = parsed.filter((p) => p.value > 0);
  if (debit && credits.length >= 1) {
    const creditCand = credits[0]!;
    const balance = credits[1]?.value ?? null;
    // If both debit and credit absolute present as positives in separate cols, detect zeros already filtered
    return {
      amount: Math.abs(debit.value),
      direction: "DEBIT",
      balanceAfter: balance,
      warnings: [],
    };
  }

  const amount = Math.abs(parsed[0]!.value);
  const balanceAfter = Math.abs(parsed[parsed.length - 1]!.value);
  return {
    amount,
    direction: parsed[0]!.value < 0 ? "DEBIT" : "CREDIT",
    balanceAfter,
    warnings: ["Tutar yönü doğrulanmalı"],
  };
}

function lineHasExplicitDebitCredit(line: string): { debit?: number; credit?: number } | null {
  const folded = foldTr(line);
  // "Borç 100" / "Alacak 200" style rarely in same line as date — handled via column-ish tokens
  const debitM = line.match(/(?:^|\s)(?:borc|borç|debit|giden)\s*[:=]?\s*([0-9.,()\-+]+)/i);
  const creditM = line.match(/(?:^|\s)(?:alacak|credit|gelen)\s*[:=]?\s*([0-9.,()\-+]+)/i);
  if (!debitM && !creditM) return null;
  return {
    debit: debitM ? parseStatementMoney(debitM[1]!) ?? undefined : undefined,
    credit: creditM ? parseStatementMoney(creditM[1]!) ?? undefined : undefined,
  };
}

function parseTransactionLine(
  line: string,
  pageNumber: number,
  sourceRow: number,
): PdfExtractedTransaction | null {
  const trimmed = line.trim();
  if (isSkipLine(trimmed)) return null;

  const dateMatch = trimmed.match(/^(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const transactionDate = parseStatementDate(dateMatch[1]!);
  if (!transactionDate) return null;

  let rest = trimmed.slice(dateMatch[0].length).trim();
  let valueDate: string | null = null;
  const valueMatch = rest.match(/^(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if (valueMatch) {
    valueDate = parseStatementDate(valueMatch[1]!);
    rest = rest.slice(valueMatch[0].length).trim();
  }

  const labeled = lineHasExplicitDebitCredit(trimmed);
  const tokens = extractMoneyTokens(rest);
  // Remove leading date leftovers already consumed
  let amount: number | null = null;
  let direction: PdfTxDirection | null = null;
  let balanceAfter: number | null = null;
  const warnings: string[] = [];

  if (labeled && (labeled.debit || labeled.credit)) {
    if (labeled.credit && !labeled.debit) {
      amount = Math.abs(labeled.credit);
      direction = "CREDIT";
    } else if (labeled.debit && !labeled.credit) {
      amount = Math.abs(labeled.debit);
      direction = "DEBIT";
    } else if (labeled.debit && labeled.credit) {
      return null;
    }
  } else {
    const classified = classifyAmountPair(tokens);
    if (!classified) return null;
    amount = classified.amount;
    direction = classified.direction;
    balanceAfter = classified.balanceAfter;
    warnings.push(...classified.warnings);
  }

  if (amount == null || direction == null || amount <= 0) return null;

  // Description = rest without trailing money tokens
  let description = rest;
  for (const token of [...tokens].reverse()) {
    const idx = description.lastIndexOf(token);
    if (idx >= 0) description = (description.slice(0, idx) + description.slice(idx + token.length)).trim();
  }
  description = description.replace(/\s+/g, " ").replace(/[|]+/g, " ").trim();
  if (!description) {
    description = "Belirtilmemiş işlem";
    warnings.push("Açıklama düşük güvenle okundu");
  }

  const refMatch = description.match(/\b(?:ref|referans|fis|fiş|dekont)\s*[#:=-]?\s*([A-Z0-9\-/]{4,})\b/i);
  const referenceNo = refMatch?.[1] ?? null;

  return {
    transactionDate,
    valueDate,
    direction,
    amount,
    description,
    referenceNo,
    balanceAfter,
    currency: /TL|TRY|₺/i.test(trimmed) ? "TRY" : null,
    sourcePage: pageNumber,
    sourceRow,
    rawFingerprintMaterial: trimmed,
    warnings,
    confidence: warnings.length ? "medium" : "high",
  };
}

export function extractTransactionsFromPdfPages(pages: PdfPageText[]): {
  transactions: PdfExtractedTransaction[];
  skippedLines: number;
  multiLineMerged: number;
} {
  const transactions: PdfExtractedTransaction[] = [];
  let skippedLines = 0;
  let multiLineMerged = 0;
  let sourceRow = 0;

  for (const page of pages) {
    for (const rawLine of page.lines) {
      sourceRow += 1;
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (!line) continue;
      if (isSkipLine(line)) {
        skippedLines += 1;
        continue;
      }

      const parsed = parseTransactionLine(line, page.pageNumber, sourceRow);
      if (parsed) {
        transactions.push(parsed);
        continue;
      }

      // Continuation line (no leading date) → append to previous description
      const hasDate = /^(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/.test(line);
      if (!hasDate && transactions.length > 0 && !extractMoneyTokens(line).length) {
        const prev = transactions[transactions.length - 1]!;
        prev.description = `${prev.description} ${line}`.replace(/\s+/g, " ").trim();
        prev.warnings = [...new Set([...prev.warnings, "Açıklama birden fazla satırdan birleştirildi"])];
        prev.confidence = prev.confidence === "high" ? "medium" : prev.confidence;
        prev.rawFingerprintMaterial = `${prev.rawFingerprintMaterial}\n${line}`;
        multiLineMerged += 1;
        continue;
      }

      skippedLines += 1;
    }
  }

  return { transactions, skippedLines, multiLineMerged };
}

export function validateBalanceChain(
  txs: PdfExtractedTransaction[],
): { ok: boolean | null; message: string | null } {
  const withBal = txs.filter((t) => t.balanceAfter != null);
  if (withBal.length < 2) {
    return { ok: null, message: "Bakiye kolonu bulunamadığı için zincir doğrulaması yapılamadı." };
  }
  for (let i = 1; i < withBal.length; i += 1) {
    const prev = withBal[i - 1]!;
    const cur = withBal[i]!;
    const expected =
      Number(prev.balanceAfter) +
      (cur.direction === "CREDIT" ? cur.amount : -cur.amount);
    if (Math.abs(expected - Number(cur.balanceAfter)) > 0.05) {
      return {
        ok: false,
        message: "Ekstre bakiyesiyle ayrıştırılan hareketler arasında fark var.",
      };
    }
  }
  return { ok: true, message: null };
}

/** Generic adapter — works for many TR/EN tabular text statements; not bank-certified. */
export const genericPdfAdapter: BankPdfAdapter = {
  id: "generic",
  name: "Genel metin ekstrisi",
  canHandle: () => true,
  extractAccountInfo: (_pages, fullText) => detectHintsFromText(fullText),
  extractTransactions: (pages) => extractTransactionsFromPdfPages(pages).transactions,
  warnings: (_pages, txs) => {
    const notes: string[] = [];
    if (txs.some((t) => t.warnings.includes("Tutar yönü doğrulanmalı"))) {
      notes.push("Bazı satırlarda tutar yönü doğrulanmalı.");
    }
    if (txs.some((t) => t.warnings.includes("Açıklama birden fazla satırdan birleştirildi"))) {
      notes.push("Bazı açıklamalar birden fazla satırdan birleştirildi.");
    }
    return notes;
  },
};

export const PDF_ADAPTERS: BankPdfAdapter[] = [genericPdfAdapter];

export function selectPdfAdapter(pages: PdfPageText[], fullText: string): BankPdfAdapter {
  for (const adapter of PDF_ADAPTERS) {
    if (adapter.id === "generic") continue;
    if (adapter.canHandle(pages, fullText)) return adapter;
  }
  return genericPdfAdapter;
}

export function extractPdfStatement(pages: PdfPageText[]): {
  adapter: BankPdfAdapter;
  accountHints: PdfAccountHints;
  transactions: PdfExtractedTransaction[];
  warnings: string[];
  skippedLines: number;
  multiLineMerged: number;
  balanceChain: { ok: boolean | null; message: string | null };
} {
  const fullText = pages.map((p) => p.lines.join("\n")).join("\n");
  const adapter = selectPdfAdapter(pages, fullText);
  const accountHints = adapter.extractAccountInfo(pages, fullText);
  const { transactions, skippedLines, multiLineMerged } = extractTransactionsFromPdfPages(pages);
  // Prefer adapter extract if it specializes later; generic uses same helper.
  let txs = adapter.id === "generic" ? transactions : adapter.extractTransactions(pages);
  const MAX_TX = 5000;
  if (txs.length > MAX_TX) {
    txs = txs.slice(0, MAX_TX);
  }
  const balanceChain = validateBalanceChain(txs);

  // Bakiye zinciri tutuyorsa veya ekstride hem gelen hem giden (işaretli tutar) varsa
  // yön ayrımı güvenilirdir — her pozitif tutarı "şüpheli yön" sayma.
  const hasCredit = txs.some((t) => t.direction === "CREDIT");
  const hasDebit = txs.some((t) => t.direction === "DEBIT");
  const directionReliable =
    balanceChain.ok === true || (balanceChain.ok !== false && hasCredit && hasDebit);

  if (directionReliable) {
    for (const tx of txs) {
      const before = tx.warnings.length;
      tx.warnings = tx.warnings.filter((w) => w !== "Tutar yönü doğrulanmalı");
      if (before > 0 && tx.warnings.length === 0 && tx.confidence !== "low") {
        tx.confidence = "high";
      }
    }
  }

  const warnings = [
    ...adapter.warnings(pages, txs),
    ...(adapter.id === "generic"
      ? ["PDF genel metin ayrıştırıcı ile okundu; bankaya özel doğrulama yapılmadı."]
      : []),
  ];
  if (balanceChain.message) warnings.push(balanceChain.message);
  return {
    adapter,
    accountHints,
    transactions: txs,
    warnings,
    skippedLines,
    multiLineMerged,
    balanceChain,
  };
}
