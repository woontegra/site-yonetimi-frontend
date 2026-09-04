/**
 * Run: npx tsx src/lib/apartment-labels.selftest.ts
 */
import assert from "node:assert/strict";
import {
  apartmentMatchesQuery,
  formatApartmentResidentLabel,
  getApartmentResidentDisplay,
  sortApartmentsByNumber,
} from "./apartment-labels";
import type { Apartment } from "./apartments-api";

function apt(number: string, name = "B Blok", owners: string[] = [], tenants: string[] = []): Apartment {
  return {
    id: `id-${number}`,
    number,
    floor: null,
    roomType: null,
    squareMeters: null,
    hasBalcony: null,
    isActive: true,
    description: null,
    createdAt: "",
    building: { id: "b1", name },
    owners: owners.map((fullName, i) => ({ id: `o-${number}-${i}`, fullName, phone: null })),
    tenants: tenants.map((fullName, i) => ({ id: `t-${number}-${i}`, fullName, phone: null })),
  };
}

const list = [
  apt("6", "B Blok", ["Serdar Topal"]),
  apt("16", "B Blok", ["Ayşe Yılmaz"]),
  apt("8", "B Blok"),
];

assert.equal(apartmentMatchesQuery(list[0]!, ""), true);
assert.equal(apartmentMatchesQuery(list[0]!, "6"), true);
assert.equal(apartmentMatchesQuery(list[1]!, "6"), false);
assert.equal(apartmentMatchesQuery(list[1]!, "16"), true);
assert.equal(apartmentMatchesQuery(list[0]!, "Daire 6"), true);
assert.equal(apartmentMatchesQuery(list[1]!, "Daire 6"), false);
assert.equal(apartmentMatchesQuery(list[0]!, "Serdar"), true);
assert.equal(apartmentMatchesQuery(list[0]!, "Topal"), true);
assert.equal(apartmentMatchesQuery(list[0]!, "Serdar Topal"), true);
assert.equal(apartmentMatchesQuery(list[1]!, "Serdar"), false);

const sorted = sortApartmentsByNumber([apt("10"), apt("2"), apt("1")]).map((a) => a.number);
assert.deepEqual(sorted, ["1", "2", "10"]);

assert.equal(
  formatApartmentResidentLabel({
    buildingName: "B Blok",
    apartmentNumber: "6",
    owners: [{ id: "1", fullName: "Serdar Topal", phone: null }],
    tenants: [],
  }),
  "B Blok · Daire 6 — Serdar Topal",
);

const withTenant = getApartmentResidentDisplay({
  buildingName: "B Blok",
  apartmentNumber: "3",
  owners: [{ id: "1", fullName: "Ahmet Yılmaz", phone: null }],
  tenants: [{ id: "2", fullName: "Ayşe Kaya", phone: null }],
});
assert.equal(withTenant.label, "B Blok · Daire 3 — Ahmet Yılmaz");
assert.equal(withTenant.secondaryLine, "Kiracı: Ayşe Kaya");

const vacant = getApartmentResidentDisplay({
  buildingName: "B Blok",
  apartmentNumber: "99",
  owners: [],
  tenants: [],
});
assert.equal(vacant.personLine, "Kişi atanmamış");

console.log("apartment-labels.selftest: OK");
