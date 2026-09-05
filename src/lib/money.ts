export const MONTH_LABELS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

export const DEBT_STATUS_LABELS = {
  OPEN: "Açık",
  PAID: "Ödendi",
  CANCELLED: "İptal",
} as const;

export const DEBT_TYPE_LABELS = {
  DUES: "Aidat",
  MANUAL: "Manuel",
  INTEREST: "Gecikme Faizi",
} as const;

export const PAYMENT_METHOD_LABELS = {
  CASH: "Nakit",
  BANK_TRANSFER: "Havale / EFT",
  CREDIT_CARD: "Kredi Kartı",
  OTHER: "Diğer",
} as const;

export const PAYMENT_STATUS_LABELS = {
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
} as const;

export const EXPENSE_STATUS_LABELS = {
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
} as const;

export const BANK_MATCH_STATUS_LABELS = {
  UNMATCHED: "Eşleşmedi",
  SUGGESTED: "Otomatik öneri — onay bekliyor",
  MATCHED: "Eşleşme Onaylandı",
  PROCESSED: "Tahsilata Aktarıldı",
} as const;

export const BANK_DEBIT_CLASS_LABELS = {
  UNCLASSIFIED: "Sınıflandırılmadı",
  EXPENSE: "Giderle Eşleşti",
  EXCLUDED: "Hariç Tutuldu",
} as const;

export const BANK_DIRECTION_LABELS = {
  CREDIT: "Gelen",
  DEBIT: "Giden",
} as const;

export const DUE_STATE_LABELS = {
  upcoming: "Vadesi gelmedi",
  today: "Bugün",
  overdue: "Gecikmiş",
} as const;

export function formatMoney(value: string | number | null | undefined): string {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(num)) return "0,00 ₺";
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)} ₺`;
}

export function formatPeriod(year: number | null | undefined, month: number | null | undefined): string {
  if (!year || !month) return "—";
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function formatPeriodLong(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function formatDateTr(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR").format(date);
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}
