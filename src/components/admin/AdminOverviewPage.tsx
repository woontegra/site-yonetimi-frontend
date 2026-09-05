"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { ADMIN_TOOL_CARDS } from "@/components/admin/adminCards";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/cn";

const toneMap = {
  blue: "bg-sky-50 text-sky-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
} as const;

export function AdminOverviewPage() {
  const readyCount = ADMIN_TOOL_CARDS.filter((c) => c.ready).length;
  const total = ADMIN_TOOL_CARDS.length;

  return (
    <PageContainer>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
            <Shield className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-page font-semibold text-ink">Admin Paneli</h1>
            <p className="mt-1 text-[12px] font-normal text-muted">
              Platform müşterilerini, kullanıcıları, lisansları ve sistem durumunu yönetin.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          <span className="rounded-md border border-line bg-surface px-2 py-1">
            {total} yönetim aracı
          </span>
          <span className="rounded-md border border-line bg-surface px-2 py-1">
            {readyCount} hazır · {total - readyCount} uyarı
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_TOOL_CARDS.map((card) => {
          const Icon = card.icon;
          const body = (
            <div
              className={cn(
                "flex h-full flex-col rounded-lg border border-line bg-surface p-3.5 transition-colors duration-micro",
                card.ready ? "hover:border-accent/40" : "opacity-80",
              )}
            >
              <div className={cn("mb-2.5 inline-flex size-8 items-center justify-center rounded-md", toneMap[card.tone])}>
                <Icon className="size-3.5" aria-hidden />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold text-ink">{card.title}</h2>
                {!card.ready ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    Hazırlanıyor
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">{card.description}</p>
              <p className="mt-3 text-[11px] font-medium text-accent">
                {card.ready ? "Yönetim sayfasına git →" : "Altyapı bekleniyor"}
              </p>
            </div>
          );

          if (!card.ready || !card.href) {
            return (
              <div key={card.title} aria-disabled="true">
                {body}
              </div>
            );
          }

          return (
            <Link key={card.title} href={card.href} className="block focus-visible:outline-none">
              {body}
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
