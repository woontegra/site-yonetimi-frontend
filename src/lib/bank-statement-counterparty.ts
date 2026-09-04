/**
 * Best-effort counterparty extraction from TR bank statement descriptions.
 * Never invents names — returns null when pattern is unreliable.
 *
 * İş Bankası FAST örnekleri:
 * "-00:29:22 Sistem FA FAST Serdar Topal*Ağustos daire 6*FAST"
 */

export type StatementChannel = "EFT" | "HAVALE" | "FAST" | "POS" | "FATURA" | "DIGER" | null;

export type CounterpartyInfo = {
  counterpartyName: string | null;
  /** CREDIT → gönderen, DEBIT → alıcı when detectable */
  counterpartyRole: "sender" | "receiver" | null;
  channel: StatementChannel;
  counterpartyIbanMasked: string | null;
  referenceHint: string | null;
  summaryLine: string;
  /** Normalize edilmiş eşleştirme alanları (ham açıklama korunur). */
  counterpartyNameCandidate: string | null;
  apartmentNumberCandidate: string | null;
  paymentNote: string | null;
  transactionChannel: StatementChannel;
};

const IBAN_RE = /\b(TR\d{2}[A-Z0-9]{0,4})\s*[A-Z0-9*\s]{0,24}([A-Z0-9]{4})\b/i;
const FULL_IBAN_RE = /\b(TR\d{2}[A-Z0-9]{22})\b/i;

const CHANNEL_PATTERNS: Array<{ channel: Exclude<StatementChannel, null>; re: RegExp }> = [
  { channel: "FAST", re: /\bfast\b/i },
  { channel: "EFT", re: /\beft\b|\be9\b/i },
  { channel: "HAVALE", re: /\bhavale\b/i },
  { channel: "POS", re: /\bpos\b|\bkredi\s*kart/i },
  { channel: "FATURA", re: /\bfatura\b|\bfaturas/i },
];

const NOISE_WORD =
  /^(sistem|system|fa|fast|eft|havale|gelen|giden|sube|şube|pos|iban|ref|referans|fis|fiş|dekont|e9)$/i;

const MONTH_OR_NOTE =
  /^(aidat|aidati|odeme|ödeme|ref|referans|fis|fiş|daire|blok|eylul|ekim|kasim|aralik|ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|ağustos|tl|try|ve|ile)$/i;

function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 10) return `${clean.slice(0, 4)}…`;
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

function detectChannel(description: string): StatementChannel {
  for (const item of CHANNEL_PATTERNS) {
    if (item.re.test(description)) return item.channel;
  }
  return null;
}

function extractIbanMasked(description: string): string | null {
  const full = description.match(FULL_IBAN_RE);
  if (full?.[1]) return maskIban(full[1]);
  const partial = description.match(IBAN_RE);
  if (partial?.[1] && partial[2]) {
    return `${partial[1].toUpperCase()}…${partial[2].toUpperCase()}`;
  }
  return null;
}

function extractReference(description: string): string | null {
  const m =
    description.match(/\b(?:ref|referans|fis|fiş|dekont)\s*[#:=-]?\s*([A-Z0-9\-/]{4,})\b/i) ??
    description.match(/\b([A-Z]?\d{6,})\b/);
  return m?.[1] ?? null;
}

function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/** Strip clock prefixes and channel noise tokens; keep original casing of remaining words. */
function stripNoiseTokens(raw: string): string {
  return raw
    .replace(/-?\d{1,2}:\d{2}(?::\d{2})?/g, " ")
    .replace(/[*\/\-_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !NOISE_WORD.test(foldTr(word)))
    .join(" ");
}

function limitPersonWords(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => {
      if (w.length <= 1) return false;
      if (NOISE_WORD.test(foldTr(w))) return false;
      // Ad/soyad: büyük harfle başlar veya tamamen büyük harf (PDF)
      return /^[A-ZÇĞİÖŞÜÁÉÍÓÚ]/.test(w) || /^[A-ZÇĞİÖŞÜ]{2,}$/.test(w);
    });
  return words.slice(0, 3).join(" ").trim();
}

function cleanPersonName(raw: string): string {
  const stopped: string[] = [];
  for (const word of raw.split(/\s+/)) {
    const folded = foldTr(word);
    if (MONTH_OR_NOTE.test(folded) || NOISE_WORD.test(folded)) break;
    if (folded.length <= 1) continue;
    if (/^\d/.test(word)) break;
    if (!(/^[A-ZÇĞİÖŞÜÁÉÍÓÚ]/.test(word) || /^[A-ZÇĞİÖŞÜ]{2,}$/.test(word))) break;
    stopped.push(word);
    if (stopped.length >= 4) break;
  }
  return stopped.join(" ").replace(/\s+/g, " ").trim();
}

function looksLikePersonName(name: string): boolean {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (name.replace(/\s+/g, "").length < 5) return false;
  if (/\bdaire\b/i.test(name)) return false;
  const banned = /^(market|pos|fatura|aidat|odeme|ödeme|tahsilat|alisveris|alışveriş)$/i;
  if (words.some((w) => banned.test(foldTr(w)))) return false;
  return words.every(
    (w) => /^[A-ZÇĞİÖŞÜÁÉÍÓÚ]/.test(w) || /^[A-ZÇĞİÖŞÜ]{2,}$/.test(w),
  );
}

/** Extract apartment number candidate with word boundaries (6 ≠ 16). */
export function extractApartmentNumberCandidate(description: string): string | null {
  const text = description.toLocaleLowerCase("tr-TR");
  const patterns = [
    /\bdaire\s*[#:.]?\s*(\d{1,4}[a-z]?)\b/i,
    /\bno\s*[#:.]?\s*(\d{1,4}[a-z]?)\b/i,
    /\b(\d{1,4}[a-z]?)\s*nolu\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractPaymentNote(description: string, personName: string | null): string | null {
  const starParts = description
    .split("*")
    .map((p) => p.trim())
    .filter(Boolean);
  if (starParts.length >= 2) {
    for (const part of starParts) {
      const cleaned = stripNoiseTokens(part);
      if (!cleaned) continue;
      if (personName && foldTr(cleaned) === foldTr(personName)) continue;
      if (/daire|\baidat\b|ödeme|odeme|ağustos|agustos|eylül|eylul/i.test(cleaned)) {
        return cleaned.slice(0, 120);
      }
    }
  }
  const afterName = personName
    ? description.split(personName).slice(1).join(personName)
    : description;
  const note = afterName
    .replace(/[*\/]+/g, " ")
    .replace(/\b(fast|eft|havale)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (note.length >= 3 && /daire|aidat|ödeme|odeme/i.test(note)) {
    return note.slice(0, 120);
  }
  return null;
}

/**
 * İş Bankası / genel TR kalıpları — özellikle FAST Name*Note*FAST.
 */
function extractNamedParty(
  description: string,
  direction: "CREDIT" | "DEBIT",
): { name: string; role: "sender" | "receiver" } | null {
  const labeledSender =
    description.match(
      /gönderen\s*[:.\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+){0,3})/i,
    ) ??
    description.match(
      /gonderen\s*[:.\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+){0,3})/i,
    );
  if (labeledSender?.[1]) {
    const name = limitPersonWords(cleanPersonName(labeledSender[1]));
    if (looksLikePersonName(name)) return { name, role: "sender" };
  }

  const labeledReceiver =
    description.match(
      /alıcı\s*[:.\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+){0,3})/i,
    ) ??
    description.match(
      /alici\s*[:.\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü.'\-]+){0,3})/i,
    );
  if (labeledReceiver?.[1]) {
    const name = limitPersonWords(cleanPersonName(labeledReceiver[1]));
    if (looksLikePersonName(name)) return { name, role: "receiver" };
  }

  // Star-separated: Name*Note*FAST / FAST Name*Note*CHANNEL
  const starParts = description.split("*").map((p) => p.trim()).filter(Boolean);
  if (starParts.length >= 2) {
    for (const part of starParts) {
      const cleaned = stripNoiseTokens(part);
      const name = limitPersonWords(cleanPersonName(cleaned));
      if (looksLikePersonName(name)) {
        return {
          name,
          role: direction === "CREDIT" ? "sender" : "receiver",
        };
      }
    }
  }

  const eftGelen = description.match(
    /(?:eft|havale|fast)\s+(?:gelen|ile\s+gelen)\s+([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+){0,3})/i,
  );
  if (eftGelen?.[1] && direction === "CREDIT") {
    const name = limitPersonWords(cleanPersonName(eftGelen[1]));
    if (looksLikePersonName(name)) return { name, role: "sender" };
  }

  const eftGiden = description.match(
    /(?:eft|havale|fast)\s+(?:giden|ile\s+giden)\s+([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+){0,3})/i,
  );
  if (eftGiden?.[1] && direction === "DEBIT") {
    const name = limitPersonWords(cleanPersonName(eftGiden[1]));
    if (looksLikePersonName(name)) return { name, role: "receiver" };
  }

  // "Sistem FA FAST Serdar Topal …" — yalnızca kanal/sistem gürültüsü temizlendikten sonra
  const hasTransferCue = /\b(fast|eft|havale|sistem|gönderen|gonderen)\b/i.test(description);
  if (hasTransferCue) {
    const stripped = stripNoiseTokens(description);
    const afterChannel = stripped.match(
      /^([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+(?:\s+[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+){1,2})/,
    );
    if (afterChannel?.[1]) {
      const name = limitPersonWords(cleanPersonName(afterChannel[1]));
      if (looksLikePersonName(name)) {
        return {
          name,
          role: direction === "CREDIT" ? "sender" : "receiver",
        };
      }
    }
  }

  const channelThenName = description.match(
    /(?:\be9\b|\beft\b|\bhavale\b|\bfast\b)\s+([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+(?:\s+[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü.'\-]+){1,3})/i,
  );
  if (channelThenName?.[1]) {
    const name = limitPersonWords(cleanPersonName(channelThenName[1]));
    if (looksLikePersonName(name)) {
      return {
        name,
        role: direction === "CREDIT" ? "sender" : "receiver",
      };
    }
  }

  return null;
}

export function parseCounterpartyFromDescription(
  description: string,
  direction: "CREDIT" | "DEBIT",
): CounterpartyInfo {
  const channel = detectChannel(description);
  const party = extractNamedParty(description, direction);
  const counterpartyIbanMasked = extractIbanMasked(description);
  const referenceHint = extractReference(description);
  const apartmentNumberCandidate = extractApartmentNumberCandidate(description);
  const paymentNote = extractPaymentNote(description, party?.name ?? null);

  let summaryLine = description.replace(/\s+/g, " ").trim();
  if (party?.name) {
    summaryLine = summaryLine.replace(party.name, "").replace(/\s+/g, " ").trim();
  }
  if (summaryLine.length > 90) summaryLine = `${summaryLine.slice(0, 87)}…`;

  const counterpartyName =
    party?.name && party.name.length >= 3 && looksLikePersonName(party.name) ? party.name : null;

  return {
    counterpartyName,
    counterpartyRole: party?.role ?? (direction === "CREDIT" ? "sender" : "receiver"),
    channel,
    counterpartyIbanMasked,
    referenceHint,
    summaryLine: summaryLine || description.slice(0, 90),
    counterpartyNameCandidate: counterpartyName,
    apartmentNumberCandidate,
    paymentNote,
    transactionChannel: channel,
  };
}

export function isGenericMatchKey(value: string): boolean {
  const n = value.trim().toLocaleLowerCase("tr-TR");
  if (n.length < 4) return true;
  return /^(havale|eft|fast|pos|gelen|giden|aidat|odeme|ödeme|sistem|fa)$/i.test(n);
}
