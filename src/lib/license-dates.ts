/**
 * Frontend önizleme — backend `license-dates.ts` ile aynı İstanbul gün sonu mantığı.
 * Gerçek kalan gün / bitiş her zaman backend’den okunur; bu yalnız admin onay modalı içindir.
 */

function istanbulYmd(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function endOfIstanbulDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 20, 59, 59, 999));
}

export function previewAddCalendarDaysEndOfDay(fromIso: string | Date, days: number): Date {
  const from = typeof fromIso === "string" ? new Date(fromIso) : fromIso;
  const { year, month, day } = istanbulYmd(from);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return endOfIstanbulDay(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

export function previewExtendBaseIso(endsAtIso: string | null | undefined, now = new Date()): Date {
  if (!endsAtIso) return now;
  const endsAt = new Date(endsAtIso);
  return endsAt.getTime() > now.getTime() ? endsAt : now;
}

export function previewRemainingCalendarDays(endsAt: Date, now = new Date()): number {
  const a = istanbulYmd(now);
  const b = istanbulYmd(endsAt);
  const start = Date.UTC(a.year, a.month - 1, a.day);
  const end = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}
