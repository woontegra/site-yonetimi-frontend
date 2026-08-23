"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  PersonFormModal,
  personFormToPayload,
  personToForm,
  type PersonFormValues,
} from "@/components/persons/PersonFormModal";
import { EndRelationDialog } from "@/components/persons/EndRelationDialog";
import {
  RelationFormModal,
  emptyRelationForm,
  relationFormToPayload,
  relationToForm,
  type RelationFormValues,
} from "@/components/persons/RelationFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { DetailHeader, DetailTabs } from "@/components/layout/DetailHeader";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import {
  RELATION_TYPE_LABELS,
  formatPersonDate,
} from "@/lib/person-constants";
import { getPerson, listPersons, updatePerson, type Person, type PersonListItem } from "@/lib/persons-api";
import {
  createRelation,
  endRelation,
  listRelations,
  updateRelation,
  type ApartmentPersonRelation,
} from "@/lib/relations-api";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "daireler", label: "Daireler" },
  { id: "gecmis", label: "Geçmiş" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: false });

  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [activeRelations, setActiveRelations] = useState<ApartmentPersonRelation[]>([]);
  const [historyRelations, setHistoryRelations] = useState<ApartmentPersonRelation[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(false);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [persons, setPersons] = useState<PersonListItem[]>([]);

  const [relationOpen, setRelationOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<ApartmentPersonRelation | null>(null);
  const [relationPending, setRelationPending] = useState(false);
  const [relationError, setRelationError] = useState("");
  const [ending, setEnding] = useState<ApartmentPersonRelation | null>(null);
  const [endPending, setEndPending] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getPerson(auth, params.id);
      setPerson(result.person);
    } catch (err) {
      setPerson(null);
      setError(err instanceof ApiError ? err.message : "Kişi yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadRelations = useCallback(async () => {
    if (!auth || !params.id) return;
    setRelationsLoading(true);
    try {
      const [active, history] = await Promise.all([
        listRelations(auth, { personId: params.id, active: true, perPage: 100 }),
        listRelations(auth, { personId: params.id, active: false, perPage: 100 }),
      ]);
      setActiveRelations(active.items);
      setHistoryRelations(history.items);
    } catch {
      setActiveRelations([]);
      setHistoryRelations([]);
    } finally {
      setRelationsLoading(false);
    }
  }, [auth, params.id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || (tab !== "daireler" && tab !== "gecmis")) return;
    void loadRelations();
  }, [ready, tab, loadRelations]);

  useEffect(() => {
    if (!ready || !auth) return;
    void Promise.all([
      listBuildings(auth, { status: "aktif", perPage: 100 }),
      listPersons(auth, { status: "aktif", perPage: 100 }),
    ])
      .then(([buildingList, personList]) => {
        setBuildings(buildingList.items);
        setPersons(personList.items);
      })
      .catch(() => undefined);
  }, [ready, auth]);

  async function loadApartmentsForBuilding(buildingId: string) {
    if (!auth || !buildingId) {
      setApartments([]);
      return;
    }
    try {
      const result = await listApartments(auth, {
        buildingId,
        status: "aktif",
        perPage: 100,
      });
      setApartments(result.items);
    } catch {
      setApartments([]);
    }
  }

  async function handlePersonSubmit(values: PersonFormValues) {
    if (!auth || !person || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const result = await updatePerson(auth, person.id, personFormToPayload(values));
      setPerson(result.person);
      setFormOpen(false);
      showToast("Kişi güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function openCreateRelation() {
    if (!person) return;
    setEditingRelation(null);
    setRelationError("");
    setApartments([]);
    setRelationOpen(true);
  }

  async function openEditRelation(relation: ApartmentPersonRelation) {
    setEditingRelation(relation);
    setRelationError("");
    await loadApartmentsForBuilding(relation.apartment.building.id);
    setRelationOpen(true);
  }

  async function handleRelationSubmit(values: RelationFormValues) {
    if (!auth || !person || relationPending) return;
    setRelationPending(true);
    setRelationError("");
    try {
      const payload = relationFormToPayload({ ...values, personId: person.id });
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
      await loadRelations();
    } catch (err) {
      setRelationError(err instanceof ApiError ? err.message : "İlişki kaydedilemedi.");
    } finally {
      setRelationPending(false);
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
      showToast(err instanceof ApiError ? err.message : "İlişki sonlandırılamadı.", "error");
    } finally {
      setEndPending(false);
    }
  }

  const mutedLine = [person?.phone, person?.email].filter(Boolean).join(" · ");

  return (
    <PageContainer>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {person ? (
        <>
          <DetailHeader
            backHref="/app/kisiler"
            backLabel="Kişiler"
            title={person.fullName}
            description={mutedLine || undefined}
            status={<StatusBadge active={person.isActive} />}
            actions={<Button onClick={() => setFormOpen(true)}>Düzenle</Button>}
          />

          <DetailTabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === "genel" ? (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
              <InfoItem label="Ad Soyad" value={person.fullName} />
              <InfoItem label="Telefon" value={person.phone || "—"} />
              <InfoItem label="E-posta" value={person.email || "—"} />
              <InfoItem label="T.C. Kimlik No" value={person.nationalId || "—"} />
              <InfoItem label="Cinsiyet" value={person.gender || "—"} />
              <InfoItem label="Meslek" value={person.occupation || "—"} />
              <InfoItem label="Doğum Tarihi" value={formatPersonDate(person.birthDate)} />
              <div>
                <dt className="text-xs text-muted">Durum</dt>
                <dd className="mt-0.5">
                  <StatusBadge active={person.isActive} />
                </dd>
              </div>
              <div className="col-span-2 md:col-span-4">
                <InfoItem label="Not" value={person.note || "—"} />
              </div>
            </dl>
          ) : null}

          {tab === "daireler" ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Aktif daire ilişkileri</h2>
                <Button size="sm" onClick={() => void openCreateRelation()}>
                  <Plus className="size-4" aria-hidden />
                  Daire İlişkisi
                </Button>
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Bina</TH>
                      <TH>Daire</TH>
                      <TH>İlişki</TH>
                      <TH>Başlangıç</TH>
                      <TH>Ana Kişi</TH>
                      <TH className="text-right">İşlemler</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {relationsLoading ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6}>
                          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        </TD>
                      </TR>
                    ) : null}
                    {!relationsLoading && activeRelations.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={6} className="py-8 text-center text-sm text-muted">
                          Henüz aktif daire ilişkisi bulunmuyor.
                        </TD>
                      </TR>
                    ) : null}
                    {!relationsLoading
                      ? activeRelations.map((relation) => (
                          <TR key={relation.id}>
                            <TD>{relation.apartment.building.name}</TD>
                            <TD>
                              <Link
                                href={`/app/daireler/${relation.apartment.id}`}
                                className="hover:text-brand"
                              >
                                {relation.apartment.number}
                              </Link>
                            </TD>
                            <TD>{RELATION_TYPE_LABELS[relation.relationType]}</TD>
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
                                <DropdownItem onClick={() => void openEditRelation(relation)}>
                                  Düzenle
                                </DropdownItem>
                                <DropdownItem danger onClick={() => setEnding(relation)}>
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
          ) : null}

          {tab === "gecmis" ? (
            <Table>
              <TableElement>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Bina</TH>
                    <TH>Daire</TH>
                    <TH>İlişki</TH>
                    <TH>Başlangıç</TH>
                    <TH>Bitiş</TH>
                  </TR>
                </THead>
                <TBody>
                  {relationsLoading ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={5}>
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ) : null}
                  {!relationsLoading && historyRelations.length === 0 ? (
                    <TR className="hover:bg-transparent">
                      <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                        Henüz geçmiş ilişki bulunmuyor.
                      </TD>
                    </TR>
                  ) : null}
                  {!relationsLoading
                    ? historyRelations.map((relation) => (
                        <TR key={relation.id}>
                          <TD>{relation.apartment.building.name}</TD>
                          <TD>{relation.apartment.number}</TD>
                          <TD>{RELATION_TYPE_LABELS[relation.relationType]}</TD>
                          <TD>{formatPersonDate(relation.startDate)}</TD>
                          <TD>{formatPersonDate(relation.endDate)}</TD>
                        </TR>
                      ))
                    : null}
                </TBody>
              </TableElement>
            </Table>
          ) : null}

          <PersonFormModal
            open={formOpen}
            title="Kişiyi Düzenle"
            initialValues={personToForm(person)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handlePersonSubmit}
          />

          <RelationFormModal
            key={editingRelation?.id ?? `new-${person.id}`}
            open={relationOpen}
            title={editingRelation ? "İlişkiyi Düzenle" : "Daire İlişkisi Ekle"}
            buildings={buildings}
            apartments={apartments}
            persons={persons}
            lockPerson
            lockedPersonLabel={person.fullName}
            isEdit={Boolean(editingRelation)}
            initialValues={
              editingRelation
                ? relationToForm(editingRelation)
                : emptyRelationForm({ personId: person.id })
            }
            pending={relationPending}
            error={relationError}
            onClose={() => (relationPending ? undefined : setRelationOpen(false))}
            onSubmit={handleRelationSubmit}
            onBuildingChange={(buildingId) => void loadApartmentsForBuilding(buildingId)}
          />

          <EndRelationDialog
            open={Boolean(ending)}
            pending={endPending}
            onClose={() => (endPending ? undefined : setEnding(null))}
            onConfirm={(endDate) => void handleEndRelation(endDate)}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
