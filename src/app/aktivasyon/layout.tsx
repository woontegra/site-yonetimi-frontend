import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hesap etkinleştirme",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export function headers() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
  };
}

export default function AktivasyonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
