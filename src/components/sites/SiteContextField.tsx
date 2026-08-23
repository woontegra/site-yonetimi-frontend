"use client";

import { FormField } from "@/components/ui/FormField";
import { cn } from "@/lib/cn";

type SiteContextFieldProps = {
  label?: string;
  /** Site adı veya “Site · Bina · Daire” gibi bağlam satırı */
  value: string;
  hint?: string;
  className?: string;
};

/** Read-only site / konum bağlamı — disabled native input yerine. */
export function SiteContextField({
  label = "Site",
  value,
  hint = "Bu kayıt seçili site kapsamında oluşturulur.",
  className,
}: SiteContextFieldProps) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <div
        className={cn(
          "flex min-h-11 items-center rounded-[10px] border border-line bg-canvas px-3",
          "text-sm font-medium text-ink",
        )}
        role="status"
        aria-live="polite"
      >
        {value || "—"}
      </div>
    </FormField>
  );
}
