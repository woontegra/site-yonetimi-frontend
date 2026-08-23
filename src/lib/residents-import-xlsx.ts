import * as XLSX from "xlsx";
import type { Apartment } from "@/lib/apartments-api";
import type { ResidentImportRow } from "@/lib/site-setup-api";

const SHEET_DATA = "Sakinler";
const SHEET_HELP = "Açıklama";
/** Browser download filename — must end with .xlsx exactly once (no trailing dots). */
const FILE_NAME = "sakin-aktarim-sablonu.xlsx";

const PERSON_HEADERS = [
  "Mülk Sahibi Ad",
  "Mülk Sahibi Soyad",
  "Mülk Sahibi Telefon",
  "Mülk Sahibi E-posta",
  "Kiracı Ad",
  "Kiracı Soyad",
  "Kiracı Telefon",
  "Kiracı E-posta",
] as const;

export function needsBuildingColumn(apartments: Apartment[]): boolean {
  const counts = new Map<string, number>();
  for (const apt of apartments) {
    const key = apt.number.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n > 1);
}

function compareApartmentNumbers(a: string, b: string): number {
  return a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });
}

function sortApartments(apartments: Apartment[]): Apartment[] {
  return [...apartments].sort((a, b) => {
    const byBuilding = a.building.name.localeCompare(b.building.name, "tr", {
      numeric: true,
      sensitivity: "base",
    });
    if (byBuilding !== 0) return byBuilding;
    return compareApartmentNumbers(a.number, b.number);
  });
}

function templateHeaders(withBuilding: boolean): string[] {
  return withBuilding ? ["Bina", "Daire No", ...PERSON_HEADERS] : ["Daire No", ...PERSON_HEADERS];
}

function helpLines(withBuilding: boolean): string[] {
  const lines = [
    "Kullanım",
    "",
    "Daire No alanını değiştirmeden ilgili dairenin mülk sahibi ve/veya kiracı bilgilerini doldurun.",
    "Mülk sahibi veya kiracı olmayan alanları boş bırakabilirsiniz.",
    "Telefon numaralarını 05XXXXXXXXX formatında girebilirsiniz.",
    "Dosyayı tamamladıktan sonra Site Kurulumu > Sakinler > Excel / CSV ile Sakinleri Aktar alanından yükleyin.",
  ];
  if (withBuilding) {
    lines.push(
      "",
      "Bina kolonu",
      "Aynı daire numarası birden fazla binada bulunduğu için Bina kolonu zorunludur. Bina adını değiştirmeyin.",
    );
  }
  lines.push(
    "",
    "Örnek (Açıklama sayfasındadır; Sakinler sayfasına örnek kişi yazmayın)",
    withBuilding
      ? "Bina: A Blok | Daire No: 1 | Mülk Sahibi Ad: … | Mülk Sahibi Soyad: … | Mülk Sahibi Telefon: 05XXXXXXXXX"
      : "Daire No: 1 | Mülk Sahibi Ad: … | Mülk Sahibi Soyad: … | Mülk Sahibi Telefon: 05XXXXXXXXX",
  );
  return lines;
}

function columnWidths(headers: string[]): XLSX.ColInfo[] {
  return headers.map((header) => {
    if (header === "Bina") return { wch: 18 };
    if (header === "Daire No") return { wch: 12 };
    if (header.includes("Telefon")) return { wch: 18 };
    if (header.includes("E-posta")) return { wch: 24 };
    if (header.includes("Soyad")) return { wch: 16 };
    return { wch: 16 };
  });
}

function colLetter(index1Based: number): string {
  let n = index1Based;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function workbookToBlob(workbook: XLSX.WorkBook): Blob {
  // Prefer binary string — most reliable across SheetJS browser builds.
  // (type:"array" returns ArrayBuffer; Uint8Array.from(ArrayBuffer) wrongly yields length 0.)
  const binary = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "binary",
  }) as string;

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (blob.size < 100) {
    throw new Error("Excel dosyası oluşturulamadı (boş çıktı).");
  }
  return blob;
}

export function buildResidentsImportXlsx(apartments: Apartment[]): Blob {
  const withBuilding = needsBuildingColumn(apartments);
  const headers = templateHeaders(withBuilding);
  const sorted = sortApartments(apartments);

  const dataRows: (string | number)[][] = [headers];
  for (const apt of sorted) {
    if (withBuilding) {
      dataRows.push([apt.building.name, apt.number, "", "", "", "", "", "", "", ""]);
    } else {
      dataRows.push([apt.number, "", "", "", "", "", "", "", ""]);
    }
  }

  const dataSheet = XLSX.utils.aoa_to_sheet(dataRows);
  dataSheet["!cols"] = columnWidths(headers);
  dataSheet["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
  if (sorted.length > 0) {
    const lastCol = colLetter(headers.length);
    dataSheet["!autofilter"] = { ref: `A1:${lastCol}${1 + sorted.length}` };
  }

  const helpSheet = XLSX.utils.aoa_to_sheet(helpLines(withBuilding).map((line) => [line]));
  helpSheet["!cols"] = [{ wch: 100 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, SHEET_DATA);
  XLSX.utils.book_append_sheet(workbook, helpSheet, SHEET_HELP);

  return workbookToBlob(workbook);
}

export function downloadResidentsImportTemplate(apartments: Apartment[]) {
  if (!FILE_NAME.endsWith(".xlsx") || FILE_NAME.includes("..")) {
    throw new Error("Geçersiz şablon dosya adı.");
  }
  const blob = buildResidentsImportXlsx(apartments);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", FILE_NAME);
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_500);
}

function cellText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
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

function rowToResident(
  cells: string[],
  map: Record<string, number>,
  needsBuilding: boolean,
): ResidentImportRow {
  if (map.apartment !== undefined || map.building !== undefined) {
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
}

export function parseResidentsXlsx(buffer: ArrayBuffer, needsBuilding: boolean): ResidentImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => name === SHEET_DATA) ??
    workbook.SheetNames.find((name) => name.trim().toLocaleLowerCase("tr") !== "açıklama") ??
    workbook.SheetNames[0];

  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) return [];

  const headerCells = (matrix[0] ?? []).map((v) => cellText(v));
  const map = headerMap(headerCells);
  const hasHeader = map.apartment !== undefined || map.building !== undefined;
  const data = hasHeader ? matrix.slice(1) : matrix;

  return data
    .map((row) => {
      const cells = (row ?? []).map((v) => cellText(v));
      return rowToResident(cells, hasHeader ? map : {}, needsBuilding);
    })
    .filter((row) => row.apartmentNumber.trim() !== "");
}
