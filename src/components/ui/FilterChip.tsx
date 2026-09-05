import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type FilterChipProps = {
  label: string;
  onRemove: () => void;
  className?: string;
};

export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1 rounded-md bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent",
        className,
      )}
    >
      {label}
      <button
        type="button"
        className="rounded p-0.5 text-accent hover:bg-white/70"
        aria-label={`${label} filtresini kaldır`}
        onClick={onRemove}
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
