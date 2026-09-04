/**
 * Run: npx tsx src/lib/bank-statement-counterparty.selftest.ts
 */
import assert from "node:assert/strict";
import {
  extractApartmentNumberCandidate,
  isGenericMatchKey,
  parseCounterpartyFromDescription,
} from "./bank-statement-counterparty";

{
  const info = parseCounterpartyFromDescription(
    "EFT Gelen Serdar Topal Eylül aidatı Ref: 123456",
    "CREDIT",
  );
  assert.equal(info.counterpartyName, "Serdar Topal");
  assert.equal(info.counterpartyRole, "sender");
  assert.equal(info.channel, "EFT");
  assert.ok(info.referenceHint);
}

{
  const info = parseCounterpartyFromDescription(
    "Gönderen: Ayşe Yılmaz FAST TR330006100519786457841326 aidat",
    "CREDIT",
  );
  assert.ok(info.counterpartyName?.includes("Ayşe") || info.counterpartyName?.includes("Ayse"));
  assert.ok(info.counterpartyIbanMasked?.startsWith("TR33"));
}

{
  const info = parseCounterpartyFromDescription("Market POS alışveriş 250,00", "DEBIT");
  assert.equal(info.counterpartyName, null);
  assert.equal(info.channel, "POS");
}

{
  const raw = "-00:29:22 Sistem FA FAST Serdar Topal*Ağustos daire 6*FAST";
  const info = parseCounterpartyFromDescription(raw, "CREDIT");
  assert.equal(info.counterpartyName, "Serdar Topal");
  assert.equal(info.counterpartyNameCandidate, "Serdar Topal");
  assert.equal(info.apartmentNumberCandidate, "6");
  assert.equal(info.transactionChannel, "FAST");
  assert.ok(info.paymentNote?.toLocaleLowerCase("tr-TR").includes("daire"));
  assert.equal(extractApartmentNumberCandidate(raw), "6");
}

{
  const info = parseCounterpartyFromDescription(
    "Sistem FA FAST Serdar Topal*Ağustos daire 6*FAST",
    "CREDIT",
  );
  assert.equal(info.counterpartyName, "Serdar Topal");
  assert.equal(info.apartmentNumberCandidate, "6");
}

assert.equal(isGenericMatchKey("EFT"), true);
assert.equal(isGenericMatchKey("Serdar Topal"), false);

console.log("bank-statement-counterparty.selftest: OK");
