"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  apartmentMatchesQuery,
  formatApartmentOccupantLabel,
  getApartmentOccupantView,
  sortApartmentsByNumber,
} from "@/lib/apartment-labels";
import type { Apartment } from "@/lib/apartments-api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

type ApartmentComboboxProps = {
  id?: string;
  apartments: Apartment[];
  value: string;
  onChange: (apartmentId: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  /** Open the list immediately (manual match drawer). */
  defaultOpen?: boolean;
};

const LIST_MAX_HEIGHT = 280;

export function ApartmentCombobox({
  id,
  apartments,
  value,
  onChange,
  disabled = false,
  invalid = false,
  loading = false,
  placeholder = "Daire veya kişi ara…",
  emptyMessage = "Bu aramayla eşleşen daire veya kişi bulunamadı.",
  className,
  defaultOpen = false,
}: ApartmentComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 0 });

  const sorted = useMemo(() => sortApartmentsByNumber(apartments), [apartments]);
  const selected = sorted.find((item) => item.id === value) ?? null;
  const selectedLabel = selected ? formatApartmentOccupantLabel(selected) : "";

  const filtered = useMemo(() => {
    const q = open ? query : "";
    return sorted.filter((apartment) => apartmentMatchesQuery(apartment, q));
  }, [sorted, open, query]);

  useEffect(() => {
    if (!defaultOpen || disabled) return;
    setOpen(true);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [defaultOpen, disabled]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const height = Math.min(LIST_MAX_HEIGHT, preferBelow ? spaceBelow : spaceAbove);
    const top = preferBelow ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
    setMenuBox({ top, left, width });
  }, [open, filtered.length, query]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
        inputRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function selectApartment(apartmentId: string) {
    onChange(apartmentId);
    setOpen(false);
    setQuery("");
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (!open) {
        setOpen(true);
        return;
      }
      event.preventDefault();
      const item = filtered[highlight];
      if (item) selectApartment(item.id);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          disabled={disabled}
          invalid={invalid}
          className="pr-9 pl-9"
          placeholder={selected && !open ? selectedLabel : placeholder}
          value={open ? query : selected ? selectedLabel : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Daire listesi"
              className="fixed z-[90] overflow-hidden rounded-md border border-line bg-surface shadow-modal"
              style={{
                top: menuBox.top,
                left: menuBox.left,
                width: menuBox.width,
                maxHeight: LIST_MAX_HEIGHT,
              }}
            >
              <div className="max-h-[280px] overflow-y-auto overscroll-contain py-1">
                {loading ? (
                  <p className="px-3 py-3 text-sm text-muted">Daireler yükleniyor…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted">{emptyMessage}</p>
                ) : (
                  filtered.map((apartment, index) => {
                    const view = getApartmentOccupantView(apartment);
                    const active = apartment.id === value;
                    const highlighted = index === highlight;
                    return (
                      <button
                        key={apartment.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                          highlighted ? "bg-accent-subtle" : "hover:bg-canvas",
                          active ? "bg-canvas" : null,
                        )}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => selectApartment(apartment.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-ink">
                              {view.buildingName} · Daire {view.apartmentNumber}
                            </p>
                            {active ? (
                              <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                            ) : null}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm text-ink">
                              {view.primaryPerson?.fullName ?? "Kişi atanmamış"}
                            </span>
                            {view.primaryRoleLabel ? (
                              <Badge tone={view.primaryRole === "TENANT" ? "info" : "neutral"}>
                                {view.primaryRoleLabel}
                              </Badge>
                            ) : null}
                            {view.owners.length + view.tenants.length > 1 ? (
                              <span className="text-xs text-muted">
                                +{view.owners.length + view.tenants.length - 1}
                              </span>
                            ) : null}
                          </div>
                          {view.openDebtAmount > 0 ? (
                            <p className="mt-1 text-xs text-muted">
                              Açık borç: {formatMoney(view.openDebtAmount)}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted">Açık borç yok</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
