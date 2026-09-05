/**
 * Lisans banner varyantları — saf birim testleri.
 * npx tsx --tsconfig tsconfig.json src/components/layout/license-banner-model.test.ts
 */
import {
  buildLicenseBannerCopy,
  resolveLicenseBannerKind,
  type LicenseBannerKind,
} from "./license-banner-model";

type Sub = {
  plan: "DEMO" | "ANNUAL";
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  remainingDays: number;
  isExpired?: boolean;
  readOnly?: boolean;
  startsAt: string;
  endsAt: string;
};

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function sub(partial: Partial<Sub>): Sub {
  return {
    plan: "DEMO",
    status: "ACTIVE",
    startsAt: new Date().toISOString(),
    endsAt: new Date().toISOString(),
    remainingDays: 7,
    ...partial,
  };
}

function main() {
  assert(resolveLicenseBannerKind(sub({ remainingDays: 7 })) === "demo_calm", "demo 7");
  assert(resolveLicenseBannerKind(sub({ remainingDays: 4 })) === "demo_calm", "demo 4");
  assert(resolveLicenseBannerKind(sub({ remainingDays: 3 })) === "demo_3", "demo 3");
  assert(resolveLicenseBannerKind(sub({ remainingDays: 2 })) === "demo_2", "demo 2");
  assert(resolveLicenseBannerKind(sub({ remainingDays: 1 })) === "demo_1", "demo 1");
  assert(resolveLicenseBannerKind(sub({ status: "EXPIRED", remainingDays: -1 })) === "expired", "expired");
  assert(
    resolveLicenseBannerKind(sub({ plan: "ANNUAL", remainingDays: 40 })) === null,
    "aktif yıllık banner yok",
  );
  assert(
    resolveLicenseBannerKind(sub({ plan: "ANNUAL", remainingDays: 20 })) === "annual_30",
    "annual 30",
  );
  assert(
    resolveLicenseBannerKind(sub({ plan: "ANNUAL", remainingDays: 5 })) === "annual_7",
    "annual 7",
  );
  assert(
    resolveLicenseBannerKind(sub({ plan: "ANNUAL", remainingDays: 2 })) === "annual_urgent",
    "annual urgent",
  );

  const kinds: Exclude<LicenseBannerKind, null>[] = [
    "demo_calm",
    "demo_3",
    "demo_1",
    "expired",
    "annual_30",
  ];
  for (const kind of kinds) {
    const copy = buildLicenseBannerCopy(kind, kind === "demo_calm" ? 7 : kind === "demo_3" ? 3 : 1);
    assert(Boolean(copy.title), `${kind} title`);
    assert(Boolean(copy.primaryCta.href), `${kind} cta`);
    assert(copy.primaryCta.href === "/app/lisans/yillik" || copy.primaryCta.href.includes("ayarlar"), "cta href");
    if (kind === "demo_calm") {
      assert(copy.primaryCta.label === "Yıllık Lisansı İncele", "calm cta");
      assert(copy.dismissible === true, "calm dismissible");
    }
    if (kind === "demo_3") {
      assert(copy.primaryCta.label === "Yıllık Lisansa Geç", "urgent cta");
      assert(copy.dismissible === false, "demo3 not dismissible");
    }
    if (kind === "expired") {
      assert(copy.dismissible === false, "expired not dismissible");
      assert(copy.badge === "Salt okunur", "readonly badge");
    }
    assert(!copy.title.toLowerCase().includes("pro"), "no pro naming");
    assert(!copy.body.toLowerCase().includes("standart"), "no standart naming");
  }

  const calm = buildLicenseBannerCopy("demo_calm", 7);
  assert(calm.progress?.day === 1 && calm.progress.total === 7, "progress day 1");
  const mid = buildLicenseBannerCopy("demo_calm", 4);
  assert(mid.progress?.day === 4, "progress day 4");

  console.log("License banner model tests passed.");
}

main();
