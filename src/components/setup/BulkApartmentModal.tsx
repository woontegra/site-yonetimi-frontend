"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { bulkCreateApartments } from "@/lib/site-setup-api";

type PreviewRow = {
  number: string;
  floor: string;
  roomType: string;
};

function generatePreviewRows(start: number, end: number, prefix: string): PreviewRow[] {
  if (start > end || start < 1) return [];
  const rows: PreviewRow[] = [];
  for (let i = start; i <= end; i++) {
    rows.push({ number: `${prefix}${i}`, floor: "", roomType: "" });
  }
  return rows;
}

type BulkApartmentModalProps = {
  open: boolean;
  buildingId: string;
  buildingName?: string;
  buildings?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated?: () => void;
};

export function BulkApartmentModal({
  open,
  buildingId: initialBuildingId,
  buildingName,
  buildings = [],
  onClose,
  onCreated,
}: BulkApartmentModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { showToast } = useToast();
  const [buildingId, setBuildingId] = useState(initialBuildingId);
  const [startNum, setStartNum] = useState("1");
  const [endNum, setEndNum] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setBuildingId(initialBuildingId);
    setStartNum("1");
    setEndNum("10");
    setPrefix("");
    setPreview([]);
    setError("");
  }, [open, initialBuildingId]);

  const canPreview = useMemo(() => {
    const start = Number(startNum);
    const end = Number(endNum);
    return !Number.isNaN(start) && !Number.isNaN(end) && start >= 1 && end >= start && end - start < 500;
  }, [startNum, endNum]);

  function handlePreview() {
    const start = Number(startNum);
    const end = Number(endNum);
    if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < start) {
      setError("Geçerli bir başlangıç ve bitiş numarası girin.");
      return;
    }
    if (end - start + 1 > 500) {
      setError("Tek seferde en fazla 500 daire oluşturulabilir.");
      return;
    }
    setError("");
    setPreview(generatePreviewRows(start, end, prefix));
  }

  function updatePreviewRow(index: number, key: keyof PreviewRow, value: string) {
    setPreview((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth || pending || preview.length === 0) return;
    setPending(true);
    setError("");
    try {
      const result = await bulkCreateApartments(
        auth,
        buildingId,
        preview.map((row) => ({
          number: row.number,
          floor: row.floor.trim() || null,
          roomType: row.roomType.trim() || null,
        })),
      );
      showToast(`${result.created} daire oluşturuldu.${result.skipped ? ` ${result.skipped} atlandı.` : ""}`);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Daireler oluşturulamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormModal
      open={open}
      size="lg"
      title="Toplu Daire Oluştur"
      description={
        buildings.length > 1
          ? "Bina seçin ve daire aralığını tanımlayın."
          : buildingName
            ? `Bina: ${buildingName}`
            : undefined
      }
      icon={DoorOpen}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button
            type="submit"
            form="bulk-apartment-form"
            disabled={pending || preview.length === 0}
          >
            {pending ? (
              "Oluşturuluyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Oluştur ({preview.length})
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="bulk-apartment-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {buildings.length > 1 ? (
          <FormField label="Bina" htmlFor="bulk-building">
            <Select
              id="bulk-building"
              value={buildingId}
              onChange={(event) => setBuildingId(event.target.value)}
            >
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
        <FormSection title="Aralık">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <FormField label="Başlangıç" htmlFor="bulk-start">
              <Input
                id="bulk-start"
                data-modal-autofocus
                type="number"
                min={1}
                value={startNum}
                onChange={(event) => setStartNum(event.target.value)}
              />
            </FormField>
            <FormField label="Bitiş" htmlFor="bulk-end">
              <Input
                id="bulk-end"
                type="number"
                min={1}
                value={endNum}
                onChange={(event) => setEndNum(event.target.value)}
              />
            </FormField>
            <FormField label="Önek (opsiyonel)" htmlFor="bulk-prefix">
              <Input
                id="bulk-prefix"
                value={prefix}
                onChange={(event) => setPrefix(event.target.value)}
                placeholder="Örn: A-"
              />
            </FormField>
            <div className="flex items-end">
              <Button type="button" variant="secondary" className="w-full" disabled={!canPreview} onClick={handlePreview}>
                Önizle
              </Button>
            </div>
          </div>
        </FormSection>

        {preview.length > 0 ? (
          <FormSection title={`Önizleme (${preview.length} daire)`}>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Daire No</TH>
                      <TH>Kat</TH>
                      <TH>Oda Tipi</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {preview.map((row, index) => (
                      <TR key={`${row.number}-${index}`} className="hover:bg-transparent">
                        <TD className="font-medium">{row.number}</TD>
                        <TD>
                          <Input
                            className="h-8"
                            value={row.floor}
                            onChange={(event) => updatePreviewRow(index, "floor", event.target.value)}
                          />
                        </TD>
                        <TD>
                          <Input
                            className="h-8"
                            value={row.roomType}
                            onChange={(event) => updatePreviewRow(index, "roomType", event.target.value)}
                          />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableElement>
              </Table>
            </div>
          </FormSection>
        ) : null}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
