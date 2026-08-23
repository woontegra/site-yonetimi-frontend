"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, Plus } from "lucide-react";
import {
  DuesFormModal,
  duesFormToPayload,
  duesToForm,
  emptyDuesForm,
  type DuesFormValues,
} from "@/components/accounting/DuesFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  chargeDues,
  createDuesDefinition,
  deleteDuesDefinition,
  getChargePreview,
  listDuesDefinitions,
  updateDuesDefinition,
  type ChargePreview,
  type DuesDefinition,
} from "@/lib/dues-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney, formatPeriod, formatPeriodLong } from "@/lib/money";

const PER_PAGE = 20;

export function DuesListPage() {
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DuesDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DuesDefinition | null>(null);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [deleting, setDeleting] = useState<DuesDefinition | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [chargePreview, setChargePreview] = useState<ChargePreview | null>(null);
  const [chargePending, setChargePending] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listDuesDefinitions(auth, {
        search: debouncedSearch.trim() || undefined,
        page,
        perPage: PER_PAGE,
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
  }, [auth, debouncedSearch, page]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function openCreate() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit(values: DuesFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      const payload = duesFormToPayload(values);
      if (editing) {
        await updateDuesDefinition(auth, editing.id, payload);
        showToast("Aidat güncellendi.");
      } else {
        if (!values.siteId) {
          setFormError("Site seçimi zorunludur.");
          setFormPending(false);
          return;
        }
        await createDuesDefinition({ ...auth, siteId: values.siteId }, payload);
        showToast("Aidat oluşturuldu.");
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

  async function openCharge(dues: DuesDefinition) {
    if (!auth) return;
    try {
      const preview = await getChargePreview(auth, dues.id);
      setChargePreview(preview);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Önizleme alınamadı.", "error");
    }
  }

  async function handleCharge() {
    if (!auth || !chargePreview || chargePending) return;
    setChargePending(true);
    try {
      const result = await chargeDues(auth, chargePreview.dues.id);
      showToast(`${result.createdCount} daire borçlandırıldı.`);
      setChargePreview(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Borçlandırma başarısız.", "error");
    } finally {
      setChargePending(false);
    }
  }

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      await deleteDuesDefinition(auth, deleting.id);
      showToast("Aidat arşivlendi.");
      setDeleting(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Aidat silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Muhasebe
      </Link>

      <PageHeader
        title="Aidatlar"
        description={
          site?.name ? `${site.name} için aidat tanımlarını yönetin.` : "Aidat tanımlarını yönetin."
        }
        search={
          <SearchInput
            placeholder="Aidat ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Yeni Aidat
          </Button>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Aidat</TH>
              <TH>Bina</TH>
              <TH>Dönem</TH>
              <TH className="text-right">Tutar</TH>
              <TH>Son Ödeme</TH>
              <TH>Oluşturulan Borç</TH>
              <TH>Durum</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TR key={`s-${index}`} className="hover:bg-transparent">
                    <TD colSpan={8}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}
            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={8} className="py-8 text-center text-sm text-muted">
                  Henüz aidat tanımı bulunmuyor.
                </TD>
              </TR>
            ) : null}
            {!loading
              ? items.map((dues) => (
                  <TR key={dues.id}>
                    <TD className="font-medium">
                      <Link href={`/app/muhasebe/aidatlar/${dues.id}`} className="hover:text-brand">
                        {dues.name}
                      </Link>
                    </TD>
                    <TD>{dues.building.name}</TD>
                    <TD>{formatPeriod(dues.periodYear, dues.periodMonth)}</TD>
                    <TD className="text-right">{formatMoney(dues.amount)}</TD>
                    <TD>{formatDateTr(dues.dueDate)}</TD>
                    <TD>{dues.chargedApartmentCount} daire</TD>
                    <TD>
                      <StatusBadge active={dues.isActive} />
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        align="right"
                        trigger={
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                            aria-label="Aidat işlemleri"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <DropdownItem href={`/app/muhasebe/aidatlar/${dues.id}`}>Detay</DropdownItem>
                        <DropdownItem
                          onClick={() => {
                            setEditing(dues);
                            setFormError("");
                            setFormOpen(true);
                          }}
                        >
                          Düzenle
                        </DropdownItem>
                        <DropdownItem onClick={() => void openCharge(dues)}>
                          Dairelere Borçlandır
                        </DropdownItem>
                        <DropdownItem danger onClick={() => setDeleting(dues)}>
                          Sil
                        </DropdownItem>
                      </Dropdown>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>
      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <DuesFormModal
        key={editing?.id ?? "create-dues"}
        open={formOpen}
        title={editing ? "Aidatı Düzenle" : "Yeni Aidat"}
        initialValues={
          editing ? duesToForm(editing, siteId ?? "") : emptyDuesForm(siteId ?? "")
        }
        pending={formPending}
        error={formError}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Aidat silinsin mi?"
        description="Bu aidat arşivlenecek. Daha önce oluşturulmuş daire borçları silinmez."
        confirmLabel="Aidatı Sil"
        cancelLabel="Vazgeç"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />

      <Modal
        open={Boolean(chargePreview)}
        title="Aidatı dairelere uygula"
        description="Bu işlem aktif dairelerin her biri için ayrı bir borç kaydı oluşturacaktır."
        variant="confirm"
        onClose={chargePending ? () => undefined : () => setChargePreview(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setChargePreview(null)} disabled={chargePending}>
              Vazgeç
            </Button>
            <Button
              onClick={() => void handleCharge()}
              disabled={chargePending || !chargePreview?.pendingChargeCount}
            >
              {chargePending
                ? "Borçlandırılıyor..."
                : `${chargePreview?.pendingChargeCount ?? 0} Daireyi Borçlandır`}
            </Button>
          </>
        }
      >
        {chargePreview ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Bina</dt>
              <dd className="font-medium">{chargePreview.dues.building.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Dönem</dt>
              <dd className="font-medium">
                {formatPeriodLong(chargePreview.dues.periodYear, chargePreview.dues.periodMonth)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Tutar</dt>
              <dd className="font-medium">{formatMoney(chargePreview.dues.amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Aktif daire</dt>
              <dd className="font-medium">{chargePreview.activeApartmentCount}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2">
              <dt className="text-muted">Toplam oluşturulacak borç</dt>
              <dd className="font-semibold">{formatMoney(chargePreview.totalChargeAmount)}</dd>
            </div>
          </dl>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
