"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import type { Apartment } from "@/lib/apartments-api";
import { ApiError } from "@/lib/http";
import {
  downloadResidentsImportTemplate,
  needsBuildingColumn,
  parseResidentsXlsx,
} from "@/lib/residents-import-xlsx";
import {
  commitResidentsImport,
  previewResidentsImport,
  type ResidentImportPreviewResult,
  type ResidentImportRow,
} from "@/lib/site-setup-api";

export { downloadResidentsImportTemplate } from "@/lib/residents-import-xlsx";

type ResidentsImportModalProps = {
  open: boolean;
  apartments: Apartment[];
  onClose: () => void;
  onImported?: () => void;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("tr");
}

function headerMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = normHeader(raw);
    if (h === "bina" || h === "blok") map.building = i;
    else if (h.includes("daire")) map.apartment = i;
    else if (h.includes("mülk") && h.includes("ad") && !h.includes("soy")) map.ownerFirst = i;
    else if (h.includes("mülk") && h.includes("soy")) map.ownerLast = i;
    else if (h.includes("mülk") && h.includes("telefon")) map.ownerPhone = i;
    else if (h.includes("mülk") && (h.includes("e-posta") || h.includes("eposta") || h.includes("mail")))
      map.ownerEmail = i;
    else if (h.includes("kiracı") && h.includes("ad") && !h.includes("soy")) map.tenantFirst = i;
    else if (h.includes("kiracı") && h.includes("soy")) map.tenantLast = i;
    else if (h.includes("kiracı") && h.includes("telefon")) map.tenantPhone = i;
    else if (h.includes("kiracı") && (h.includes("e-posta") || h.includes("eposta") || h.includes("mail")))
      map.tenantEmail = i;
  });
  return map;
}

function at(cells: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (cells[index] ?? "").trim();
}

function parseResidentsCsv(text: string, needsBuilding: boolean): ResidentImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) return [];

  const first = parseCsvLine(lines[0]);
  const map = headerMap(first);
  const hasHeader = map.apartment !== undefined || map.building !== undefined;
  const data = hasHeader ? lines.slice(1) : lines;

  return data.map((line) => {
    const cells = parseCsvLine(line);
    if (hasHeader) {
      return {
        buildingName: at(cells, map.building) || undefined,
        apartmentNumber: at(cells, map.apartment),
        ownerFirstName: at(cells, map.ownerFirst) || undefined,
        ownerLastName: at(cells, map.ownerLast) || undefined,
        ownerPhone: at(cells, map.ownerPhone) || undefined,
        ownerEmail: at(cells, map.ownerEmail) || undefined,
        tenantFirstName: at(cells, map.tenantFirst) || undefined,
        tenantLastName: at(cells, map.tenantLast) || undefined,
        tenantPhone: at(cells, map.tenantPhone) || undefined,
        tenantEmail: at(cells, map.tenantEmail) || undefined,
      };
    }
    if (needsBuilding) {
      return {
        buildingName: cells[0] || undefined,
        apartmentNumber: cells[1] ?? "",
        ownerFirstName: cells[2] || undefined,
        ownerLastName: cells[3] || undefined,
        ownerPhone: cells[4] || undefined,
        ownerEmail: cells[5] || undefined,
        tenantFirstName: cells[6] || undefined,
        tenantLastName: cells[7] || undefined,
        tenantPhone: cells[8] || undefined,
        tenantEmail: cells[9] || undefined,
      };
    }
    return {
      apartmentNumber: cells[0] ?? "",
      ownerFirstName: cells[1] || undefined,
      ownerLastName: cells[2] || undefined,
      ownerPhone: cells[3] || undefined,
      ownerEmail: cells[4] || undefined,
      tenantFirstName: cells[5] || undefined,
      tenantLastName: cells[6] || undefined,
      tenantPhone: cells[7] || undefined,
      tenantEmail: cells[8] || undefined,
    };
  });
}

function statusLabel(status: string): string {
  if (status === "ready") return "Hazır";
  if (status === "warning") return "Uyarı";
  if (status === "error") return "Hata";
  if (status === "skip") return "Atlandı";
  return status;
}

export function ResidentsImportModal({
  open,
  apartments,
  onClose,
  onImported,
}: ResidentsImportModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ResidentImportRow[]>([]);
  const [preview, setPreview] = useState<ResidentImportPreviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const needsBuilding = useMemo(() => needsBuildingColumn(apartments), [apartments]);

  const reset = useCallback(() => {
    setFileName("");
    setRows([]);
    setPreview(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    if (pending) return;
    reset();
    onClose();
  }, [pending, reset, onClose]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !auth) return;

    setFileName(file.name);
    setError("");
    setPreview(null);
    setRows([]);
    setPending(true);

    try {
      const lower = file.name.toLowerCase();
      let parsed: ResidentImportRow[];

      if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
        setError("Eski .xls formatı desteklenmiyor. Lütfen .xlsx dosyası yükleyin.");
        return;
      }
      if (lower.endsWith(".xlsx")) {
        parsed = await parseResidentsXlsx(await file.arrayBuffer(), needsBuilding);
      } else {
        parsed = parseResidentsCsv(await file.text(), needsBuilding);
      }

      if (parsed.length === 0) {
        setError("Dosyada geçerli satır bulunamadı.");
        return;
      }
      if (parsed.length > 500) {
        setError("Tek seferde en fazla 500 kayıt aktarabilirsiniz.");
        return;
      }

      setRows(parsed);
      const result = await previewResidentsImport(auth, parsed);
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dosya okunamadı.");
    } finally {
      setPending(false);
    }
  }

  async function onCommit() {
    if (!auth || !preview || pending) return;
    if (preview.errorCount > 0) {
      setError("Hatalı satırlar düzeltilmeden içe aktarılamaz.");
      return;
    }
    if (preview.readyCount === 0) {
      setError("Aktarılacak sakin satırı bulunamadı.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const result = await commitResidentsImport(auth, rows);
      showToast(
        `Sakinler başarıyla aktarıldı. ${result.ownersLinked} mülk sahibi, ${result.tenantsLinked} kiracı kaydedildi.`,
      );
      onImported?.();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İçe aktarma başarısız.");
    } finally {
      setPending(false);
    }
  }

  const canCommit =
    Boolean(preview) && preview!.errorCount === 0 && preview!.readyCount > 0 && !pending;

  return (
    <FormModal
      open={open}
      size="xl"
      title="Sakinleri Toplu Aktar"
      description="Dairelere ait mülk sahibi ve kiracı bilgilerini Excel veya CSV dosyasından aktarın."
      icon={FileSpreadsheet}
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            İptal
          </Button>
          <Button onClick={() => void onCommit()} disabled={!canCommit}>
            {pending ? (
              "Aktarılıyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Sakinleri İçe Aktar
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void downloadResidentsImportTemplate(apartments)}
          >
            <Download className="size-4" aria-hidden />
            Örnek Şablonu İndir
          </Button>
          <label className="inline-flex cursor-pointer items-center">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="sr-only"
              onChange={(event) => void onFileChange(event)}
            />
            <span className="inline-flex h-8 items-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium hover:bg-canvas">
              Excel / CSV Seç
            </span>
          </label>
          {fileName ? <span className="text-sm text-muted">{fileName}</span> : null}
        </div>

        <p className="text-[13px] text-muted">
          {needsBuilding
            ? "Aynı daire numarası birden fazla binada var; şablonda Bina kolonu zorunludur."
            : "Daire numaraları site genelinde tekil; Bina kolonu gerekmez."}{" "}
          Şablonu indirip Excel’de doldurun, ardından aynı .xlsx dosyasını yükleyin. En fazla 500 satır.
        </p>

        {preview ? (
          <div className="space-y-3 rounded-md border border-line bg-canvas/50 p-3">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted">Satır:</span>{" "}
                <span className="font-medium">{preview.rowCount}</span>
              </div>
              <div>
                <span className="text-muted">Eşleşen daire:</span>{" "}
                <span className="font-medium">{preview.matchedApartmentCount}</span>
              </div>
              <div>
                <span className="text-muted">Mülk sahibi:</span>{" "}
                <span className="font-medium">{preview.ownerCount}</span>
              </div>
              <div>
                <span className="text-muted">Kiracı:</span>{" "}
                <span className="font-medium">{preview.tenantCount}</span>
              </div>
              <div>
                <span className="text-muted">Uyarı:</span>{" "}
                <span className="font-medium">{preview.warningCount}</span>
              </div>
              <div>
                <span className="text-muted">Hata:</span>{" "}
                <span className="font-medium text-danger">{preview.errorCount}</span>
              </div>
            </div>

            {preview.readyCount > 0 && preview.errorCount === 0 ? (
              <p className="text-[13px] text-muted">
                {preview.ownerCount} mülk sahibi ve {preview.tenantCount} kiracı aktarılacak.
              </p>
            ) : null}

            {preview.errors.length > 0 ? (
              <div>
                <p className="mb-1 text-[13px] font-medium text-danger">Hatalar</p>
                <ul className="max-h-28 overflow-y-auto text-[13px] text-danger">
                  {preview.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.warnings.length > 0 ? (
              <div>
                <p className="mb-1 text-[13px] font-medium text-warning">Uyarılar</p>
                <ul className="max-h-28 overflow-y-auto text-[13px] text-muted">
                  {preview.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="hidden max-h-64 overflow-auto md:block">
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Daire</TH>
                      <TH>Mülk Sahibi</TH>
                      <TH>Kiracı</TH>
                      <TH>Durum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {preview.rows.map((row) => (
                      <TR key={row.line}>
                        <TD>
                          {row.buildingName ? `${row.buildingName} / ` : ""}
                          {row.apartmentNumber || "—"}
                        </TD>
                        <TD>{row.ownerLabel ?? "—"}</TD>
                        <TD>{row.tenantLabel ?? "—"}</TD>
                        <TD
                          className={
                            row.status === "error"
                              ? "text-danger"
                              : row.status === "warning"
                                ? "text-warning"
                                : undefined
                          }
                        >
                          {statusLabel(row.status)}
                          {row.errors[0] ? ` — ${row.errors[0]}` : ""}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableElement>
              </Table>
            </div>

            <div className="space-y-2 md:hidden">
              {preview.rows.map((row) => (
                <div key={row.line} className="rounded-md border border-line bg-white p-3 text-[13px]">
                  <p className="font-medium">
                    {row.buildingName ? `${row.buildingName} / ` : ""}
                    {row.apartmentNumber || "—"}
                  </p>
                  <p className="text-muted">Mülk sahibi: {row.ownerLabel ?? "—"}</p>
                  <p className="text-muted">Kiracı: {row.tenantLabel ?? "—"}</p>
                  <p
                    className={
                      row.status === "error"
                        ? "text-danger"
                        : row.status === "warning"
                          ? "text-warning"
                          : "text-muted"
                    }
                  >
                    {statusLabel(row.status)}
                    {row.errors[0] ? ` — ${row.errors[0]}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>
    </FormModal>
  );
}
