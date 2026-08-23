"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { listSuppliers, type Supplier } from "@/lib/suppliers-api";

type AuthContext = { token: string; tenantId: string };

type SupplierSelectProps = {
  auth: AuthContext | null;
  value: string;
  onChange: (supplierId: string, supplier?: Supplier | null) => void;
  disabled?: boolean;
  onCreateNew?: () => void;
  selectedName?: string;
};

export function SupplierSelect({
  auth,
  value,
  onChange,
  disabled = false,
  onCreateNew,
  selectedName,
}: SupplierSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [displayName, setDisplayName] = useState(selectedName ?? "");
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (selectedName !== undefined) setDisplayName(selectedName);
  }, [selectedName]);

  useEffect(() => {
    if (!value) setDisplayName("");
  }, [value]);

  useEffect(() => {
    if (!open || !auth) return;
    let cancelled = false;
    setLoading(true);
    void listSuppliers(auth, {
      search: debouncedQuery.trim() || undefined,
      status: "aktif",
      perPage: 20,
    })
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth, debouncedQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSelect(supplier: Supplier) {
    setDisplayName(supplier.name);
    setQuery("");
    setOpen(false);
    onChange(supplier.id, supplier);
  }

  function handleClear() {
    setDisplayName("");
    setQuery("");
    onChange("", null);
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <Input
          value={open ? query : displayName}
          disabled={disabled || !auth}
          placeholder="Tedarikçi ara..."
          onFocus={() => {
            if (disabled || !auth) return;
            setQuery(displayName);
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
            if (!event.target.value && value) handleClear();
          }}
          autoComplete="off"
        />
        {open ? (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-[10px] border border-line bg-white shadow-panel">
            {loading ? (
              <p className="px-3 py-2 text-sm text-muted">Yükleniyor...</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">Tedarikçi bulunamadı.</p>
            ) : null}
            {!loading
              ? items.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                    onClick={() => handleSelect(supplier)}
                  >
                    {supplier.name}
                    {supplier.city ? (
                      <span className="ml-1 text-muted">· {supplier.city}</span>
                    ) : null}
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>
      {onCreateNew ? (
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={onCreateNew}>
          <Plus className="size-3.5" aria-hidden />
          Yeni Tedarikçi
        </Button>
      ) : null}
    </div>
  );
}
