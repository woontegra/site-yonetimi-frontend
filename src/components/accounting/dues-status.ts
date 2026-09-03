import type { DuesDefinition } from "@/lib/dues-api";

export type DuesAssessmentStatus =
  | "DEFINED"
  | "CHARGED"
  | "PARTIAL"
  | "COMPLETED"
  | "OVERDUE"
  | "INACTIVE";

export const DUES_ASSESSMENT_STATUS_LABELS: Record<DuesAssessmentStatus, string> = {
  DEFINED: "Tanımlandı",
  CHARGED: "Borçlandırıldı",
  PARTIAL: "Kısmen Tahsil Edildi",
  COMPLETED: "Tamamlandı",
  OVERDUE: "Vadesi Geçti",
  INACTIVE: "Pasif",
};

export function deriveDuesAssessmentStatus(dues: DuesDefinition): DuesAssessmentStatus {
  if (!dues.isActive) return "INACTIVE";

  const charged = dues.chargedApartmentCount ?? 0;
  if (charged === 0) return "DEFINED";

  const original = Number(dues.totalOriginalAmount ?? 0);
  const remaining = Number(dues.totalRemainingAmount ?? 0);
  const openCount = dues.chargedOpenCount ?? 0;

  if (original > 0 && remaining <= 0) return "COMPLETED";
  if (original > 0 && remaining > 0 && remaining < original) return "PARTIAL";

  const due = new Date(dues.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (openCount > 0 && !Number.isNaN(due.getTime()) && due < today) return "OVERDUE";

  return "CHARGED";
}

export function suggestedDuesName(periodMonth: number, periodYear: number): string {
  const months = [
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
  ];
  const label = months[periodMonth - 1] ?? String(periodMonth);
  return `${label} ${periodYear} Aidatı`;
}

export function suggestedDueDate(periodMonth: number, periodYear: number): string {
  const day = 10;
  const month = String(periodMonth).padStart(2, "0");
  return `${periodYear}-${month}-${String(day).padStart(2, "0")}`;
}

export function parseAmountInput(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  if (trimmed.includes(",") && trimmed.includes(".")) {
    const amount = Number(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(amount) ? null : amount;
  }
  if (trimmed.includes(",")) {
    const amount = Number(trimmed.replace(",", "."));
    return Number.isNaN(amount) ? null : amount;
  }

  const parts = trimmed.split(".");
  if (parts.length === 2 && parts[1]!.length > 0 && parts[1]!.length <= 2) {
    const amount = Number(trimmed);
    return Number.isNaN(amount) ? null : amount;
  }
  if (parts.length > 1) {
    const amount = Number(parts.join(""));
    return Number.isNaN(amount) ? null : amount;
  }

  const amount = Number(trimmed);
  return Number.isNaN(amount) ? null : amount;
}

