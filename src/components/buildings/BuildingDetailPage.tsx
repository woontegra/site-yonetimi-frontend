"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  BuildingFormModal,
  buildingToForm,
  formToPayload,
  type BuildingFormValues,
} from "@/components/buildings/BuildingFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/http";
import { getBuilding, updateBuilding, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "daireler", label: "Daireler" },
  { id: "hareketler", label: "Hareketler" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function BuildingDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready, token, tenantId } = useAuth();
  const { showToast } = useToast();
  const auth = useMemo(
    () => (token && tenantId ? { token, tenantId } : null),
    [token, tenantId],
  );

  const [building, setBuilding] = useState<Building | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getBuilding(auth, params.id);
      setBuilding(result.building);
    } catch (err) {
      setBuilding(null);
      setError(err instanceof ApiError ? err.message : "Bina yüklenemedi.");
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleSubmit(values: BuildingFormValues) {
    if (!auth || !building || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const result = await updateBuilding(auth, building.id, formToPayload(values));
      setBuilding(result.building);
      setFormOpen(false);
      showToast("Bina güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  const address = [building?.district, building?.city].filter(Boolean).join(" / ");

  return (
    <PageContainer>
      <Link
        href="/app/binalar"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Binalar
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {building ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-[24px] font-semibold leading-none text-ink">{building.name}</h1>
            <Button onClick={() => setFormOpen(true)}>Düzenle</Button>
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-line pb-5 md:grid-cols-5">
            <InfoItem label="Bina kodu" value={building.code || "—"} />
            <InfoItem label="Daire sayısı" value={String(building.apartmentCount)} />
            <InfoItem label="Kat sayısı" value={String(building.floorCount)} />
            <div>
              <dt className="text-xs text-muted">Durum</dt>
              <dd className="mt-0.5">
                <StatusBadge active={building.isActive} />
              </dd>
            </div>
            <InfoItem
              label="Adres"
              value={
                [address, building.address].filter(Boolean).join(" · ") || "—"
              }
            />
          </dl>

          <div className="mb-4 flex gap-1 border-b border-line">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors duration-micro",
                  tab === item.id
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "genel" ? (
            <p className="text-sm text-muted">
              {building.description || "Bu bina için henüz açıklama girilmedi."}
            </p>
          ) : null}

          {tab === "daireler" ? (
            <p className="py-6 text-sm text-muted">Henüz daire bulunmuyor.</p>
          ) : null}

          {tab === "hareketler" ? (
            <p className="py-6 text-sm text-muted">Henüz hareket bulunmuyor.</p>
          ) : null}

          <BuildingFormModal
            open={formOpen}
            title="Binayı Düzenle"
            initialValues={buildingToForm(building)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
