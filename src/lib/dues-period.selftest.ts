/**
 * Frontend mirror checks. Run: npx tsx src/lib/dues-period.selftest.ts
 */
import {
  computeDueDateIso,
  expandCustomMonths,
  expandFullYear,
  expandPeriodRange,
  MAX_ASSESSMENT_PERIODS,
} from "./dues-period";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(expandPeriodRange(2026, 9, 2026, 9).length === 1, "single");
assert(expandPeriodRange(2026, 9, 2026, 11).length === 3, "range");
assert(expandPeriodRange(2026, 11, 2027, 2).length === 4, "wrap");
assert(expandFullYear(2027).length === 12, "year");
assert(expandCustomMonths(2026, [1, 3, 6]).length === 3, "custom");
assert(computeDueDateIso(2026, 9, 10) === "2026-09-10", "due 10");
assert(computeDueDateIso(2026, 2, "END") === "2026-02-28", "feb end");
assert(MAX_ASSESSMENT_PERIODS === 24, "max 24");
console.log("frontend dues-period.selftest: OK");
