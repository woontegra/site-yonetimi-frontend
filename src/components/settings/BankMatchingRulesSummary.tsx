"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Landmark } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { settingsUi } from "@/components/settings/settings-ui";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { listBankMatchingRules } from "@/lib/banks-api";
import { ApiError } from "@/lib/http";

/** Ayarlar özeti — CRUD Banka sayfasındadır. */
export function BankMatchingRulesSummary() {
  const { siteId, site, status } = useActiveSite();
  const auth = useApiAuth({ requireSite: true });
  const [count, setCount] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !siteId) {
      setCount(null);
      setActiveCount(null);
      return;
    }
    setError("");
    try {
      const result = await listBankMatchingRules(auth);
      const items = result.items ?? [];
      setCount(items.length);
      setActiveCount(items.filter((item) => item.isActive).length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kurallar yüklenemedi.");
      setCount(null);
      setActiveCount(null);
    }
  }, [auth, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return <p className={settingsUi.help}>Yükleniyor…</p>;
  }

  if (status === "noSites" || !siteId) {
    return (
      <EmptyState
        icon={Building2}
        title="Önce bir site seçin."
        description="Banka eşleştirme kuralları seçili siteye özeldir."
        action={
          <Link href="/app/siteler" className={settingsUi.btnSecondary}>
            Site Seç
          </Link>
        }
        compact
        className="border-0 bg-transparent px-0 py-3"
      />
    );
  }

  return (
    <div className="space-y-2.5">
      <p className={settingsUi.help}>
        Banka açıklamasında belirli bir gönderen veya ifade görüldüğünde hareketi daireyle otomatik
        eşleştirmek için kullanılır.
        {site ? (
          <>
            {" "}
            Seçili site: <span className="text-ink">{site.name}</span>.
          </>
        ) : null}
      </p>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      {!error && count !== null ? (
        <p className={settingsUi.body}>
          <span className="font-medium">{activeCount ?? 0}</span> aktif eşleştirme kuralı
          {count !== activeCount ? ` · ${count} toplam` : null}
        </p>
      ) : null}
      <Link href="/app/muhasebe/bankalar?tab=kurallar" className={settingsUi.btnSecondary}>
        <Landmark className="size-3.5" aria-hidden />
        Banka Eşleştirme Kurallarını Yönet
      </Link>
    </div>
  );
}
