import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hesap etkinleştirme",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Cache/Referrer güvenlik header’ları `middleware.ts` içinde `/aktivasyon` için set edilir. */
export default function AktivasyonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
