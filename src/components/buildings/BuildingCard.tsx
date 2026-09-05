"use client";

import Link from "next/link";
import { Building2, MoreHorizontal } from "lucide-react";
import { EntityIcon } from "@/components/sites/site-ui";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { useActiveSite } from "@/lib/active-site-context";
import {
  effectiveBuildingAddress,
  formatAddressDisplay,
  type AddressParts,
} from "@/lib/building-address";
import type { Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";

type BuildingCardProps = {
  building: Building;
  siteFallback?: AddressParts | null;
  onEdit: (building: Building) => void;
  onDelete: (building: Building) => void;
};

export function BuildingCard({ building, siteFallback, onEdit, onDelete }: BuildingCardProps) {
  const { site } = useActiveSite();
  const address = formatAddressDisplay(
    effectiveBuildingAddress(building, siteFallback ?? site),
  );
  const registered = building.registeredApartmentCount ?? 0;
  const capacity = building.apartmentCount;
  const over = capacity != null && capacity > 0 && registered > capacity;
  const progress =
    capacity != null && capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : null;

  return (
    <SurfaceCard padding="none" tone="cyan" interactive className="flex h-full flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <EntityIcon icon={Building2} tone="cyan" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/app/binalar/${building.id}`}
                className="block break-words text-base font-semibold text-ink hover:text-accent"
              >
                {building.name}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge active={building.isActive} />
                {building.code ? (
                  <Badge tone="neutral">{building.code}</Badge>
                ) : null}
              </div>
            </div>
            <Dropdown
              align="right"
              menuClassName="min-w-[11rem]"
              trigger={
                <button
                  type="button"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                  aria-label={`${building.name} işlemleri`}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              }
            >
              <DropdownItem href={`/app/binalar/${building.id}`}>Binayı Gör</DropdownItem>
              <DropdownItem onClick={() => onEdit(building)}>Düzenle</DropdownItem>
              <DropdownItem danger onClick={() => onDelete(building)}>
                Sil
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-3">
        <MiniStat
          label="Kat"
          value={building.floorCount != null ? String(building.floorCount) : "—"}
        />
        <MiniStat
          label="Kapasite"
          value={capacity != null ? String(capacity) : "—"}
        />
        <MiniStat
          label="Kayıtlı daire"
          value={capacity != null ? `${registered} / ${capacity}` : String(registered)}
          className={over ? "text-warning" : undefined}
        />
      </div>

      {progress != null ? (
        <div className="px-5 pb-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className={cn("h-full rounded-full", over ? "bg-warning" : "bg-accent")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {registered} / {capacity} daire kayıtlı
          </p>
        </div>
      ) : (
        <p className="px-5 pb-2 text-[11px] text-muted">{registered} daire kayıtlı</p>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-line px-5 py-4">
        <p className="line-clamp-2 break-words text-sm text-muted">
          {address.secondary
            ? `${address.primary} · ${address.secondary}`
            : address.primary}
        </p>
        <Link
          href={`/app/binalar/${building.id}`}
          className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas"
        >
          Binayı Gör
        </Link>
      </div>
    </SurfaceCard>
  );
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-canvas px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-[13px] font-medium text-ink", className)}>{value}</p>
    </div>
  );
}

type BuildingCardsGridProps = {
  items: Building[];
  loading: boolean;
  siteFallback?: AddressParts | null;
  onEdit: (building: Building) => void;
  onDelete: (building: Building) => void;
  onAdd?: () => void;
};

export function BuildingCardsGrid({
  items,
  loading,
  siteFallback,
  onEdit,
  onDelete,
  onAdd,
}: BuildingCardsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`b-skel-${index}`} className="h-52 animate-pulse rounded-lg border border-line bg-white" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Henüz bina bulunmuyor"
        description="Bu siteye ilk binayı ekleyerek daire ve demirbaş yönetimine başlayabilirsiniz."
        action={
          onAdd ? (
            <Button type="button" onClick={onAdd}>
              Bina Ekle
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((building) => (
        <BuildingCard
          key={building.id}
          building={building}
          siteFallback={siteFallback}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
