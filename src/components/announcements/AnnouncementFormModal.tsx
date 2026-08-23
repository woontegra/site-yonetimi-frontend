"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Bell, Check } from "lucide-react";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBuildingsForSite } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  ANNOUNCEMENT_AUDIENCE_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
  previewAnnouncementAudience,
  type Announcement,
  type AnnouncementAudienceType,
  type AnnouncementPayload,
  type AnnouncementPriority,
  type AnnouncementUpdatePayload,
  type AudiencePreview,
} from "@/lib/announcements-api";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { cn } from "@/lib/cn";
import { toDateInputValue } from "@/lib/money";

export type AnnouncementFormValues = {
  siteId: string;
  title: string;
  content: string;
  audienceType: AnnouncementAudienceType;
  priority: AnnouncementPriority;
  buildingIds: string[];
  filterBuildingIds: string[];
  apartmentIds: string[];
  expiresAt: string;
};

export function emptyAnnouncementForm(siteId = ""): AnnouncementFormValues {
  return {
    siteId,
    title: "",
    content: "",
    audienceType: "ALL_SITE",
    priority: "NORMAL",
    buildingIds: [],
    filterBuildingIds: [],
    apartmentIds: [],
    expiresAt: "",
  };
}

export function announcementToForm(item: Announcement): AnnouncementFormValues {
  return {
    siteId: item.siteId,
    title: item.title,
    content: item.content,
    audienceType: item.audienceType,
    priority: item.priority,
    buildingIds: item.buildings.map((building) => building.id),
    filterBuildingIds:
      item.audienceType === "APARTMENTS"
        ? Array.from(new Set(item.apartments.map((apartment) => apartment.building.id)))
        : [],
    apartmentIds: item.apartments.map((apartment) => apartment.id),
    expiresAt: toDateInputValue(item.expiresAt),
  };
}

export function validateAnnouncementForm(values: AnnouncementFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.siteId) errors.siteId = "Site seçimi zorunludur.";
  if (!values.title.trim()) errors.title = "Başlık zorunludur.";
  if (!values.content.trim()) errors.content = "İçerik zorunludur.";
  if (values.audienceType === "BUILDINGS" && values.buildingIds.length === 0) {
    errors.buildingIds = "En az bir bina seçmelisiniz.";
  }
  if (values.audienceType === "APARTMENTS" && values.apartmentIds.length === 0) {
    errors.apartmentIds = "En az bir daire seçmelisiniz.";
  }
  return errors;
}

export function announcementFormToCreatePayload(
  values: AnnouncementFormValues,
  publish: boolean,
): AnnouncementPayload {
  return {
    title: values.title.trim(),
    content: values.content.trim(),
    audienceType: values.audienceType,
    priority: values.priority,
    buildingIds: values.audienceType === "BUILDINGS" ? values.buildingIds : [],
    apartmentIds: values.audienceType === "APARTMENTS" ? values.apartmentIds : [],
    expiresAt: values.expiresAt.trim() ? values.expiresAt.trim() : null,
    publish,
  };
}

export function announcementFormToUpdatePayload(
  values: AnnouncementFormValues,
): AnnouncementUpdatePayload {
  return {
    title: values.title.trim(),
    content: values.content.trim(),
    audienceType: values.audienceType,
    priority: values.priority,
    buildingIds: values.audienceType === "BUILDINGS" ? values.buildingIds : [],
    apartmentIds: values.audienceType === "APARTMENTS" ? values.apartmentIds : [],
    expiresAt: values.expiresAt.trim() ? values.expiresAt.trim() : null,
  };
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialValues: AnnouncementFormValues;
  pending: boolean;
  error?: string;
  lockSite?: boolean;
  siteLabel?: string;
  onClose: () => void;
  onSubmit: (values: AnnouncementFormValues, action: "draft" | "publish" | "save") => Promise<void>;
};

export function AnnouncementFormModal({
  open,
  mode,
  initialValues,
  pending,
  error,
  lockSite = false,
  siteLabel,
  onClose,
  onSubmit,
}: Props) {
  const auth = useApiAuth({ requireSite: false });
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isEdit = mode === "edit";

  const audiencePreviewKey = useMemo(
    () =>
      JSON.stringify({
        siteId: values.siteId,
        audienceType: values.audienceType,
        buildingIds: values.buildingIds,
        apartmentIds: values.apartmentIds,
      }),
    [values.siteId, values.audienceType, values.buildingIds, values.apartmentIds],
  );
  const debouncedAudienceKey = useDebouncedValue(audiencePreviewKey, 400);

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(auth, values.siteId || null);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
  }, [open, initialValues]);

  useEffect(() => {
    if (!open || !auth || !values.siteId || values.audienceType !== "APARTMENTS") {
      setApartments([]);
      return;
    }
    if (values.filterBuildingIds.length === 0) {
      setApartments([]);
      return;
    }

    let cancelled = false;
    setApartmentsLoading(true);
    void Promise.all(
      values.filterBuildingIds.map((buildingId) =>
        listApartments(
          { ...auth, siteId: values.siteId },
          { buildingId, page: 1, perPage: 200, status: "aktif" },
        ),
      ),
    )
      .then((results) => {
        if (!cancelled) setApartments(results.flatMap((result) => result.items));
      })
      .catch(() => {
        if (!cancelled) setApartments([]);
      })
      .finally(() => {
        if (!cancelled) setApartmentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    auth?.token,
    auth?.tenantId,
    values.siteId,
    values.audienceType,
    values.filterBuildingIds.join(","),
  ]);

  useEffect(() => {
    if (!open || !auth || !values.siteId) {
      setAudiencePreview(null);
      return;
    }

    let parsed: {
      audienceType: AnnouncementAudienceType;
      buildingIds: string[];
      apartmentIds: string[];
    };
    try {
      parsed = JSON.parse(debouncedAudienceKey) as typeof parsed;
    } catch {
      setAudiencePreview(null);
      return;
    }

    if (parsed.audienceType === "BUILDINGS" && parsed.buildingIds.length === 0) {
      setAudiencePreview(null);
      return;
    }
    if (parsed.audienceType === "APARTMENTS" && parsed.apartmentIds.length === 0) {
      setAudiencePreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void previewAnnouncementAudience(
      { ...auth, siteId: values.siteId },
      {
        audienceType: parsed.audienceType,
        buildingIds: parsed.audienceType === "BUILDINGS" ? parsed.buildingIds : undefined,
        apartmentIds: parsed.audienceType === "APARTMENTS" ? parsed.apartmentIds : undefined,
      },
    )
      .then((preview) => {
        if (!cancelled) setAudiencePreview(preview);
      })
      .catch(() => {
        if (!cancelled) setAudiencePreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, auth?.token, auth?.tenantId, values.siteId, debouncedAudienceKey]);

  function update<K extends keyof AnnouncementFormValues>(key: K, value: AnnouncementFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId" || key === "audienceType") {
        next.buildingIds = [];
        next.filterBuildingIds = [];
        next.apartmentIds = [];
      }
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key as string];
      if (key === "siteId" || key === "audienceType") {
        delete next.buildingIds;
        delete next.apartmentIds;
      }
      return next;
    });
  }

  async function submit(action: "draft" | "publish" | "save") {
    if (pending) return;
    const nextErrors = validateAnnouncementForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values, action);
  }

  const lockedSiteName =
    siteLabel || sites.find((item) => item.id === values.siteId)?.name || site?.name || "—";

  const apartmentsByBuilding = useMemo(() => {
    const map = new Map<string, { buildingName: string; items: Apartment[] }>();
    for (const apartment of apartments) {
      const key = apartment.building.id;
      const entry = map.get(key) ?? { buildingName: apartment.building.name, items: [] };
      entry.items.push(apartment);
      map.set(key, entry);
    }
    return Array.from(map.entries());
  }, [apartments]);

  return (
    <FormModal
      open={open}
      title={isEdit ? "Duyuruyu Düzenle" : "Yeni Duyuru"}
      description={
        isEdit
          ? "Duyuru bilgilerini güncelleyin."
          : "Site sakinleri için yeni bir duyuru hazırlayın."
      }
      icon={Bell}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          {isEdit ? (
            <Button type="button" disabled={pending} onClick={() => void submit("save")}>
              {pending ? (
                "Kaydediliyor..."
              ) : (
                <>
                  <Check className="size-4" aria-hidden />
                  Kaydet
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void submit("draft")}
              >
                Taslak Kaydet
              </Button>
              <Button type="button" disabled={pending} onClick={() => void submit("publish")}>
                {pending ? (
                  "Yayınlanıyor..."
                ) : (
                  <>
                    <Check className="size-4" aria-hidden />
                    Yayınla
                  </>
                )}
              </Button>
            </>
          )}
        </>
      }
    >
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submit(isEdit ? "save" : "publish");
        }}
        className="space-y-5"
      >
        <FormSection title="Duyuru">
          <FormField label="Başlık" htmlFor="ann-title" required error={errors.title}>
            <Input
              id="ann-title"
              data-modal-autofocus
              value={values.title}
              invalid={Boolean(errors.title)}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Örn. Su kesintisi bilgilendirmesi"
            />
          </FormField>
          <FormField label="İçerik" htmlFor="ann-content" required error={errors.content}>
            <Textarea
              id="ann-content"
              rows={6}
              className="min-h-[140px]"
              value={values.content}
              invalid={Boolean(errors.content)}
              onChange={(event) => update("content", event.target.value)}
              placeholder="Duyuru metnini yazın..."
            />
          </FormField>
        </FormSection>

        <FormSection title="Hedef Kitle">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            {lockSite || isEdit ? (
              <SiteContextField value={lockedSiteName} hint="Duyuru bu siteye aittir." />
            ) : (
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
              />
            )}
            <FormField label="Hedef Kitle" htmlFor="ann-audience" required>
              <Select
                id="ann-audience"
                value={values.audienceType}
                onChange={(event) =>
                  update("audienceType", event.target.value as AnnouncementAudienceType)
                }
              >
                {(Object.keys(ANNOUNCEMENT_AUDIENCE_LABELS) as AnnouncementAudienceType[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {ANNOUNCEMENT_AUDIENCE_LABELS[key]}
                    </option>
                  ),
                )}
              </Select>
            </FormField>
          </div>

          {values.audienceType === "BUILDINGS" ? (
            <FormField label="Binalar" required error={errors.buildingIds}>
              <CheckboxList
                emptyText="Bu sitede aktif bina yok."
                items={buildings.map((building) => ({ id: building.id, label: building.name }))}
                selectedIds={values.buildingIds}
                onToggle={(id) => update("buildingIds", toggleId(values.buildingIds, id))}
              />
            </FormField>
          ) : null}

          {values.audienceType === "APARTMENTS" ? (
            <div className="space-y-3">
              <FormField label="Binalar" hint="Daire listesini filtrelemek için bina seçin.">
                <CheckboxList
                  emptyText="Bu sitede aktif bina yok."
                  items={buildings.map((building) => ({ id: building.id, label: building.name }))}
                  selectedIds={values.filterBuildingIds}
                  onToggle={(id) => {
                    const nextFilters = toggleId(values.filterBuildingIds, id);
                    setValues((current) => ({
                      ...current,
                      filterBuildingIds: nextFilters,
                      apartmentIds: current.apartmentIds.filter((apartmentId) => {
                        const apartment = apartments.find((item) => item.id === apartmentId);
                        if (!apartment) return true;
                        return nextFilters.includes(apartment.building.id);
                      }),
                    }));
                    setErrors((current) => {
                      const next = { ...current };
                      delete next.apartmentIds;
                      return next;
                    });
                  }}
                />
              </FormField>
              <FormField label="Daireler" required error={errors.apartmentIds}>
                <div className="max-h-56 space-y-3 overflow-y-auto rounded-[10px] border border-line p-2">
                  {values.filterBuildingIds.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted">Önce bina seçin.</p>
                  ) : apartmentsLoading ? (
                    <p className="px-1 py-2 text-sm text-muted">Daireler yükleniyor...</p>
                  ) : apartmentsByBuilding.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted">Seçilen binalarda daire yok.</p>
                  ) : (
                    apartmentsByBuilding.map(([buildingId, group]) => (
                      <div key={buildingId}>
                        <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {group.buildingName}
                        </p>
                        <div className="space-y-0.5">
                          {group.items.map((apartment) => {
                            const checked = values.apartmentIds.includes(apartment.id);
                            return (
                              <label
                                key={apartment.id}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                                  checked ? "bg-brand-soft text-brand" : "hover:bg-canvas",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-line"
                                  checked={checked}
                                  onChange={() =>
                                    update(
                                      "apartmentIds",
                                      toggleId(values.apartmentIds, apartment.id),
                                    )
                                  }
                                />
                                <span>
                                  Daire {apartment.number}
                                  {apartment.floor?.trim() ? (
                                    <span className="text-muted"> · Kat {apartment.floor}</span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </FormField>
            </div>
          ) : null}

          {previewLoading ? (
            <p className="text-xs text-muted">Hedef kitle hesaplanıyor...</p>
          ) : audiencePreview ? (
            <p className="text-xs text-muted">
              {audiencePreview.apartmentCount} daire · {audiencePreview.recipientCount} kişi ·{" "}
              {audiencePreview.withPhoneCount} telefonlu
            </p>
          ) : null}
        </FormSection>

        <FormSection title="Yayın">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Öncelik" htmlFor="ann-priority">
              <Select
                id="ann-priority"
                value={values.priority}
                onChange={(event) => update("priority", event.target.value as AnnouncementPriority)}
              >
                {(Object.keys(ANNOUNCEMENT_PRIORITY_LABELS) as AnnouncementPriority[]).map((key) => (
                  <option key={key} value={key}>
                    {ANNOUNCEMENT_PRIORITY_LABELS[key]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Son Geçerlilik Tarihi" htmlFor="ann-expires" hint="Boş bırakılabilir.">
              <Input
                id="ann-expires"
                type="date"
                value={values.expiresAt}
                onChange={(event) => update("expiresAt", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}

function CheckboxList({
  items,
  selectedIds,
  onToggle,
  emptyText,
}: {
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="px-1 py-2 text-sm text-muted">{emptyText}</p>;
  }

  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-[10px] border border-line p-2">
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);
        return (
          <label
            key={item.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
              checked ? "bg-brand-soft text-brand" : "hover:bg-canvas",
            )}
          >
            <input
              type="checkbox"
              className="size-4 rounded border-line"
              checked={checked}
              onChange={() => onToggle(item.id)}
            />
            <span>{item.label}</span>
          </label>
        );
      })}
    </div>
  );
}
