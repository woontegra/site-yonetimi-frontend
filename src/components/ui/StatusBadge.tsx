import { Badge, type BadgeTone } from "@/components/ui/Badge";

export type StatusKey =
  | "active"
  | "inactive"
  | "draft"
  | "published"
  | "archived"
  | "cancelled"
  | "maintenance"
  | "approved"
  | "review"
  | "failed"
  | "open"
  | "paid"
  | "inside"
  | "completed";

const STATUS_META: Record<StatusKey, { label: string; tone: BadgeTone }> = {
  active: { label: "Aktif", tone: "success" },
  inactive: { label: "Pasif", tone: "neutral" },
  draft: { label: "Taslak", tone: "warning" },
  published: { label: "Yayında", tone: "success" },
  archived: { label: "Arşiv", tone: "neutral" },
  cancelled: { label: "İptal", tone: "danger" },
  maintenance: { label: "Bakımda", tone: "warning" },
  approved: { label: "Onaylandı", tone: "success" },
  review: { label: "İncelemede", tone: "info" },
  failed: { label: "Başarısız", tone: "danger" },
  open: { label: "Açık", tone: "warning" },
  paid: { label: "Ödendi", tone: "success" },
  inside: { label: "İçeride", tone: "success" },
  completed: { label: "Tamamlandı", tone: "neutral" },
};

type StatusBadgeProps = {
  active?: boolean;
  status?: StatusKey;
  label?: string;
  tone?: BadgeTone;
};

export function StatusBadge({ active, status, label, tone }: StatusBadgeProps) {
  if (typeof active === "boolean") {
    return <Badge tone={active ? "success" : "neutral"}>{active ? "Aktif" : "Pasif"}</Badge>;
  }

  if (status) {
    const meta = STATUS_META[status];
    return <Badge tone={tone ?? meta.tone}>{label ?? meta.label}</Badge>;
  }

  return <Badge tone={tone ?? "neutral"}>{label ?? "—"}</Badge>;
}
