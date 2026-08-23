"use client";

import { useCallback, useEffect, useState } from "react";
import { ListFilter, Plus } from "lucide-react";
import {
  PersonFormModal,
  emptyPersonForm,
  personFormToPayload,
  personToForm,
  type PersonFormValues,
} from "@/components/persons/PersonFormModal";
import { PersonsTable } from "@/components/persons/PersonsTable";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { RELATION_TYPE_LABELS, type RelationType } from "@/lib/person-constants";
import {
  createPerson,
  createPersonWithRelation,
  deletePerson,
  getPerson,
  listPersons,
  updatePerson,
  type Person,
  type PersonListItem,
} from "@/lib/persons-api";

const PER_PAGE = 20;

export function PersonsPage() {
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { siteId, hasSites, site } = useActiveSite();
  const { openWizard } = useSiteSetupWizard();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [relationType, setRelationType] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PersonListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<PersonListItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      setListError("Sunucuya bağlanılamadı.");
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listPersons(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
        status: status === "aktif" || status === "pasif" ? status : undefined,
        relationType: relationType === "OWNER" || relationType === "TENANT" ? relationType : undefined,
        buildingId: buildingId || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, debouncedSearch, page, status, relationType, buildingId]);

  useEffect(() => {
    if (!ready || !auth || !siteId) return;
    void listBuildings(auth, { status: "aktif", perPage: 100 })
      .then((result) => setBuildings(result.items))
      .catch(() => setBuildings([]));
  }, [ready, auth, siteId]);

  useEffect(() => {
    if (!ready || !auth) return;
    void load();
  }, [ready, auth, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, relationType, buildingId, siteId]);

  function openCreate() {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  async function openEdit(person: PersonListItem) {
    if (!auth) return;
    setFormError("");
    try {
      const result = await getPerson(auth, person.id);
      setEditing(result.person);
      setFormOpen(true);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Kişi yüklenemedi.", "error");
    }
  }

  async function handleSubmit(values: PersonFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const payload = personFormToPayload(values);
      if (editing) {
        await updatePerson(auth, editing.id, payload);
        showToast("Kişi güncellendi.");
      } else if (values.apartmentId && values.relationType) {
        await createPersonWithRelation(auth, {
          ...payload,
          apartmentId: values.apartmentId,
          relationType: values.relationType,
        });
        showToast("Kişi oluşturuldu ve daireye bağlandı.");
      } else {
        await createPerson(auth, payload);
        showToast("Kişi oluşturuldu.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      await deletePerson(auth, deleting.id);
      showToast("Kişi silindi.");
      setDeleting(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Kişi silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  const filterCount = [status, relationType, buildingId].filter(Boolean).length;

  return (
    <PageContainer>
      <PageHeader
        title="Kişiler"
        description={
          site?.name ? `${site.name} için sakin ve kişileri yönetin.` : "Sakin ve kişileri yönetin."
        }
        search={
          <SearchInput
            placeholder="Kişi ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Kişi ara"
          />
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}>
              <ListFilter className="size-4" aria-hidden />
              Filtre
              {filterCount > 0 ? <span className="text-brand">({filterCount})</span> : null}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Yeni Kişi
            </Button>
            {hasSites ? (
              <Button variant="secondary" onClick={() => openWizard({ initialStep: 2 })}>
                Sakinleri Hızlı Ekle
              </Button>
            ) : null}
          </>
        }
      />

      {filtersOpen ? (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-line bg-white p-3 sm:grid-cols-3">
          <Select className="h-10 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </Select>
          <Select
            className="h-10 text-sm"
            value={relationType}
            onChange={(event) => setRelationType(event.target.value)}
          >
            <option value="">Tüm ilişkiler</option>
            {(Object.keys(RELATION_TYPE_LABELS) as RelationType[]).map((type) => (
              <option key={type} value={type}>
                {RELATION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <Select
            className="h-10 text-sm"
            value={buildingId}
            onChange={(event) => setBuildingId(event.target.value)}
          >
            <option value="">Tüm binalar</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <PersonsTable
        items={items}
        loading={loading}
        emptyLabel="Henüz sakin/kişi kaydı bulunmuyor."
        onEdit={(person) => void openEdit(person)}
        onDelete={setDeleting}
      />
      {!loading && items.length === 0 && !listError && hasSites ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={openCreate}>Yeni Kişi</Button>
          <Button variant="secondary" onClick={() => openWizard({ initialStep: 2 })}>
            Sakinleri Hızlı Ekle
          </Button>
        </div>
      ) : null}
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <PersonFormModal
        key={editing?.id ?? "create"}
        open={formOpen}
        title={editing ? "Kişiyi Düzenle" : "Yeni Kişi"}
        initialValues={editing ? personToForm(editing) : emptyPersonForm()}
        pending={formPending}
        error={formError}
        siteLabel={site?.name}
        buildings={buildings}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Kişi silinsin mi?"
        description="Bu kişi arşivlenecek ve aktif listelerden kaldırılacak."
        confirmLabel="Kişiyi Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />
    </PageContainer>
  );
}
