"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MESSAGE_STATUS_LABELS } from "@/components/admin/labels";
import { useAuth } from "@/lib/auth-context";
import { useAdminAuth } from "@/lib/active-site-context";
import { getAdminCommunication } from "@/lib/admin-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";

export function AdminCommunicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useAuth();
  const auth = useAdminAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    tenant: { id: string; name: string };
    site: { id: string; name: string };
    toPhoneMasked: string;
    template: string;
    provider: string | null;
    status: string;
    errorAt: string | null;
    errorSummary: string | null;
    createdAt: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!auth || !id) return;
    setLoading(true);
    setError("");
    try {
      const result = await getAdminCommunication(auth, id);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mesaj yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  if (loading && !message) return <PageContainer><p className="text-sm text-muted">Yükleniyor…</p></PageContainer>;
  if (error || !message) return <PageContainer><p className="text-sm text-danger">{error || "Mesaj bulunamadı."}</p></PageContainer>;

  return (
    <PageContainer>
      <DetailHeader
        backHref="/app/admin/iletisim"
        backLabel="İletişime dön"
        title="Mesaj detayı"
        status={
          <StatusBadge
            label={MESSAGE_STATUS_LABELS[message.status] ?? message.status}
            status={message.status === "FAILED" ? "failed" : "active"}
          />
        }
      />
      <div className="max-w-xl space-y-2 text-sm">
        <p>
          <span className="text-muted">Tenant:</span>{" "}
          <Link href={`/app/admin/tenantlar/${message.tenant.id}`} className="hover:text-accent">{message.tenant.name}</Link>
        </p>
        <p><span className="text-muted">Site:</span> {message.site.name}</p>
        <p><span className="text-muted">Alıcı:</span> {message.toPhoneMasked}</p>
        <p><span className="text-muted">Kanal / şablon:</span> {message.template}</p>
        <p><span className="text-muted">Sağlayıcı:</span> {message.provider || "—"}</p>
        <p><span className="text-muted">Hata zamanı:</span> {formatDateTr(message.errorAt ?? message.createdAt)}</p>
        <p><span className="text-muted">Hata özeti:</span> {message.errorSummary || "—"}</p>
      </div>
    </PageContainer>
  );
}
