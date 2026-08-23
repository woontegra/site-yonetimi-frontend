"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Home, Users } from "lucide-react";
import { ResidentQuickModal } from "@/components/setup/ResidentQuickModal";
import { ResidentsImportModal, downloadResidentsImportTemplate } from "@/components/setup/ResidentsImportModal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import type { RelationType } from "@/lib/person-constants";
import { listRelations, type ApartmentPersonRelation } from "@/lib/relations-api";
import {
  bulkCreateApartments,
  bulkCreateBuildings,
  getSetupSummary,
  updateSetupStatus,
  type SetupSummary,
} from "@/lib/site-setup-api";

const STEPS = [
  { id: "site", label: "Site", icon: Home },
  { id: "structure", label: "Yapı ve Daireler", icon: Building2 },
  { id: "residents", label: "Sakinler", icon: Users },
  { id: "review", label: "Kontrol", icon: CheckCircle2 },
] as const;

type StructureType = "single" | "multi" | "villa" | "other";

type BlockDraft = { id: string; name: string; count: string };

type PreviewApartment = {
  key: string;
  buildingName: string;
  number: string;
  floor: string;
  roomType: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function generateNumbers(start: number, end: number, prefix = ""): string[] {
  const nums: string[] = [];
  for (let i = start; i <= end; i++) nums.push(`${prefix}${i}`);
  return nums;
}

function generateCount(count: number, prefix = ""): string[] {
  return generateNumbers(1, count, prefix);
}

/** "1, 2, … 10" doğal sıra; A1/Villa 2 gibi değerlerde numeric localeCompare. */
function compareApartmentNumbers(a: string, b: string): number {
  return a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });
}

type SiteSetupWizardProps = {
  open: boolean;
  initialStep?: number;
  onClose: () => void;
  onCompleted?: () => void;
};

export function SiteSetupWizard({
  open,
  initialStep = 0,
  onClose,
  onCompleted,
}: SiteSetupWizardProps) {
  const router = useRouter();
  const auth = useApiAuth({ requireSite: true });
  const { siteId, site, refreshSites } = useActiveSite();
  const { showToast } = useToast();

  const [step, setStep] = useState(initialStep);
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Step 2 state
  const [structureType, setStructureType] = useState<StructureType>("single");
  const [singleBuildingName, setSingleBuildingName] = useState("Ana Bina");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("10");
  const [unitCount, setUnitCount] = useState("10");
  const [numberPrefix, setNumberPrefix] = useState("");
  const [blocks, setBlocks] = useState<BlockDraft[]>([
    { id: uid(), name: "A Blok", count: "10" },
  ]);
  const [villaBuildingName, setVillaBuildingName] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewApartment[]>([]);
  const [createPending, setCreatePending] = useState(false);

  // Step 3 state — source of truth: backend apartment list (not structure preview)
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [relations, setRelations] = useState<ApartmentPersonRelation[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [residentsError, setResidentsError] = useState("");
  const [residentModal, setResidentModal] = useState<{
    apartmentId: string;
    relationType: RelationType;
  } | null>(null);
  const [residentsImportOpen, setResidentsImportOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!auth) return;
    setSummaryLoading(true);
    try {
      const data = await getSetupSummary(auth);
      setSummary(data);
      if (data.site.setupStatus === "NOT_STARTED") {
        await updateSetupStatus(auth, "IN_PROGRESS");
        setSummary((current) =>
          current
            ? { ...current, site: { ...current.site, setupStatus: "IN_PROGRESS" } }
            : current,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Özet yüklenemedi.");
    } finally {
      setSummaryLoading(false);
    }
  }, [auth]);

  const loadResidents = useCallback(async () => {
    if (!auth) return;
    setResidentsLoading(true);
    setResidentsError("");
    try {
      const allApartments: Apartment[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await listApartments(auth, { page, perPage: 100, status: "aktif" });
        allApartments.push(...result.items);
        total = result.total;
        page += 1;
      } while (allApartments.length < total && page <= 20);

      allApartments.sort((a, b) => {
        const byBuilding = a.building.name.localeCompare(b.building.name, "tr", {
          sensitivity: "base",
        });
        if (byBuilding !== 0) return byBuilding;
        return compareApartmentNumbers(a.number, b.number);
      });
      setApartments(allApartments);

      // Relations are secondary; a failed relations call must not wipe apartments.
      // Backend perPage max is 100 — requesting 500 previously caused 400 and empty UI.
      try {
        const allRelations: ApartmentPersonRelation[] = [];
        let relPage = 1;
        let relTotal = 0;
        do {
          const relationResult = await listRelations(auth, {
            active: true,
            page: relPage,
            perPage: 100,
          });
          allRelations.push(...relationResult.items);
          relTotal = relationResult.total;
          relPage += 1;
        } while (allRelations.length < relTotal && relPage <= 20);
        setRelations(allRelations);
      } catch {
        setRelations([]);
      }
    } catch (err) {
      setApartments([]);
      setRelations([]);
      setResidentsError(
        err instanceof ApiError ? err.message : "Daire listesi yüklenemedi.",
      );
    } finally {
      setResidentsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    setError("");
    setPreviewRows([]);
    void loadSummary();
  }, [open, initialStep, loadSummary]);

  useEffect(() => {
    if (!open || step !== 2) return;
    void loadResidents();
  }, [open, step, loadResidents]);

  useEffect(() => {
    if (!open || step !== 3) return;
    void loadSummary();
  }, [open, step, loadSummary]);

  useEffect(() => {
    if (!open || !site?.name) return;
    setVillaBuildingName((current) => current || `${site.name} Bağımsız Bölümler`);
  }, [open, site?.name]);

  const relationsByApartment = useMemo(() => {
    const map = new Map<string, { owners: ApartmentPersonRelation[]; tenants: ApartmentPersonRelation[] }>();
    for (const rel of relations) {
      const entry = map.get(rel.apartment.id) ?? { owners: [], tenants: [] };
      if (rel.relationType === "OWNER") entry.owners.push(rel);
      else entry.tenants.push(rel);
      map.set(rel.apartment.id, entry);
    }
    return map;
  }, [relations]);

  function buildPreview() {
    const rows: PreviewApartment[] = [];
    const prefix = numberPrefix;

    if (structureType === "single") {
      const start = Number(rangeStart);
      const end = Number(rangeEnd);
      const count = Number(unitCount);
      let numbers: string[] = [];
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        numbers = generateNumbers(start, end, prefix);
      } else if (!Number.isNaN(count) && count > 0) {
        numbers = generateCount(count, prefix);
      }
      for (const number of numbers) {
        rows.push({
          key: uid(),
          buildingName: singleBuildingName.trim() || "Ana Bina",
          number,
          floor: "",
          roomType: "",
        });
      }
    } else if (structureType === "multi" || structureType === "other") {
      for (const block of blocks) {
        const count = Number(block.count);
        if (!block.name.trim() || Number.isNaN(count) || count < 1) continue;
        for (const number of generateCount(count, prefix)) {
          rows.push({
            key: uid(),
            buildingName: block.name.trim(),
            number,
            floor: "",
            roomType: "",
          });
        }
      }
    } else if (structureType === "villa") {
      const count = Number(unitCount);
      const buildingName = villaBuildingName.trim() || "Siteler";
      if (!Number.isNaN(count) && count > 0) {
        for (const number of generateCount(count, prefix)) {
          rows.push({
            key: uid(),
            buildingName,
            number,
            floor: "",
            roomType: "",
          });
        }
      }
    }

    setPreviewRows(rows);
    if (rows.length === 0) {
      setError("Önizleme oluşturulamadı. Alanları kontrol edin.");
    } else {
      setError("");
    }
  }

  function updatePreviewRow(key: string, field: keyof PreviewApartment, value: string) {
    setPreviewRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  async function handleCreateStructure() {
    if (!auth || createPending || previewRows.length === 0) return;
    setCreatePending(true);
    setError("");
    try {
      const byBuilding = new Map<string, PreviewApartment[]>();
      for (const row of previewRows) {
        const list = byBuilding.get(row.buildingName) ?? [];
        list.push(row);
        byBuilding.set(row.buildingName, list);
      }

      const refreshedBefore = summary ?? (await getSetupSummary(auth));
      const buildingIdByName = new Map(
        refreshedBefore.buildings.map((b) => [b.name.toLowerCase(), b.id]),
      );

      for (const [buildingName, rows] of byBuilding) {
        let buildingId = buildingIdByName.get(buildingName.toLowerCase());

        if (!buildingId) {
          const created = await bulkCreateBuildings(auth, [{ name: buildingName }]);
          buildingId = created.buildings[0]?.id;
          if (buildingId) {
            buildingIdByName.set(buildingName.toLowerCase(), buildingId);
          }
        }

        if (!buildingId) continue;

        await bulkCreateApartments(
          auth,
          buildingId,
          rows.map((r) => ({
            number: r.number,
            floor: r.floor.trim() || null,
            roomType: r.roomType.trim() || null,
          })),
        );
      }

      showToast("Yapı oluşturuldu.");
      setPreviewRows([]);
      await loadSummary();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Oluşturma başarısız.");
    } finally {
      setCreatePending(false);
    }
  }

  async function handleSkip() {
    if (!auth || pending) return;
    setPending(true);
    try {
      await updateSetupStatus(auth, "SKIPPED");
      await refreshSites();
      showToast("Kurulum atlandı.");
      onCompleted?.();
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
    } finally {
      setPending(false);
    }
  }

  async function handleComplete() {
    if (!auth || pending) return;
    setPending(true);
    try {
      await updateSetupStatus(auth, "COMPLETED");
      await refreshSites();
      showToast("Site kurulumu tamamlandı.");
      onCompleted?.();
      onClose();
      if (siteId) {
        router.push(`/app/siteler/${siteId}`);
      } else {
        router.push("/app");
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
    } finally {
      setPending(false);
    }
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      if (step === 1) void loadSummary();
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  const locationLine = [summary?.site.city, summary?.site.district].filter(Boolean).join(" / ");

  return (
    <>
      <Modal
        open={open}
        size="wide"
        title="Site Kurulumu"
        description={site?.name ?? summary?.site.name}
        icon={Building2}
        onClose={pending || createPending ? () => undefined : onClose}
        footer={
          <>
            <Button variant="ghost" onClick={() => void handleSkip()} disabled={pending || createPending}>
              Şimdilik Geç
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              {step > 0 ? (
                <Button variant="secondary" onClick={handleBack} disabled={pending || createPending}>
                  Geri
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button onClick={handleNext} disabled={pending || createPending || summaryLoading}>
                  İleri
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => void handleSkip()} disabled={pending}>
                    Şimdilik Geç
                  </Button>
                  <Button onClick={() => void handleComplete()} disabled={pending}>
                    Kurulumu Tamamla
                  </Button>
                </>
              )}
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <nav className="flex flex-wrap gap-1 border-b border-line pb-3">
            {STEPS.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    step === index
                      ? "bg-brand-soft font-medium text-brand"
                      : "text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          {step === 0 ? (
            <div className="space-y-4">
              {summaryLoading ? (
                <p className="text-sm text-muted">Yükleniyor…</p>
              ) : summary ? (
                <>
                  <FormSection title="Site özeti">
                    <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted">Site</dt>
                        <dd className="font-medium">{summary.site.name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Konum</dt>
                        <dd>{locationLine || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Bina</dt>
                        <dd>{summary.counts.buildings}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Daire</dt>
                        <dd>{summary.counts.apartments}</dd>
                      </div>
                    </dl>
                  </FormSection>
                  <p className="text-[13px] text-muted">
                    Bu sihirbaz ile bina, daire ve sakin kayıtlarını hızlıca oluşturabilirsiniz.
                    İstediğiniz adımı atlayabilir veya kurulumu daha sonra tamamlayabilirsiniz.
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              {summary && summary.buildings.length > 0 ? (
                <FormSection title="Mevcut yapı">
                  <ul className="space-y-1 text-sm">
                    {summary.buildings.map((b) => (
                      <li key={b.id} className="flex justify-between rounded-md bg-canvas px-3 py-2">
                        <span className="font-medium">{b.name}</span>
                        <span className="text-muted">{b.apartmentCount} daire</span>
                      </li>
                    ))}
                  </ul>
                </FormSection>
              ) : null}

              <FormSection title="Yapı tipi">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["single", "Tek Bina / Apartman"],
                      ["multi", "Birden Fazla Blok"],
                      ["villa", "Müstakil Ev / Villa"],
                      ["other", "Diğer"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        structureType === value ? "border-brand bg-brand-soft/40" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        name="structure-type"
                        checked={structureType === value}
                        onChange={() => setStructureType(value)}
                        className="accent-brand"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </FormSection>

              {structureType === "single" ? (
                <FormSection title="Tek bina">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Bina adı" htmlFor="sw-building-name">
                      <Input
                        id="sw-building-name"
                        value={singleBuildingName}
                        onChange={(e) => setSingleBuildingName(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Önek (opsiyonel)" htmlFor="sw-prefix">
                      <Input
                        id="sw-prefix"
                        value={numberPrefix}
                        onChange={(e) => setNumberPrefix(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Başlangıç no" htmlFor="sw-start">
                      <Input
                        id="sw-start"
                        type="number"
                        min={1}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Bitiş no" htmlFor="sw-end">
                      <Input
                        id="sw-end"
                        type="number"
                        min={1}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                      />
                    </FormField>
                  </div>
                  <p className="mt-2 text-[13px] text-muted">
                    Veya aralık yerine toplam:{" "}
                    <Input
                      className="inline-block h-8 w-20"
                      type="number"
                      min={1}
                      value={unitCount}
                      onChange={(e) => setUnitCount(e.target.value)}
                    />{" "}
                    daire (1&apos;den N&apos;ye)
                  </p>
                </FormSection>
              ) : null}

              {structureType === "multi" || structureType === "other" ? (
                <FormSection title="Bloklar">
                  <p className="mb-2 text-[13px] text-muted">
                    İpucu: A, B, C, D blokları ekleyebilirsiniz.
                  </p>
                  <div className="space-y-2">
                    {blocks.map((block, index) => (
                      <div key={block.id} className="flex flex-wrap gap-2">
                        <Input
                          className="min-w-[140px] flex-1"
                          placeholder="Blok adı"
                          value={block.name}
                          onChange={(e) =>
                            setBlocks((current) =>
                              current.map((b, i) =>
                                i === index ? { ...b, name: e.target.value } : b,
                              ),
                            )
                          }
                        />
                        <Input
                          className="w-24"
                          type="number"
                          min={1}
                          placeholder="Daire"
                          value={block.count}
                          onChange={(e) =>
                            setBlocks((current) =>
                              current.map((b, i) =>
                                i === index ? { ...b, count: e.target.value } : b,
                              ),
                            )
                          }
                        />
                        {blocks.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setBlocks((current) => current.filter((b) => b.id !== block.id))
                            }
                          >
                            Sil
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      setBlocks((current) => [
                        ...current,
                        {
                          id: uid(),
                          name: `${String.fromCharCode(65 + current.length)} Blok`,
                          count: "10",
                        },
                      ])
                    }
                  >
                    + Blok Ekle
                  </Button>
                </FormSection>
              ) : null}

              {structureType === "villa" ? (
                <FormSection title="Müstakil / villa">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Sistem bina adı" htmlFor="sw-villa-building">
                      <Input
                        id="sw-villa-building"
                        value={villaBuildingName}
                        onChange={(e) => setVillaBuildingName(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Bağımsız bölüm sayısı" htmlFor="sw-villa-count">
                      <Input
                        id="sw-villa-count"
                        type="number"
                        min={1}
                        value={unitCount}
                        onChange={(e) => setUnitCount(e.target.value)}
                      />
                    </FormField>
                  </div>
                </FormSection>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={buildPreview}>
                  Önizleme Oluştur
                </Button>
                {previewRows.length > 0 ? (
                  <Button
                    type="button"
                    onClick={() => void handleCreateStructure()}
                    disabled={createPending}
                  >
                    {createPending ? "Oluşturuluyor..." : `Oluştur (${previewRows.length})`}
                  </Button>
                ) : null}
              </div>

              {previewRows.length > 0 ? (
                <FormSection title={`Önizleme (${previewRows.length})`}>
                  <div className="max-h-56 overflow-y-auto">
                    <Table>
                      <TableElement>
                        <THead>
                          <TR className="hover:bg-transparent">
                            <TH>Bina</TH>
                            <TH>Daire No</TH>
                            <TH>Kat</TH>
                            <TH>Oda Tipi</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {previewRows.map((row) => (
                            <TR key={row.key} className="hover:bg-transparent">
                              <TD>{row.buildingName}</TD>
                              <TD>
                                <Input
                                  className="h-8 w-20"
                                  value={row.number}
                                  onChange={(e) =>
                                    updatePreviewRow(row.key, "number", e.target.value)
                                  }
                                />
                              </TD>
                              <TD>
                                <Input
                                  className="h-8 w-16"
                                  value={row.floor}
                                  onChange={(e) =>
                                    updatePreviewRow(row.key, "floor", e.target.value)
                                  }
                                />
                              </TD>
                              <TD>
                                <Input
                                  className="h-8 w-20"
                                  value={row.roomType}
                                  onChange={(e) =>
                                    updatePreviewRow(row.key, "roomType", e.target.value)
                                  }
                                />
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </TableElement>
                    </Table>
                  </div>
                </FormSection>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              {residentsLoading ? (
                <p className="text-sm text-muted">Daireler yükleniyor…</p>
              ) : residentsError ? (
                <div className="space-y-2">
                  <p className="text-sm text-danger">{residentsError}</p>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void loadResidents()}>
                    Tekrar Dene
                  </Button>
                </div>
              ) : apartments.length === 0 ? (
                <p className="text-sm text-muted">
                  Henüz daire yok. Önce yapı adımında daire oluşturun veya İleri ile devam edin.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">{apartments.length} daire</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void downloadResidentsImportTemplate(apartments)}
                      >
                        Örnek Şablonu İndir
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setResidentsImportOpen(true)}
                      >
                        Excel / CSV ile Sakinleri Aktar
                      </Button>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableElement>
                        <THead>
                          <TR className="hover:bg-transparent">
                            <TH>Bina</TH>
                            <TH>Daire</TH>
                            <TH>Mülk Sahibi</TH>
                            <TH>Kiracı</TH>
                            <TH className="text-right">İşlem</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {apartments.map((apt) => {
                            const rel = relationsByApartment.get(apt.id);
                            const owner = rel?.owners[0]?.person.fullName ?? "—";
                            const tenant = rel?.tenants[0]?.person.fullName ?? "—";
                            return (
                              <TR key={apt.id}>
                                <TD>{apt.building.name}</TD>
                                <TD className="font-medium">{apt.number}</TD>
                                <TD>{owner}</TD>
                                <TD>{tenant}</TD>
                                <TD className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        setResidentModal({
                                          apartmentId: apt.id,
                                          relationType: "OWNER",
                                        })
                                      }
                                    >
                                      + Mülk Sahibi
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        setResidentModal({
                                          apartmentId: apt.id,
                                          relationType: "TENANT",
                                        })
                                      }
                                    >
                                      + Kiracı
                                    </Button>
                                  </div>
                                </TD>
                              </TR>
                            );
                          })}
                        </TBody>
                      </TableElement>
                    </Table>
                  </div>

                  <div className="space-y-2 md:hidden">
                    {apartments.map((apt) => {
                      const rel = relationsByApartment.get(apt.id);
                      return (
                        <div key={apt.id} className="rounded-md border border-line p-3">
                          <p className="font-medium">
                            {apt.building.name} / {apt.number}
                          </p>
                          <p className="mt-1 text-[13px] text-muted">
                            Mülk sahibi: {rel?.owners[0]?.person.fullName ?? "—"}
                          </p>
                          <p className="text-[13px] text-muted">
                            Kiracı: {rel?.tenants[0]?.person.fullName ?? "—"}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setResidentModal({ apartmentId: apt.id, relationType: "OWNER" })
                              }
                            >
                              + Mülk Sahibi
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setResidentModal({ apartmentId: apt.id, relationType: "TENANT" })
                              }
                            >
                              + Kiracı
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {summaryLoading ? (
                <p className="text-sm text-muted">Yükleniyor…</p>
              ) : summary ? (
                <>
                  <FormSection title="Kurulum özeti">
                    <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                      <div>
                        <dt className="text-xs text-muted">Bina</dt>
                        <dd className="text-lg font-semibold">{summary.counts.buildings}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Daire</dt>
                        <dd className="text-lg font-semibold">{summary.counts.apartments}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Mülk sahibi</dt>
                        <dd className="text-lg font-semibold">{summary.counts.owners}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Kiracı</dt>
                        <dd className="text-lg font-semibold">{summary.counts.tenants}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Sakinsiz daire</dt>
                        <dd
                          className={`text-lg font-semibold ${
                            summary.counts.apartmentsWithoutResident > 0 ? "text-warning" : ""
                          }`}
                        >
                          {summary.counts.apartmentsWithoutResident}
                        </dd>
                      </div>
                    </dl>
                  </FormSection>
                  {summary.counts.apartmentsWithoutResident > 0 ? (
                    <p className="text-[13px] text-muted">
                      {summary.counts.apartmentsWithoutResident} dairede henüz mülk sahibi veya
                      kiracı kaydı yok. Kurulumu tamamlayıp daha sonra ekleyebilirsiniz.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      {residentModal ? (
        <ResidentQuickModal
          open
          apartmentId={residentModal.apartmentId}
          relationType={residentModal.relationType}
          onClose={() => setResidentModal(null)}
          onSaved={() => void loadResidents()}
        />
      ) : null}
      <ResidentsImportModal
        open={residentsImportOpen}
        apartments={apartments}
        onClose={() => setResidentsImportOpen(false)}
        onImported={() => void loadResidents()}
      />
    </>
  );
}
