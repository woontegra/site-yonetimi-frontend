export const GENDER_OPTIONS = ["Kadın", "Erkek", "Belirtmek istemiyor"] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number];

export const RELATION_TYPE_LABELS = {
  OWNER: "Mülk Sahibi",
  TENANT: "Kiracı",
} as const;

export type RelationType = keyof typeof RELATION_TYPE_LABELS;

export function formatPersonDate(value: string | null | undefined): string {
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

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}
