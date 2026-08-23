"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, LogIn } from "lucide-react";
import { SiteContextField } from "@/components/sites/SiteContextField";
import { SiteSelect } from "@/components/sites/SiteSelect";
import { VisitorSelect } from "@/components/visitors/VisitorSelect";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useApartmentsForBuilding, useBuildingsForSite } from "@/hooks/useSiteHierarchy";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { listRelations, type ApartmentPersonRelation } from "@/lib/relations-api";
import {
  dateTimeLocalToIso,
  toDateTimeLocalValue,
  type VisitPayload,
  type Visitor,
} from "@/lib/visits-api";

export const PURPOSE_PRESETS = [
  "Ziyaret",
  "Teslimat",
  "Teknik Servis",
  "Bakım / Onarım",
  "Kurye",
  "Diğer",
] as const;

export type VisitCheckInFormValues = {
  siteId: string;
  visitorId: string;
  visitorLabel: string;
  buildingId: string;
  apartmentId: string;
  hostPersonId: string;
  purposePreset: string;
  purposeCustom: string;
  vehiclePlate: string;
  note: string;
  checkInAt: string;
};

export function emptyVisitCheckInForm(
  locked?: { siteId?: string; buildingId: string; apartmentId: string },
): VisitCheckInFormValues {
  return {
    siteId: locked?.siteId ?? "",
    visitorId: "",
    visitorLabel: "",
    buildingId: locked?.buildingId ?? "",
    apartmentId: locked?.apartmentId ?? "",
    hostPersonId: "",
    purposePreset: "Ziyaret",
    purposeCustom: "",
    vehiclePlate: "",
    note: "",
    checkInAt: toDateTimeLocalValue(),
  };
}

export function resolvePurpose(values: VisitCheckInFormValues): string | undefined {
  if (
    values.purposePreset === "Diğer" ||
    !PURPOSE_PRESETS.includes(values.purposePreset as (typeof PURPOSE_PRESETS)[number])
  ) {
    const custom = values.purposeCustom.trim();
    return custom || undefined;
  }
  if (values.purposePreset === "") return undefined;
  return values.purposePreset;
}

export function validateVisitCheckInForm(values: VisitCheckInFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.visitorId) errors.visitorId = "Misafir seçimi zorunludur.";
  if (!values.siteId) errors.siteId = "Site seçimi zorunludur.";
  if (!values.buildingId) errors.buildingId = "Bina seçimi zorunludur.";
  if (!values.apartmentId) errors.apartmentId = "Daire seçimi zorunludur.";
  return errors;
}

export function visitCheckInFormToPayload(values: VisitCheckInFormValues): VisitPayload {
  const purpose = resolvePurpose(values);
  const checkInAt = dateTimeLocalToIso(values.checkInAt);
  return {
    visitorId: values.visitorId,
    apartmentId: values.apartmentId,
    ...(values.hostPersonId ? { hostPersonId: values.hostPersonId } : {}),
    ...(purpose ? { purpose } : {}),
    ...(values.vehiclePlate.trim() ? { vehiclePlate: values.vehiclePlate.trim() } : {}),
    ...(checkInAt ? { checkInAt } : {}),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

type VisitCheckInModalProps = {
  open: boolean;
  auth?: AuthContext | null;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: VisitCheckInFormValues) => Promise<void>;
  onQuickCreateVisitor: () => void;
  lockedApartment?: { siteId?: string; buildingId: string; apartmentId: string; label?: string };
  selectedVisitor?: Visitor | null;
};

export function VisitCheckInModal({
  open,
  auth: authProp = null,
  pending,
  error,
  onClose,
  onSubmit,
  onQuickCreateVisitor,
  lockedApartment,
  selectedVisitor,
}: VisitCheckInModalProps) {
  const apiAuth = useApiAuth({ requireSite: false });
  const auth = authProp ?? apiAuth;
  const { site, sites } = useActiveSite();
  const [values, setValues] = useState<VisitCheckInFormValues>(() =>
    emptyVisitCheckInForm(lockedApartment),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hosts, setHosts] = useState<ApartmentPersonRelation[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);

  const locked = Boolean(lockedApartment);

  const handleClose = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);
  useCloseFormOnSiteChange(open, handleClose);

  const { buildings } = useBuildingsForSite(auth, !locked ? values.siteId || null : null);
  const { apartments, loading: loadingApartments } = useApartmentsForBuilding(
    auth,
    !locked ? values.siteId || null : null,
    !locked ? values.buildingId || null : null,
  );

  const showCustomPurpose =
    values.purposePreset === "Diğer" ||
    (values.purposePreset !== "" &&
      !PURPOSE_PRESETS.includes(values.purposePreset as (typeof PURPOSE_PRESETS)[number]));

  const purposeSelectValue = useMemo(() => {
    if (PURPOSE_PRESETS.includes(values.purposePreset as (typeof PURPOSE_PRESETS)[number])) {
      return values.purposePreset;
    }
    return "Diğer";
  }, [values.purposePreset]);

  useEffect(() => {
    if (!open) return;
    const base = emptyVisitCheckInForm(
      lockedApartment
        ? {
            siteId: lockedApartment.siteId || site?.id || "",
            buildingId: lockedApartment.buildingId,
            apartmentId: lockedApartment.apartmentId,
          }
        : { buildingId: "", apartmentId: "", siteId: site?.id || "" },
    );
    if (!lockedApartment) {
      base.siteId = site?.id || "";
    }
    if (selectedVisitor) {
      base.visitorId = selectedVisitor.id;
      base.visitorLabel = selectedVisitor.phone
        ? `${selectedVisitor.fullName} · ${selectedVisitor.phone}`
        : selectedVisitor.fullName;
    }
    setValues(base);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !selectedVisitor) return;
    setValues((current) => ({
      ...current,
      visitorId: selectedVisitor.id,
      visitorLabel: selectedVisitor.phone
        ? `${selectedVisitor.fullName} · ${selectedVisitor.phone}`
        : selectedVisitor.fullName,
    }));
    setErrors((current) => {
      if (!current.visitorId) return current;
      const next = { ...current };
      delete next.visitorId;
      return next;
    });
  }, [open, selectedVisitor]);

  useEffect(() => {
    if (!open || !auth || !values.apartmentId || !values.siteId) {
      setHosts([]);
      return;
    }
    let cancelled = false;
    setLoadingHosts(true);
    void listRelations(
      { ...auth, siteId: values.siteId },
      {
        apartmentId: values.apartmentId,
        active: true,
        perPage: 100,
      },
    )
      .then((result) => {
        if (!cancelled) setHosts(result.items);
      })
      .catch(() => {
        if (!cancelled) setHosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHosts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auth, values.apartmentId, values.siteId]);

  function update<K extends keyof VisitCheckInFormValues>(key: K, value: VisitCheckInFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "siteId") {
        next.buildingId = "";
        next.apartmentId = "";
        next.hostPersonId = "";
      }
      if (key === "buildingId") {
        next.apartmentId = "";
        next.hostPersonId = "";
      }
      if (key === "apartmentId") {
        next.hostPersonId = "";
      }
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "siteId") {
        delete next.buildingId;
        delete next.apartmentId;
        delete next.hostPersonId;
      }
      if (key === "buildingId") {
        delete next.apartmentId;
        delete next.hostPersonId;
      }
      if (key === "apartmentId") delete next.hostPersonId;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateVisitCheckInForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(values);
  }

  const lockedLabel =
    lockedApartment?.label ||
    [
      sites.find((item) => item.id === values.siteId)?.name || site?.name,
      "Bina",
      "Daire",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <FormModal
      open={open}
      title="Misafir Girişi"
      description="Ziyaretçi girişini kaydedin."
      icon={LogIn}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" form="visit-check-in-form" disabled={pending}>
            {pending ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Giriş Yap
              </>
            )}
          </Button>
        </>
      }
    >
      <form
        id="visit-check-in-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5"
      >
        <FormSection title="Misafir">
          <FormField label="Misafir" htmlFor="visit-visitor" required error={errors.visitorId}>
            <VisitorSelect
              auth={auth}
              value={values.visitorId}
              selectedLabel={values.visitorLabel}
              disabled={pending}
              onCreateNew={onQuickCreateVisitor}
              onChange={(visitorId, visitor) => {
                setValues((current) => ({
                  ...current,
                  visitorId,
                  visitorLabel: visitor
                    ? visitor.phone
                      ? `${visitor.fullName} · ${visitor.phone}`
                      : visitor.fullName
                    : "",
                }));
                setErrors((current) => {
                  if (!current.visitorId) return current;
                  const next = { ...current };
                  delete next.visitorId;
                  return next;
                });
              }}
            />
          </FormField>
        </FormSection>

        <FormSection title="Konum">
          {locked ? (
            <SiteContextField
              label="Konum"
              value={lockedLabel}
              hint="Giriş bu daire kapsamında kaydedilir."
            />
          ) : (
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <SiteSelect
                value={values.siteId}
                onChange={(siteId) => update("siteId", siteId)}
                error={errors.siteId}
              />
              <FormField label="Bina" htmlFor="visit-building" required error={errors.buildingId}>
                <Select
                  id="visit-building"
                  value={values.buildingId}
                  disabled={pending || !values.siteId}
                  invalid={Boolean(errors.buildingId)}
                  onChange={(event) => update("buildingId", event.target.value)}
                >
                  <option value="">
                    {values.siteId ? "Bina seçin" : "Önce site seçin"}
                  </option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Daire" htmlFor="visit-apartment" required error={errors.apartmentId}>
                <Select
                  id="visit-apartment"
                  value={values.apartmentId}
                  disabled={pending || !values.buildingId || loadingApartments}
                  invalid={Boolean(errors.apartmentId)}
                  onChange={(event) => update("apartmentId", event.target.value)}
                >
                  <option value="">
                    {loadingApartments ? "Yükleniyor..." : "Daire seçin"}
                  </option>
                  {apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      {apartment.number}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Ziyaret Edilen" htmlFor="visit-host" className="md:col-span-2">
                <Select
                  id="visit-host"
                  value={values.hostPersonId}
                  disabled={pending || !values.apartmentId || loadingHosts}
                  onChange={(event) => update("hostPersonId", event.target.value)}
                >
                  <option value="">
                    {loadingHosts ? "Yükleniyor..." : "Seçilmedi (opsiyonel)"}
                  </option>
                  {hosts.map((relation) => (
                    <option key={relation.person.id} value={relation.person.id}>
                      {relation.person.fullName}
                      {relation.person.phone ? ` · ${relation.person.phone}` : ""}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          )}
          {locked ? (
            <FormField label="Ziyaret Edilen" htmlFor="visit-host" className="mt-3">
              <Select
                id="visit-host"
                value={values.hostPersonId}
                disabled={pending || !values.apartmentId || loadingHosts}
                onChange={(event) => update("hostPersonId", event.target.value)}
              >
                <option value="">
                  {loadingHosts ? "Yükleniyor..." : "Seçilmedi (opsiyonel)"}
                </option>
                {hosts.map((relation) => (
                  <option key={relation.person.id} value={relation.person.id}>
                    {relation.person.fullName}
                    {relation.person.phone ? ` · ${relation.person.phone}` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
        </FormSection>

        <FormSection title="Ziyaret">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <FormField label="Amaç" htmlFor="visit-purpose-preset">
              <Select
                id="visit-purpose-preset"
                value={purposeSelectValue}
                disabled={pending}
                onChange={(event) => {
                  const next = event.target.value;
                  setValues((current) => ({
                    ...current,
                    purposePreset: next,
                    purposeCustom: next === "Diğer" ? current.purposeCustom : "",
                  }));
                }}
              >
                {PURPOSE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </Select>
            </FormField>
            {showCustomPurpose ? (
              <FormField label="Amaç (serbest)" htmlFor="visit-purpose-custom">
                <Input
                  id="visit-purpose-custom"
                  value={values.purposeCustom}
                  disabled={pending}
                  placeholder="Amaç yazın"
                  onChange={(event) => update("purposeCustom", event.target.value)}
                />
              </FormField>
            ) : null}
            <FormField label="Plaka" htmlFor="visit-plate">
              <Input
                id="visit-plate"
                value={values.vehiclePlate}
                disabled={pending}
                placeholder="34 ABC 123"
                onChange={(event) => update("vehiclePlate", event.target.value)}
              />
            </FormField>
            <FormField label="Giriş Zamanı" htmlFor="visit-check-in">
              <Input
                id="visit-check-in"
                type="datetime-local"
                value={values.checkInAt}
                disabled={pending}
                onChange={(event) => update("checkInAt", event.target.value)}
              />
            </FormField>
            <FormField label="Not" htmlFor="visit-note" className="md:col-span-2">
              <Textarea
                id="visit-note"
                rows={2}
                className="min-h-[64px]"
                value={values.note}
                disabled={pending}
                onChange={(event) => update("note", event.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </form>
    </FormModal>
  );
}
