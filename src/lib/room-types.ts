export const ROOM_TYPES = [
  "Stüdyo (1+0)",
  "1+1",
  "1.5+1",
  "2+0",
  "2+1",
  "2.5+1",
  "2+2",
  "3+0",
  "3+1",
  "3.5+1",
  "3+2",
  "3+3",
  "4+0",
  "4+1",
  "4.5+1",
  "4.5+2",
  "4+2",
  "4+3",
  "4+4",
  "5+1",
  "5+2",
  "5+3",
  "5+4",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export function formatSquareMeters(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} m²`;
}

export function formatApartmentCapacity(
  registered: number,
  capacity: number | null | undefined,
): string {
  if (capacity == null) return `${registered} daire kayıtlı`;
  return `${registered} / ${capacity} daire kayıtlı`;
}

export function isOverApartmentCapacity(
  registered: number,
  capacity: number | null | undefined,
): boolean {
  return capacity != null && registered > capacity;
}

