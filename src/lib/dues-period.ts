export const MAX_ASSESSMENT_PERIODS = 24;

export type PeriodMode = "SINGLE" | "RANGE" | "YEAR" | "CUSTOM";
export type DueDay = number | "END";
export type PeriodRef = { periodYear: number; periodMonth: number };

export function periodIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

export function fromPeriodIndex(index: number): PeriodRef {
  const periodYear = Math.floor(index / 12);
  const periodMonth = (index % 12) + 1;
  return { periodYear, periodMonth };
}

export function expandPeriodRange(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): PeriodRef[] {
  const start = periodIndex(startYear, startMonth);
  const end = periodIndex(endYear, endMonth);
  if (end < start) {
    throw new Error("Bitiş dönemi başlangıç döneminden önce olamaz.");
  }
  const count = end - start + 1;
  if (count > MAX_ASSESSMENT_PERIODS) {
    throw new Error(`Tek işlemde en fazla ${MAX_ASSESSMENT_PERIODS} ay seçilebilir.`);
  }
  const periods: PeriodRef[] = [];
  for (let i = start; i <= end; i += 1) periods.push(fromPeriodIndex(i));
  return periods;
}

export function expandFullYear(year: number): PeriodRef[] {
  return Array.from({ length: 12 }, (_, i) => ({ periodYear: year, periodMonth: i + 1 }));
}

export function expandCustomMonths(year: number, months: number[]): PeriodRef[] {
  const unique = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (unique.length === 0) throw new Error("En az bir ay seçilmelidir.");
  return unique.map((periodMonth) => ({ periodYear: year, periodMonth }));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Türkiye takvim günü — YYYY-MM-DD (UTC midnight anlamında). */
export function computeDueDateIso(year: number, month: number, dueDay: DueDay): string {
  let day: number;
  if (dueDay === "END") {
    day = daysInMonth(year, month);
  } else {
    day = Math.min(Math.max(1, Math.floor(dueDay)), 28);
    day = Math.min(day, daysInMonth(year, month));
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDueDay(value: string): DueDay | null {
  if (value === "END") return "END";
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 28) return null;
  return n;
}

export function dueDayLabel(dueDay: DueDay): string {
  return dueDay === "END" ? "Her ayın sonu" : `Her ayın ${dueDay}'i`;
}
