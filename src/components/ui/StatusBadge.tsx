import { Badge } from "@/components/ui/Badge";

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Aktif" : "Pasif"}</Badge>;
}
