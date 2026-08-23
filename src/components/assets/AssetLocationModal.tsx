"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Building } from "@/lib/buildings-api";

type AssetLocationModalProps = {
  open: boolean;
  buildings: Building[];
  initialBuildingId: string;
  initialLocation: string;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (payload: {
    buildingId: string | null;
    location: string | null;
    note?: string;
  }) => Promise<void>;
};

export function AssetLocationModal({
  open,
  buildings,
  initialBuildingId,
  initialLocation,
  pending,
  error,
  onClose,
  onSubmit,
}: AssetLocationModalProps) {
  const [buildingId, setBuildingId] = useState(initialBuildingId);
  const [location, setLocation] = useState(initialLocation);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setBuildingId(initialBuildingId);
    setLocation(initialLocation);
    setNote("");
  }, [open, initialBuildingId, initialLocation]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    await onSubmit({
      buildingId: buildingId || null,
      location: location.trim() || null,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <FormModal
      open={open}
      title="Konumu Değiştir"
      description="Demirbaş bina ve konum bilgisini güncelleyin."
      size="sm"
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="asset-location-form" disabled={pending}>
            {pending ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Kaydet
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="asset-location-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <FormField label="Bina" htmlFor="asset-location-building">
          <Select
            id="asset-location-building"
            data-modal-autofocus
            value={buildingId}
            onChange={(event) => setBuildingId(event.target.value)}
          >
            <option value="">Site Geneli</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Konum" htmlFor="asset-location-text">
          <Input
            id="asset-location-text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Örn. Teknik oda, depo"
          />
        </FormField>
        <FormField label="Not" htmlFor="asset-location-note">
          <Textarea
            id="asset-location-note"
            rows={3}
            className="min-h-[76px]"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
