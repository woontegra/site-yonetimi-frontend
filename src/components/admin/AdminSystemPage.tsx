"use client";

import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { getAdminSystem, type AdminSystemStatus } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

export function AdminSystemPage() {
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [data, setData] = useState<AdminSystemStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      setData(await getAdminSystem(auth));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sistem durumu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <PageContainer>
      <PageHeader title="Sistem durumu" description="Operasyonel görünürlük. Gizli bilgiler gösterilmez." />
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {loading || !data ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="API" value={data.api.status === "ok" ? "Çalışıyor" : data.api.status} />
            <StatCard label="Veritabanı" value={data.database.reachable ? "Erişilebilir" : "Yok"} />
            <StatCard label="WhatsApp modu" value={data.whatsappProviderMode} />
            <StatCard label="E-posta modu" value={data.emailProviderMode ?? data.encryption?.emailProviderMode ?? "—"} />
            <StatCard label="Ortam" value={data.environment} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SurfaceCard>
              <h2 className="text-section text-ink">Son migration</h2>
              <p className="mt-2 text-sm">{data.lastMigration?.name ?? "—"}</p>
              <p className="mt-1 text-caption text-muted">{formatDateTr(data.lastMigration?.finishedAt)}</p>
            </SurfaceCard>
            <SurfaceCard>
              <h2 className="text-section text-ink">WhatsApp entegrasyonları</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={`Toplam ${data.integrations.whatsappTotal}`} />
                <StatusBadge status="active" label={`Bağlı ${data.integrations.whatsappConnected}`} />
                <StatusBadge status="failed" label={`Hata ${data.integrations.whatsappError}`} />
              </div>
            </SurfaceCard>
            {data.encryption ? (
              <SurfaceCard className="lg:col-span-2">
                <h2 className="text-section text-ink">Şifreleme anahtarı (güvenli özet)</h2>
                <p className="mt-1 text-sm text-muted">
                  Encrypt kaynağı: {data.encryption.encryptUses ?? "yok"}. Anahtar veya SMTP şifresi gösterilmez.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {data.encryption.keys.map((item) => (
                    <li key={item.name} className="break-words rounded-md border border-line bg-slate-50 px-3 py-2">
                      <span className="font-medium">{item.name}</span>
                      {item.present
                        ? ` · uzunluk ${item.length} · fp ${item.fingerprint ?? "—"}`
                        : " · tanımsız"}
                      {item.wrappingQuotes ? " · sarmalayıcı tırnak var" : ""}
                      {item.leadingOrTrailingWhitespace ? " · baş/son boşluk var" : ""}
                      {item.containsNewline ? " · satır sonu var" : ""}
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            ) : null}
          </div>
        </>
      )}
    </PageContainer>
  );
}
