"use client";

import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useActiveSite } from "@/lib/active-site-context";
import type { SiteSummary } from "@/lib/sites-api";

type SiteSelectProps = {
  id?: string;
  value: string;
  onChange: (siteId: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  /** Aktif siteler dışarıdan verilirse context’e düşmez. */
  sites?: SiteSummary[];
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
};

export function SiteSelect({
  id = "site-select",
  value,
  onChange,
  error,
  required = true,
  disabled = false,
  label = "Site",
  sites: sitesProp,
  loading = false,
  className,
  autoFocus = false,
}: SiteSelectProps) {
  const { sites: contextSites, ready } = useActiveSite();
  const sites = sitesProp ?? contextSites;
  const isLoading = loading || (!sitesProp && !ready);

  return (
    <FormField label={label} htmlFor={id} required={required} error={error} className={className}>
      <Select
        id={id}
        value={value}
        invalid={Boolean(error)}
        disabled={disabled || isLoading}
        data-modal-autofocus={autoFocus || undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {isLoading ? "Siteler yükleniyor..." : sites.length === 0 ? "Aktif site yok" : "Site seçin"}
        </option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
