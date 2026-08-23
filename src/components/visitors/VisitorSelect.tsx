"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { listVisitors, type Visitor } from "@/lib/visits-api";

type AuthContext = { token: string; tenantId: string };

type VisitorSelectProps = {
  auth: AuthContext | null;
  value: string;
  onChange: (visitorId: string, visitor?: Visitor | null) => void;
  disabled?: boolean;
  onCreateNew?: () => void;
  selectedLabel?: string;
};

function visitorLabel(visitor: Pick<Visitor, "fullName" | "phone">) {
  return visitor.phone ? `${visitor.fullName} · ${visitor.phone}` : visitor.fullName;
}

export function VisitorSelect({
  auth,
  value,
  onChange,
  disabled = false,
  onCreateNew,
  selectedLabel,
}: VisitorSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [displayName, setDisplayName] = useState(selectedLabel ?? "");
  const [items, setItems] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (selectedLabel !== undefined) setDisplayName(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!value) setDisplayName("");
  }, [value]);

  useEffect(() => {
    if (!open || !auth) return;
    let cancelled = false;
    setLoading(true);
    void listVisitors(auth, {
      search: debouncedQuery.trim() || undefined,
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

  function handleSelect(visitor: Visitor) {
    setDisplayName(visitorLabel(visitor));
    setQuery("");
    setOpen(false);
    onChange(visitor.id, visitor);
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
          placeholder="Misafir ara..."
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
            {loading ? <p className="px-3 py-2 text-sm text-muted">Yükleniyor...</p> : null}
            {!loading && items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">Misafir bulunamadı.</p>
            ) : null}
            {!loading
              ? items.map((visitor) => (
                  <button
                    key={visitor.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                    onClick={() => handleSelect(visitor)}
                  >
                    {visitor.fullName}
                    {visitor.phone ? (
                      <span className="ml-1 text-muted">· {visitor.phone}</span>
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
          Yeni Misafir
        </Button>
      ) : null}
    </div>
  );
}
