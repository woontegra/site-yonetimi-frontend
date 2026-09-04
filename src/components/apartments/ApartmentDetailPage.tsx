"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  ApartmentFormModal,
  apartmentFormToPayload,
  apartmentToForm,
  type ApartmentFormValues,
} from "@/components/apartments/ApartmentFormModal";
import { DuesExemptionModal } from "@/components/apartments/DuesExemptionModal";
import { EndRelationDialog } from "@/components/persons/EndRelationDialog";
import {
  PersonFormModal,
  emptyPersonForm,
  personFormToPayload,
  type PersonFormValues,
} from "@/components/persons/PersonFormModal";
import {
  RelationFormModal,
  emptyRelationForm,
  relationFormToPayload,
  relationToForm,
  type RelationFormValues,
} from "@/components/persons/RelationFormModal";
import {
  AssetFormModal,
  assetFormToPayload,
  assetPayloadForCreate,
  emptyAssetForm,
  type AssetFormValues,
} from "@/components/assets/AssetFormModal";
import { ResidentQuickModal } from "@/components/setup/ResidentQuickModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { getApartment, updateApartment, type Apartment } from "@/lib/apartments-api";
import {
  EXEMPTION_REASON_LABELS,
  EXEMPTION_TYPE_LABELS,
} from "@/lib/apartment-dues-exemptions-api";
import {
  ASSET_STATUS_LABELS,
  createAsset,
  listAssetCategories,
  listAssets,
  type Asset,
  type AssetCategory,
} from "@/lib/assets-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { listApartmentDebts, type ApartmentDebt } from "@/lib/debts-api";
import {
  DEBT_STATUS_LABELS,
  formatDateTr,
  formatMoney,
  formatPeriod,
} from "@/lib/money";
import { RELATION_TYPE_LABELS, formatPersonDate } from "@/lib/person-constants";
import { createPerson, listPersons, type PersonListItem } from "@/lib/persons-api";
import { createPayment, type PaymentPayload } from "@/lib/payments-api";
import { hasPermission } from "@/lib/permissions";
import {
  createRelation,
  endRelation,
  listRelations,
  updateRelation,
  type ApartmentPersonRelation,
} from "@/lib/relations-api";
import { formatSquareMeters } from "@/lib/room-types";
import { PaymentFormModal } from "@/components/accounting/PaymentFormModal";
import {
  VisitCheckInModal,
  visitCheckInFormToPayload,
  type VisitCheckInFormValues,
} from "@/components/visitors/VisitCheckInModal";
import {
  VisitorFormModal,
  emptyVisitorForm,
  visitorFormToCreatePayload,
  type VisitorFormValues,
} from "@/components/visitors/VisitorFormModal";
import {
  VISIT_STATUS_LABELS,
  createVisit,
  createVisitor,
  formatTimeTr,
  listVisits,
  type Visit,
  type VisitStatus,
  type Visitor,
} from "@/lib/visits-api";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "kisiler", label: "Kişiler" },
  { id: "borclar", label: "Borçlar" },
  { id: "ziyaretler", label: "Ziyaretler" },
  { id: "demirbaslar", label: "Demirbaşlar" },
  { id: "hareketler", label: "Hareketler" },
] as const;

function visitStatusTone(status: VisitStatus) {
  if (status === "INSIDE") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "COMPLETED") return "neutral" as const;
  return "warning" as const;
}

type TabId = (typeof tabs)[number]["id"];

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function balconyLabel(value: boolean | null): string {
  if (value === true) return "Var";
  if (value === false) return "Yok";
  return "—";
}

function RelationGroup({
  title,
  items,
  loading,
  onEdit,
  onEnd,
}: {
  title: string;
  items: ApartmentPersonRelation[];
  loading: boolean;
  onEdit: (relation: ApartmentPersonRelation) => void;
  onEnd: (relation: ApartmentPersonRelation) => void;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Kişi</TH>
              <TH>Telefon</TH>
              <TH>Başlangıç</TH>
              <TH>Ana Kişi</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={5}>
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                </TD>
              </TR>
            ) : null}
            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={5} className="py-6 text-center text-sm text-muted">
                  Kayıt bulunmuyor.
                </TD>
              </TR>
            ) : null}
            {!loading
              ? items.map((relation) => (
                  <TR key={relation.id}>
                    <TD className="font-medium">
                      <Link href={`/app/kisiler/${relation.person.id}`} className="hover:text-brand">
                        {relation.person.fullName}
                      </Link>
                    </TD>
                    <TD>{relation.person.phone || "—"}</TD>
                    <TD>{formatPersonDate(relation.startDate)}</TD>
                    <TD>{relation.isPrimary ? "Evet" : "Hayır"}</TD>
                    <TD className="text-right">
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label="İlişki işlemleri"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem onClick={() => onEdit(relation)}>Düzenle</DropdownItem>
                        <DropdownItem danger onClick={() => onEnd(relation)}>
                          İlişkiyi Sonlandır
                        </DropdownItem>
                      </Dropdown>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>
    </div>
  );
}

export function ApartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { ready, user } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth();
  const { site, siteId } = useActiveSite();

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [error, setError] = useState("");
  const initialTab = tabs.some((item) => item.id === searchParams.get("tab"))
    ? (searchParams.get("tab") as TabId)
    : "genel";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [exemptionOpen, setExemptionOpen] = useState(false);
  const canManageDues = hasPermission(user, "dues.manage") || !(user?.permissions?.length);
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [relations, setRelations] = useState<ApartmentPersonRelation[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [persons, setPersons] = useState<PersonListItem[]>([]);

  const [relationOpen, setRelationOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<ApartmentPersonRelation | null>(null);
  const [relationPending, setRelationPending] = useState(false);
  const [relationError, setRelationError] = useState("");
  const [relationDraft, setRelationDraft] = useState<RelationFormValues | null>(null);

  const [personCreateOpen, setPersonCreateOpen] = useState(false);
  const [personCreatePending, setPersonCreatePending] = useState(false);
  const [personCreateError, setPersonCreateError] = useState("");
  const [residentQuick, setResidentQuick] = useState<"OWNER" | "TENANT" | null>(null);

  const [ending, setEnding] = useState<ApartmentPersonRelation | null>(null);
  const [endPending, setEndPending] = useState(false);

  const [debts, setDebts] = useState<ApartmentDebt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [openDebtTotal, setOpenDebtTotal] = useState("0");
  const [payOpen, setPayOpen] = useState(false);
  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState("");
  const [payPersons, setPayPersons] = useState<PersonListItem[]>([]);
  const [payRelated, setPayRelated] = useState<
    Array<{ id: string; fullName: string; roleLabel: string }>
  >([]);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInPending, setCheckInPending] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [visitorCreateOpen, setVisitorCreateOpen] = useState(false);
  const [visitorCreatePending, setVisitorCreatePending] = useState(false);
  const [visitorCreateError, setVisitorCreateError] = useState("");

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [assetPending, setAssetPending] = useState(false);
  const [assetError, setAssetError] = useState("");

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const [result, buildingList] = await Promise.all([
        getApartment(auth, params.id),
        listBuildings(auth, { status: "aktif", perPage: 100 }),
      ]);
      setApartment(result.apartment);
      setBuildings(buildingList.items);
    } catch (err) {
      setApartment(null);
      setError(err instanceof ApiError ? err.message : "Daire yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadRelations = useCallback(async () => {
    if (!auth || !params.id) return;
    setRelationsLoading(true);
    try {
      const result = await listRelations(auth, {
        apartmentId: params.id,
        active: true,
        perPage: 100,
      });
      setRelations(result.items);
    } catch {
      setRelations([]);
    } finally {
      setRelationsLoading(false);
    }
  }, [auth, params.id]);

  const loadPersons = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listPersons(auth, { status: "aktif", perPage: 100 });
      setPersons(result.items);
    } catch {
      setPersons([]);
    }
  }, [auth]);

  const loadDebts = useCallback(async () => {
    if (!auth || !params.id) return;
    setDebtsLoading(true);
    try {
      const result = await listApartmentDebts(auth, {
        apartmentId: params.id,
        perPage: 100,
      });
      setDebts(result.items);
      const openTotal = result.items
        .filter((item) => item.status === "OPEN" && Number(item.remainingAmount) > 0)
        .reduce((sum, item) => sum + Number(item.remainingAmount), 0);
      setOpenDebtTotal(openTotal.toFixed(2));
    } catch {
      setDebts([]);
      setOpenDebtTotal("0");
    } finally {
      setDebtsLoading(false);
    }
  }, [auth, params.id]);

  const loadVisits = useCallback(async () => {
    if (!auth || !params.id) return;
    setVisitsLoading(true);
    try {
      const result = await listVisits(auth, {
        apartmentId: params.id,
        perPage: 50,
      });
      setVisits(result.items);
    } catch {
      setVisits([]);
    } finally {
      setVisitsLoading(false);
    }
  }, [auth, params.id]);

  const loadAssets = useCallback(async () => {
    if (!auth || !params.id) return;
    setAssetsLoading(true);
    try {
      const [assetsResult, categoriesResult] = await Promise.all([
        listAssets(auth, { apartmentId: params.id, perPage: 100 }),
        listAssetCategories(auth, { status: "hepsi" }),
      ]);
      setAssets(assetsResult.items);
      setAssetCategories(categoriesResult.items);
    } catch {
      setAssets([]);
      setAssetCategories([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || tab !== "kisiler") return;
    void loadRelations();
    void loadPersons();
  }, [ready, tab, loadRelations, loadPersons]);

  useEffect(() => {
    if (!ready || tab !== "borclar") return;
    void loadDebts();
  }, [ready, tab, loadDebts]);

  useEffect(() => {
    if (!ready || tab !== "ziyaretler") return;
    void loadVisits();
  }, [ready, tab, loadVisits]);

  useEffect(() => {
    if (!ready || tab !== "demirbaslar") return;
    void loadAssets();
  }, [ready, tab, loadAssets]);

  async function openPaymentModal() {
    if (!auth || !apartment) return;
    setPayError("");
    try {
      const [personList, relationList, debtList] = await Promise.all([
        listPersons(auth, { status: "aktif", perPage: 100 }),
        listRelations(auth, { apartmentId: apartment.id, active: true, perPage: 50 }),
        listApartmentDebts(auth, { apartmentId: apartment.id, status: "OPEN", perPage: 100 }),
      ]);
      setPayPersons(personList.items);
      setPayRelated(
        relationList.items.map((item) => ({
          id: item.person.id,
          fullName: item.person.fullName,
          roleLabel: RELATION_TYPE_LABELS[item.relationType],
        })),
      );
      setDebts(debtList.items);
      const openTotal = debtList.items
        .filter((item) => Number(item.remainingAmount) > 0)
        .reduce((sum, item) => sum + Number(item.remainingAmount), 0);
      setOpenDebtTotal(openTotal.toFixed(2));
      setPayOpen(true);
    } catch (err) {
      toastError(err, "Tahsilat formu açılamadı.");
    }
  }

  async function handlePayment(payload: PaymentPayload, submitSiteId: string) {
    if (!auth || payPending) return;
    setPayPending(true);
    setPayError("");
    try {
      await createPayment({ ...auth, siteId: submitSiteId || auth.siteId }, payload, crypto.randomUUID());
      showToast("Tahsilat kaydedildi.");
      setPayOpen(false);
      await loadDebts();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Tahsilat kaydedilemedi.");
    } finally {
      setPayPending(false);
    }
  }

  async function handleSubmit(values: ApartmentFormValues) {
    if (!auth || !apartment || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const result = await updateApartment(auth, apartment.id, apartmentFormToPayload(values));
      setApartment(result.apartment);
      setFormOpen(false);
      showToast("Daire güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  function openCreateRelation() {
    if (!apartment) return;
    setEditingRelation(null);
    setRelationError("");
    setRelationDraft(
      emptyRelationForm({
        buildingId: apartment.building.id,
        apartmentId: apartment.id,
      }),
    );
    setRelationOpen(true);
  }

  function openEditRelation(relation: ApartmentPersonRelation) {
    setEditingRelation(relation);
    setRelationError("");
    setRelationDraft(relationToForm(relation));
    setRelationOpen(true);
  }

  async function handleRelationSubmit(values: RelationFormValues) {
    if (!auth || !apartment || relationPending) return;
    setRelationPending(true);
    setRelationError("");
    try {
      const payload = relationFormToPayload({
        ...values,
        buildingId: apartment.building.id,
        apartmentId: apartment.id,
      });
      if (editingRelation) {
        await updateRelation(auth, editingRelation.id, {
          relationType: payload.relationType,
          startDate: payload.startDate,
          isPrimary: payload.isPrimary,
          note: payload.note,
        });
        showToast("İlişki güncellendi.");
      } else {
        await createRelation(auth, payload);
        showToast("İlişki eklendi.");
      }
      setRelationOpen(false);
      setEditingRelation(null);
      setRelationDraft(null);
      await loadRelations();
    } catch (err) {
      setRelationError(err instanceof ApiError ? err.message : "İlişki kaydedilemedi.");
    } finally {
      setRelationPending(false);
    }
  }

  async function handleCreatePerson(values: PersonFormValues) {
    if (!auth || personCreatePending) return;
    setPersonCreatePending(true);
    setPersonCreateError("");
    try {
      const result = await createPerson(auth, personFormToPayload(values));
      showToast("Kişi oluşturuldu.");
      await loadPersons();
      setPersonCreateOpen(false);
      setRelationDraft((current) =>
        emptyRelationForm({
          ...(current ?? {}),
          buildingId: apartment?.building.id,
          apartmentId: apartment?.id,
          personId: result.person.id,
        }),
      );
      setRelationOpen(true);
    } catch (err) {
      setPersonCreateError(err instanceof ApiError ? err.message : "Kişi kaydedilemedi.");
    } finally {
      setPersonCreatePending(false);
    }
  }

  async function handleEndRelation(endDate: string) {
    if (!auth || !ending || endPending) return;
    setEndPending(true);
    try {
      await endRelation(auth, ending.id, endDate);
      showToast("İlişki sonlandırıldı.");
      setEnding(null);
      await loadRelations();
    } catch (err) {
      toastError(err, "İlişki sonlandırılamadı.");
    } finally {
      setEndPending(false);
    }
  }

  function openCheckIn() {
    setCheckInError("");
    setSelectedVisitor(null);
    setCheckInOpen(true);
  }

  async function handleCheckInSubmit(values: VisitCheckInFormValues) {
    if (!auth || checkInPending) return;
    if (!values.siteId) {
      setCheckInError("Site seçimi zorunludur.");
      return;
    }
    setCheckInPending(true);
    setCheckInError("");
    try {
      await createVisit({ ...auth, siteId: values.siteId }, visitCheckInFormToPayload(values));
      showToast("Misafir girişi kaydedildi.");
      setCheckInOpen(false);
      setSelectedVisitor(null);
      await loadVisits();
    } catch (err) {
      setCheckInError(err instanceof ApiError ? err.message : "Giriş kaydedilemedi.");
    } finally {
      setCheckInPending(false);
    }
  }

  async function handleQuickCreateVisitor(values: VisitorFormValues) {
    if (!auth || visitorCreatePending) return;
    setVisitorCreatePending(true);
    setVisitorCreateError("");
    try {
      const result = await createVisitor(auth, visitorFormToCreatePayload(values));
      showToast("Misafir oluşturuldu.");
      setVisitorCreateOpen(false);
      setSelectedVisitor(result.visitor);
    } catch (err) {
      setVisitorCreateError(err instanceof ApiError ? err.message : "Misafir kaydedilemedi.");
    } finally {
      setVisitorCreatePending(false);
    }
  }

  async function handleAssetSubmit(values: AssetFormValues) {
    if (!auth || !apartment || assetPending) return;
    const targetSiteId = values.siteId || auth.siteId || siteId || "";
    if (!targetSiteId) {
      setAssetError("Site seçimi zorunludur.");
      return;
    }
    setAssetPending(true);
    setAssetError("");
    try {
      await createAsset(
        { ...auth, siteId: targetSiteId },
        assetPayloadForCreate(
          assetFormToPayload({
            ...values,
            siteId: targetSiteId,
            buildingId: apartment.building.id,
            apartmentId: apartment.id,
          }),
        ),
      );
      showToast("Demirbaş oluşturuldu.");
      setAssetFormOpen(false);
      await loadAssets();
    } catch (err) {
      setAssetError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setAssetPending(false);
    }
  }

  const owners = relations.filter((item) => item.relationType === "OWNER");
  const tenants = relations.filter((item) => item.relationType === "TENANT");

  return (
    <PageContainer>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {apartment ? (
        <>
          <DetailHeader
            backHref="/app/daireler"
            backLabel="Daireler"
            title={`Daire ${apartment.number}`}
            description={apartment.building.name}
            status={<StatusBadge active={apartment.isActive} />}
            actions={<Button onClick={() => setFormOpen(true)}>Düzenle</Button>}
          />

          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-line pb-5 md:grid-cols-4">
            <InfoItem label="Bina" value={apartment.building.name} />
            <InfoItem label="Daire No" value={apartment.number} />
            <InfoItem label="Kat" value={apartment.floor?.trim() ? apartment.floor : "—"} />
            <InfoItem
              label="Oda Tipi"
              value={apartment.roomType?.trim() ? apartment.roomType : "—"}
            />
            <InfoItem label="Metrekare" value={formatSquareMeters(apartment.squareMeters)} />
            <InfoItem label="Balkon" value={balconyLabel(apartment.hasBalcony)} />
            <div>
              <dt className="text-xs text-muted">Durum</dt>
              <dd className="mt-0.5">
                <StatusBadge active={apartment.isActive} />
              </dd>
            </div>
          </dl>

          <DetailTabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === "genel" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-line bg-surface p-4">
                <h2 className="text-sm font-semibold text-ink">Daire bilgileri</h2>
                <p className="mt-2 text-sm text-muted">
                  {apartment.description || "Bu daire için henüz açıklama girilmedi."}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <InfoItem label="Kullanım" value={apartment.occupancyLabel ?? "—"} />
                  <InfoItem label="Aidat durumu" value={apartment.duesStatus?.label ?? "Normal"} />
                  <InfoItem label="Borç durumu" value={apartment.debtStatus?.label ?? "Borcu yok"} />
                  <InfoItem label="İletişim" value={apartment.primaryPhone || "—"} />
                </dl>
              </section>

              <section className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink">Malikler</h2>
                  <Button size="sm" variant="secondary" onClick={() => setTab("kisiler")}>
                    Yönet
                  </Button>
                </div>
                {(apartment.owners?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted">Malik atanmamış.</p>
                ) : (
                  <ul className="space-y-2">
                    {apartment.owners!.map((owner) => (
                      <li
                        key={owner.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
                      >
                        <div>
                          <Link href={`/app/kisiler/${owner.id}`} className="font-medium hover:text-brand">
                            {owner.fullName}
                          </Link>
                          <p className="text-xs text-muted">{owner.phone || "—"}</p>
                        </div>
                        <Badge tone="success">Malik</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink">Kiracılar / oturanlar</h2>
                  <Button size="sm" variant="secondary" onClick={() => setTab("kisiler")}>
                    Yönet
                  </Button>
                </div>
                {(apartment.tenants?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted">
                    {apartment.occupancy === "OWNER_OCCUPIED"
                      ? "Aktif kiracı yok · Malik oturuyor"
                      : "Aktif kiracı yok · Daire boş"}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {apartment.tenants!.map((tenant) => (
                      <li
                        key={tenant.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
                      >
                        <div>
                          <Link href={`/app/kisiler/${tenant.id}`} className="font-medium hover:text-brand">
                            {tenant.fullName}
                          </Link>
                          <p className="text-xs text-muted">{tenant.phone || "—"}</p>
                        </div>
                        <Badge tone="info">Kiracı</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink">Aktif aidat muafiyeti</h2>
                  {canManageDues ? (
                    <Button size="sm" variant="secondary" onClick={() => setExemptionOpen(true)}>
                      {apartment.duesStatus?.exemption ? "Düzenle" : "Tanımla"}
                    </Button>
                  ) : null}
                </div>
                {apartment.duesStatus?.exemption ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <InfoItem
                      label="Tür"
                      value={
                        EXEMPTION_TYPE_LABELS[apartment.duesStatus.exemption.exemptionType] ??
                        apartment.duesStatus.exemption.exemptionType
                      }
                    />
                    <InfoItem
                      label="Sebep"
                      value={
                        apartment.duesStatus.exemption.reasonLabel ||
                        EXEMPTION_REASON_LABELS[apartment.duesStatus.exemption.reason]
                      }
                    />
                    <InfoItem
                      label="Başlangıç"
                      value={formatDateTr(apartment.duesStatus.exemption.startDate)}
                    />
                    <InfoItem
                      label="Bitiş"
                      value={
                        apartment.duesStatus.exemption.endDate
                          ? formatDateTr(apartment.duesStatus.exemption.endDate)
                          : "Süresiz"
                      }
                    />
                  </dl>
                ) : (
                  <p className="text-sm text-muted">Aktif muafiyet yok.</p>
                )}
              </section>

              <section className="rounded-lg border border-line bg-surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">Açık borç özeti</h2>
                <p className="text-sm text-ink">
                  {apartment.debtStatus?.code === "NONE"
                    ? "Borcu yok"
                    : `${formatMoney(apartment.debtStatus?.openAmount ?? "0")} açık borç`}
                  {apartment.debtStatus?.isOverdue ? " · Vadesi geçmiş" : ""}
                </p>
              </section>

              <section className="rounded-lg border border-line bg-surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">İlişki geçmişi</h2>
                {(apartment.relationHistory?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted">İlişki kaydı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {apartment.relationHistory!.map((rel) => (
                      <li
                        key={rel.id}
                        className="rounded-md border border-line px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={`/app/kisiler/${rel.person.id}`}
                            className="font-medium hover:text-brand"
                          >
                            {rel.person.fullName}
                          </Link>
                          <Badge tone={rel.isActive ? "success" : "neutral"}>
                            {rel.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {RELATION_TYPE_LABELS[rel.relationType] ?? rel.relationType}
                          {" · "}
                          {formatPersonDate(rel.startDate)} – {formatPersonDate(rel.endDate)}
                          {rel.person.phone ? ` · ${rel.person.phone}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {tab === "kisiler" ? (
            <div>
              <div className="mb-4 flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setResidentQuick("OWNER")}>
                  <Plus className="size-4" aria-hidden />
                  Mülk Sahibi Ekle
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setResidentQuick("TENANT")}>
                  <Plus className="size-4" aria-hidden />
                  Kiracı Ekle
                </Button>
                <Button size="sm" onClick={openCreateRelation}>
                  <Plus className="size-4" aria-hidden />
                  İlişki Ekle
                </Button>
              </div>
              <RelationGroup
                title="Mülk Sahipleri"
                items={owners}
                loading={relationsLoading}
                onEdit={openEditRelation}
                onEnd={setEnding}
              />
              <RelationGroup
                title="Kiracılar"
                items={tenants}
                loading={relationsLoading}
                onEdit={openEditRelation}
                onEnd={setEnding}
              />
            </div>
          ) : null}

          {tab === "borclar" ? (
            <div>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink">
                  Toplam Açık Borç: <span className="font-semibold">{formatMoney(openDebtTotal)}</span>
                </p>
                {Number(openDebtTotal) > 0 ? (
                  <Button size="sm" onClick={() => void openPaymentModal()}>
                    <Plus className="size-4" aria-hidden />
                    Tahsilat Ekle
                  </Button>
                ) : null}
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Borç</TH>
                      <TH>Dönem</TH>
                      <TH>Vade</TH>
                      <TH className="text-right">İlk Tutar</TH>
                      <TH className="text-right">Kalan</TH>
                      <TH>Durum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {debtsLoading ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6}>
                          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        </TD>
                      </TR>
                    ) : null}
                    {!debtsLoading && debts.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                          Henüz borç kaydı bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!debtsLoading
                      ? debts.map((debt) => (
                          <TR key={debt.id}>
                            <TD className="font-medium">
                              <Link
                                href={`/app/muhasebe/borclar/${debt.id}`}
                                className="hover:text-brand"
                              >
                                {debt.title}
                              </Link>
                            </TD>
                            <TD>{formatPeriod(debt.periodYear, debt.periodMonth)}</TD>
                            <TD>{formatDateTr(debt.dueDate)}</TD>
                            <TD className="text-right">{formatMoney(debt.originalAmount)}</TD>
                            <TD className="text-right">{formatMoney(debt.remainingAmount)}</TD>
                            <TD>
                              <span className="text-sm">{DEBT_STATUS_LABELS[debt.status]}</span>
                              {debt.dueState === "overdue" ? (
                                <span className="ml-2 text-[11px] font-medium text-danger">
                                  Gecikmiş
                                </span>
                              ) : null}
                            </TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>

              <PaymentFormModal
                open={payOpen}
                mode="multi"
                debts={debts}
                persons={payPersons}
                relatedPersons={payRelated}
                apartmentContext={
                  apartment
                    ? {
                        siteId: auth?.siteId ?? siteId ?? "",
                        label: `${site?.name || "Site"} · ${apartment.building.name} · Daire ${apartment.number}`,
                      }
                    : null
                }
                apartmentLabel={`Daire ${apartment.number}`}
                openDebtTotal={openDebtTotal}
                pending={payPending}
                error={payError}
                onClose={() => (payPending ? undefined : setPayOpen(false))}
                onSubmit={handlePayment}
              />
            </div>
          ) : null}
          {tab === "ziyaretler" ? (
            <div>
              <div className="mb-4 flex justify-end">
                <Button size="sm" onClick={openCheckIn}>
                  <Plus className="size-4" aria-hidden />
                  Misafir Girişi
                </Button>
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Tarih</TH>
                      <TH>Misafir</TH>
                      <TH>Giriş</TH>
                      <TH>Çıkış</TH>
                      <TH>Amaç</TH>
                      <TH>Durum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {visitsLoading ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6}>
                          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        </TD>
                      </TR>
                    ) : null}
                    {!visitsLoading && visits.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                          Bu daire için ziyaret kaydı bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!visitsLoading
                      ? visits.map((visit) => (
                          <TR key={visit.id}>
                            <TD>
                              <Link
                                href={`/app/misafirler/ziyaretler/${visit.id}`}
                                className="hover:text-brand"
                              >
                                {formatDateTr(visit.checkInAt)}
                              </Link>
                            </TD>
                            <TD className="font-medium">
                              <Link
                                href={`/app/misafirler/${visit.visitor.id}`}
                                className="hover:text-brand"
                              >
                                {visit.visitor.fullName}
                              </Link>
                            </TD>
                            <TD>{formatTimeTr(visit.checkInAt)}</TD>
                            <TD>{formatTimeTr(visit.checkOutAt)}</TD>
                            <TD>{visit.purpose || "—"}</TD>
                            <TD>
                              <Badge tone={visitStatusTone(visit.status)}>
                                {VISIT_STATUS_LABELS[visit.status]}
                              </Badge>
                            </TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>

              <VisitCheckInModal
                open={checkInOpen}
                auth={auth}
                pending={checkInPending}
                error={checkInError}
                selectedVisitor={selectedVisitor}
                lockedApartment={
                  apartment
                    ? {
                        siteId: auth?.siteId ?? siteId ?? "",
                        buildingId: apartment.building.id,
                        apartmentId: apartment.id,
                        label: `${site?.name || "Site"} · ${apartment.building.name} · Daire ${apartment.number}`,
                      }
                    : undefined
                }
                onClose={() => (checkInPending ? undefined : setCheckInOpen(false))}
                onSubmit={handleCheckInSubmit}
                onQuickCreateVisitor={() => {
                  setVisitorCreateError("");
                  setVisitorCreateOpen(true);
                }}
              />

              <VisitorFormModal
                open={visitorCreateOpen}
                title="Yeni Misafir"
                initialValues={emptyVisitorForm()}
                pending={visitorCreatePending}
                error={visitorCreateError}
                onClose={() => {
                  if (visitorCreatePending) return;
                  setVisitorCreateOpen(false);
                }}
                onSubmit={handleQuickCreateVisitor}
              />
            </div>
          ) : null}

          {tab === "demirbaslar" ? (
            <div>
              <div className="mb-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setAssetError("");
                    setAssetFormOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Yeni Demirbaş
                </Button>
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Demirbaş</TH>
                      <TH>Kategori</TH>
                      <TH>Adet</TH>
                      <TH>Durum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {assetsLoading ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={4}>
                          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        </TD>
                      </TR>
                    ) : null}
                    {!assetsLoading && assets.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={4} className="py-8 text-center text-sm text-muted">
                          Bu daire için demirbaş kaydı bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!assetsLoading
                      ? assets.map((asset) => (
                          <TR key={asset.id}>
                            <TD className="font-medium">
                              <Link
                                href={`/app/demirbaslar/${asset.id}`}
                                className="hover:text-brand"
                              >
                                {asset.name}
                              </Link>
                              {asset.code ? (
                                <p className="text-xs text-muted">{asset.code}</p>
                              ) : null}
                            </TD>
                            <TD>{asset.category?.name || "—"}</TD>
                            <TD>
                              {asset.quantity}
                              {asset.unit ? ` ${asset.unit}` : ""}
                            </TD>
                            <TD>{ASSET_STATUS_LABELS[asset.status]}</TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>

              <AssetFormModal
                key={`asset-new-${apartment.id}`}
                open={assetFormOpen}
                title="Yeni Demirbaş"
                categories={assetCategories}
                auth={auth}
                lockSite
                lockBuilding
                lockApartment
                siteLabel={site?.name}
                initialValues={emptyAssetForm({
                  siteId: auth?.siteId ?? siteId ?? "",
                  buildingId: apartment.building.id,
                  apartmentId: apartment.id,
                })}
                pending={assetPending}
                error={assetError}
                onCategoriesChanged={() => void loadAssets()}
                onClose={() => (assetPending ? undefined : setAssetFormOpen(false))}
                onSubmit={handleAssetSubmit}
              />
            </div>
          ) : null}

          {tab === "hareketler" ? (
            <p className="py-6 text-sm text-muted">Henüz hareket bulunmuyor.</p>
          ) : null}

          <ApartmentFormModal
            open={formOpen}
            title="Daireyi Düzenle"
            buildings={buildings}
            initialValues={apartmentToForm(apartment)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <RelationFormModal
            key={editingRelation?.id ?? relationDraft?.personId ?? "new-relation"}
            open={relationOpen}
            title={editingRelation ? "İlişkiyi Düzenle" : "Daire İlişkisi Ekle"}
            buildings={buildings}
            apartments={[apartment]}
            persons={persons}
            lockApartment
            isEdit={Boolean(editingRelation)}
            lockedPersonLabel={editingRelation?.person.fullName}
            initialValues={
              relationDraft ??
              emptyRelationForm({
                buildingId: apartment.building.id,
                apartmentId: apartment.id,
              })
            }
            pending={relationPending}
            error={relationError}
            onClose={() => (relationPending ? undefined : setRelationOpen(false))}
            onSubmit={handleRelationSubmit}
            onCreatePerson={() => {
              setRelationDraft((current) => current);
              setRelationOpen(false);
              setPersonCreateError("");
              setPersonCreateOpen(true);
            }}
          />

          <PersonFormModal
            open={personCreateOpen}
            title="Yeni Kişi"
            initialValues={emptyPersonForm()}
            pending={personCreatePending}
            error={personCreateError}
            onClose={() => {
              if (personCreatePending) return;
              setPersonCreateOpen(false);
              setRelationOpen(true);
            }}
            onSubmit={handleCreatePerson}
          />

          {apartment && residentQuick ? (
            <ResidentQuickModal
              open
              apartmentId={apartment.id}
              relationType={residentQuick}
              onClose={() => setResidentQuick(null)}
              onSaved={() => void loadRelations()}
            />
          ) : null}

          <EndRelationDialog
            open={Boolean(ending)}
            pending={endPending}
            onClose={() => (endPending ? undefined : setEnding(null))}
            onConfirm={(endDate) => void handleEndRelation(endDate)}
          />

          <DuesExemptionModal
            open={exemptionOpen}
            mode={apartment.duesStatus?.exemption ? "edit" : "create"}
            apartment={apartment}
            siteName={site?.name}
            auth={auth}
            onClose={() => setExemptionOpen(false)}
            onSaved={() => {
              showToast("Muafiyet kaydedildi.");
              void load();
            }}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
