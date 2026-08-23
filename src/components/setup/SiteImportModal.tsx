"use client";

import { useCallback, useRef, useState } from "react";
import { Check, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import {
  commitImport,
  previewImport,
  type ImportPreviewResult,
  type ImportRow,
} from "@/lib/site-setup-api";

const CSV_HEADERS = [
  "Bina",
  "Daire No",
  "Kat",
  "Oda Tipi",
  "Mülk Sahibi Ad",
  "Mülk Sahibi Soyad",
  "Mülk Sahibi Telefon",
  "Kiracı Ad",
  "Kiracı Soyad",
  "Kiracı Telefon",
];

const SAMPLE_ROW = [
  "A Blok",
  "1",
  "1",
  "2+1",
  "Ahmet",
  "Yılmaz",
  "05551234567",
  "",
  "",
  "",
];

function downloadSampleCsv() {
  const bom = "\uFEFF";
  const content = [CSV_HEADERS.join(","), SAMPLE_ROW.join(",")].join("\r\n");
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "site-iceri-aktarma-ornegi.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstCells = parseCsvLine(lines[0]);
  const hasHeader =
    firstCells[0]?.toLowerCase().includes("bina") ||
    firstCells[1]?.toLowerCase().includes("daire");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = parseCsvLine(line);
    return {
      buildingName: cells[0] ?? "",
      apartmentNumber: cells[1] ?? "",
      floor: cells[2] || null,
      roomType: cells[3] || null,
      ownerFirstName: cells[4] || undefined,
      ownerLastName: cells[5] || undefined,
      ownerPhone: cells[6] || undefined,
      tenantFirstName: cells[7] || undefined,
      tenantLastName: cells[8] || undefined,
      tenantPhone: cells[9] || undefined,
    };
  });
}

type SiteImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
};

export function SiteImportModal({ open, onClose, onImported }: SiteImportModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setFileName("");
    setPreview(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    if (pending) return;
    reset();
    onClose();
  }, [pending, reset, onClose]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !auth) return;
    setFileName(file.name);
    setError("");
    setPreview(null);
    setPending(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError("Dosyada geçerli satır bulunamadı.");
        return;
      }
      if (rows.length > 500) {
        setError("En fazla 500 satır içe aktarılabilir.");
        return;
      }
      const result = await previewImport(auth, rows);
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Dosya okunamadı.");
    } finally {
      setPending(false);
    }
  }

  async function handleCommit() {
    if (!auth || !preview || pending) return;
    if (preview.errors.length > 0) {
      setError("Hatalı satırlar düzeltilmeden içe aktarılamaz.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await commitImport(auth, preview.rows);
      showToast(
        `${result.apartmentsCreated} daire, ${result.personsCreated} kişi içe aktarıldı.`,
      );
      onImported?.();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İçe aktarma başarısız.");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormModal
      open={open}
      size="xl"
      title="Excel / CSV İçe Aktar"
      description="Bina, daire ve sakin bilgilerini toplu olarak yükleyin."
      icon={FileSpreadsheet}
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            İptal
          </Button>
          <Button
            onClick={() => void handleCommit()}
            disabled={pending || !preview || preview.errors.length > 0}
          >
            {pending ? (
              "Aktarılıyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                İçe Aktar
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={downloadSampleCsv}>
            Örnek CSV İndir
          </Button>
          <label className="inline-flex cursor-pointer items-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="sr-only"
              onChange={(event) => void handleFileChange(event)}
            />
            <span className="inline-flex h-8 items-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium hover:bg-canvas">
              Dosya Seç
            </span>
          </label>
          {fileName ? <span className="text-sm text-muted">{fileName}</span> : null}
        </div>

        <p className="text-[13px] text-muted">
          Excel dosyalarını CSV olarak kaydedip yükleyebilirsiniz. UTF-8 kodlaması önerilir.
        </p>

        {preview ? (
          <div className="space-y-3 rounded-md border border-line bg-canvas/50 p-3">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted">Daire:</span>{" "}
                <span className="font-medium">{preview.apartmentCount}</span>
              </div>
              <div>
                <span className="text-muted">Mülk sahibi:</span>{" "}
                <span className="font-medium">{preview.ownerCount}</span>
              </div>
              <div>
                <span className="text-muted">Kiracı:</span>{" "}
                <span className="font-medium">{preview.tenantCount}</span>
              </div>
            </div>

            {preview.errors.length > 0 ? (
              <div>
                <p className="mb-1 text-[13px] font-medium text-danger">Hatalar</p>
                <ul className="max-h-32 overflow-y-auto text-[13px] text-danger">
                  {preview.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.warnings.length > 0 ? (
              <div>
                <p className="mb-1 text-[13px] font-medium text-warning">Uyarılar</p>
                <ul className="max-h-32 overflow-y-auto text-[13px] text-muted">
                  {preview.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>
    </FormModal>
  );
}
