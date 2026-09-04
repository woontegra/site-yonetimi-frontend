/**
 * Targeted checks for normalizeApiError + toast helpers (no network).
 * Run: npx tsx scripts/verify-toast-system.ts
 */
import { ApiError } from "../src/lib/http-core";
import { isErrorHandled, markErrorHandled, normalizeApiError } from "../src/lib/api-error";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const cases: Array<{ name: string; error: unknown; expectIncludes: string }> = [
  {
    name: "401",
    error: new ApiError(401, "whatever", "AUTH_SESSION_EXPIRED"),
    expectIncludes: "yeniden giriş",
  },
  {
    name: "403",
    error: new ApiError(403, "nope"),
    expectIncludes: "yetkiniz",
  },
  {
    name: "404",
    error: new ApiError(404, "missing"),
    expectIncludes: "bulunamadı",
  },
  {
    name: "409 duplicate dues",
    error: new ApiError(409, "B Blok için Eylül 2026 aidatı zaten oluşturulmuş.", "DUES_PERIOD_EXISTS"),
    expectIncludes: "Eylül 2026",
  },
  {
    name: "500 hides prisma",
    error: new ApiError(500, "PrismaClientKnownRequestError: Unique constraint"),
    expectIncludes: "beklenmeyen",
  },
  {
    name: "network",
    error: new ApiError(0, "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip yeniden deneyin."),
    expectIncludes: "İnternet",
  },
  {
    name: "timeout",
    error: new Error("Request timed out after 30s"),
    expectIncludes: "sürede tamamlanamadı",
  },
];

for (const c of cases) {
  const n = normalizeApiError(c.error);
  assert(
    n.userMessage.toLowerCase().includes(c.expectIncludes.toLowerCase()) ||
      n.userMessage.includes(c.expectIncludes),
    `${c.name}: got "${n.userMessage}"`,
  );
  assert(!/prisma|axios|failed to fetch|jwt/i.test(n.userMessage), `${c.name}: technical leak`);
}

const err = new ApiError(500, "x");
assert(!isErrorHandled(err), "not handled yet");
markErrorHandled(err);
assert(isErrorHandled(err), "marked handled");

console.log("verify-toast-system: OK", cases.length, "cases");
