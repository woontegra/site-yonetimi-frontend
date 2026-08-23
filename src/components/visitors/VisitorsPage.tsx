"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListFilter, MoreHorizontal, Plus } from "lucide-react";
import {
  VisitCheckInModal,
  visitCheckInFormToPayload,
  type VisitCheckInFormValues,
} from "@/components/visitors/VisitCheckInModal";
import {
  VisitorFormModal,
  emptyVisitorForm,
  visitorFormToCreatePayload,
  visitorFormToUpdatePayload,
  visitorToForm,
  type VisitorFormValues,
} from "@/components/visitors/VisitorFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import {
  VISIT_STATUS_LABELS,
  cancelVisit,
  checkOutVisit,
  createVisit,
  createVisitor,
  deleteVisitor,
  formatTimeTr,
  formatVisitDuration,
  getVisitor,
  listVisitors,
  listVisits,
  updateVisitor,
  type Visit,
  type VisitStatus,
  type Visitor,
  type VisitorDetail,
} from "@/lib/visits-api";

const PER_PAGE = 20;

const tabs = [
  { id: "aktif", label: "Aktif Ziyaretler" },
  { id: "gecmis", label: "Ziyaret Geçmişi" },
  { id: "rehber", label: "Misafir Rehberi" },
] as const;

type TabId = (typeof tabs)[number]["id"];
type DatePreset = "" | "today" | "yesterday" | "last7" | "thisMonth" | "custom";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (preset === "today") {
    return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() };
  }
  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      dateFrom: startOfDay(yesterday).toISOString(),
      dateTo: endOfDay(yesterday).toISOString(),
    };
  }
  if (preset === "last7") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(now).toISOString() };
  }
  if (preset === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(now).toISOString() };
  }
  if (preset === "custom") {
    return {
      dateFrom: customFrom ? startOfDay(new Date(customFrom)).toISOString() : undefined,
      dateTo: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined,
    };
  }
  return {};
}

function statusTone(status: VisitStatus) {
  if (status === "INSIDE") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "COMPLETED") return "neutral" as const;
  return "warning" as const;
}

export function VisitorsPage() {
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, hasSites } = useActiveSite();

  const [tab, setTab] = useState<TabId>("aktif");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [buildingId, setBuildingId] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [total, setTotal] = useState(0);
  const [insideCount, setInsideCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [nowTick, setNowTick] = useState(() => new Date());

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInPending, setCheckInPending] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const [visitorFormOpen, setVisitorFormOpen] = useState(false);
  const [visitorFormNested, setVisitorFormNested] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<VisitorDetail | null>(null);
  const [visitorFormPending, setVisitorFormPending] = useState(false);
  const [visitorFormError, setVisitorFormError] = useState("");

  const [checkingOut, setCheckingOut] = useState<Visit | null>(null);
  const [checkOutPending, setCheckOutPending] = useState(false);
  const [cancelling, setCancelling] = useState<Visit | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [archiving, setArchiving] = useState<Visitor | null>(null);
  const [archivePending, setArchivePending] = useState(false);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const loadBuildings = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBuildings(auth, { status: "aktif", perPage: 100 });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    }
  }, [auth]);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      setListError("Sunucuya bağlanılamadı.");
      return;
    }
    setLoading(true);
    setListError("");
    try {
      if (tab === "rehber") {
        const result = await listVisitors(auth, {
          search: debouncedSearch.trim() || undefined,
          page,
          perPage: PER_PAGE,
        });
        setVisitors(result.items);
        setVisits([]);
        setTotal(result.total);
      } else {
        const historyStatusFilter =
          tab === "gecmis" && (historyStatus === "COMPLETED" || historyStatus === "CANCELLED")
            ? historyStatus
            : undefined;
        const result = await listVisits(auth, {
          search: debouncedSearch.trim() || undefined,
          page,
          perPage: PER_PAGE,
          statusGroup: tab === "aktif" ? "active" : historyStatusFilter ? undefined : "history",
          buildingId: buildingId || undefined,
          status: historyStatusFilter,
          dateFrom: dateRange.dateFrom,
          dateTo: dateRange.dateTo,
        });
        setVisits(result.items);
        setVisitors([]);
        setTotal(result.total);
        setInsideCount(result.summary.insideCount);
      }
    } catch (error) {
      setVisits([]);
      setVisitors([]);
      setTotal(0);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [
    auth,
    tab,
    debouncedSearch,
    page,
    buildingId,
    historyStatus,
    dateRange.dateFrom,
    dateRange.dateTo,
  ]);

  useEffect(() => {
    if (!ready) return;
    void loadBuildings();
  }, [ready, loadBuildings]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, buildingId, historyStatus, datePreset, customFrom, customTo]);

  useEffect(() => {
    if (tab !== "aktif") return;
    const timer = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [tab]);

  function openCheckIn() {
    if (!hasSites) {
      setNeedSiteOpen(true);
      return;
    }
    setCheckInError("");
    setSelectedVisitor(null);
    setCheckInOpen(true);
  }

  function openVisitorCreate(nested = false) {
    setEditingVisitor(null);
    setVisitorFormError("");
    setVisitorFormNested(nested);
    setVisitorFormOpen(true);
  }

  async function openVisitorEdit(visitor: Visitor) {
    if (!auth) return;
    setVisitorFormError("");
    setVisitorFormNested(false);
    try {
      const result = await getVisitor(auth, visitor.id);
      setEditingVisitor(result.visitor);
      setVisitorFormOpen(true);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Misafir yüklenemedi.", "error");
    }
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
      setTab("aktif");
      await load();
    } catch (error) {
      setCheckInError(error instanceof ApiError ? error.message : "Giriş kaydedilemedi.");
    } finally {
      setCheckInPending(false);
    }
  }

  async function handleVisitorSubmit(values: VisitorFormValues) {
    if (!auth || visitorFormPending) return;
    setVisitorFormPending(true);
    setVisitorFormError("");
    try {
      if (editingVisitor) {
        await updateVisitor(auth, editingVisitor.id, visitorFormToUpdatePayload(values));
        showToast("Misafir güncellendi.");
        setVisitorFormOpen(false);
        setEditingVisitor(null);
        await load();
      } else {
        const result = await createVisitor(auth, visitorFormToCreatePayload(values));
        showToast("Misafir oluşturuldu.");
        setVisitorFormOpen(false);
        if (visitorFormNested) {
          setSelectedVisitor(result.visitor);
        } else {
          setTab("rehber");
          await load();
        }
      }
    } catch (error) {
      setVisitorFormError(error instanceof ApiError ? error.message : "Kayıt kaydedilemedi.");
    } finally {
      setVisitorFormPending(false);
    }
  }

  async function handleCheckOut() {
    if (!auth || !checkingOut || checkOutPending) return;
    setCheckOutPending(true);
    try {
      await checkOutVisit(auth, checkingOut.id);
      showToast("Çıkış kaydedildi.");
      setCheckingOut(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Çıkış yapılamadı.", "error");
    } finally {
      setCheckOutPending(false);
    }
  }

  async function handleCancel() {
    if (!auth || !cancelling || cancelPending) return;
    setCancelPending(true);
    try {
      await cancelVisit(auth, cancelling.id);
      showToast("Ziyaret iptal edildi.");
      setCancelling(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Ziyaret iptal edilemedi.", "error");
    } finally {
      setCancelPending(false);
    }
  }

  async function handleArchiveVisitor() {
    if (!auth || !archiving || archivePending) return;
    setArchivePending(true);
    try {
      await deleteVisitor(auth, archiving.id);
      showToast("Misafir arşivlendi.");
      setArchiving(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Misafir arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  const filterCount = [
    buildingId,
    tab === "gecmis" ? historyStatus : "",
    datePreset,
  ].filter(Boolean).length;

  const summaryText =
    tab === "aktif" && insideCount > 0 ? `${insideCount} misafir içeride` : undefined;

  return (
    <PageContainer>
      <PageHeader
        title="Misafirler"
        description={
          site?.name
            ? `${site.name} için misafir giriş-çıkışlarını takip edin.`
            : "Misafir giriş-çıkışlarını takip edin."
        }
        meta={summaryText}
        search={
          <SearchInput
            placeholder="Misafir, daire veya plaka ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Misafir ara"
          />
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}>
              <ListFilter className="size-4" aria-hidden />
              Filtre
              {filterCount > 0 ? <span className="text-brand">({filterCount})</span> : null}
            </Button>
            {tab === "rehber" ? (
              <Button onClick={() => openVisitorCreate(false)}>
                <Plus className="size-4" aria-hidden />
                Yeni Misafir
              </Button>
            ) : (
              <Button onClick={openCheckIn}>
                <Plus className="size-4" aria-hidden />
                Misafir Girişi
              </Button>
            )}
          </>
        }
      />

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

      {filtersOpen ? (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-line bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            className="h-10 text-sm"
            value={buildingId}
            onChange={(event) => setBuildingId(event.target.value)}
            aria-label="Bina filtresi"
          >
            <option value="">Tüm binalar</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </Select>
          {tab === "gecmis" ? (
            <Select
              className="h-10 text-sm"
              value={historyStatus}
              onChange={(event) => setHistoryStatus(event.target.value)}
              aria-label="Durum filtresi"
            >
              <option value="">Tüm durumlar</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="CANCELLED">İptal</option>
            </Select>
          ) : null}
          <Select
            className="h-10 text-sm"
            value={datePreset}
            onChange={(event) => {
              const next = event.target.value as DatePreset;
              setDatePreset(next);
              if (next === "custom" && !customFrom && !customTo) {
                setCustomFrom(toDateInput(new Date()));
                setCustomTo(toDateInput(new Date()));
              }
            }}
            aria-label="Tarih filtresi"
          >
            <option value="">Tüm tarihler</option>
            <option value="today">Bugün</option>
            <option value="yesterday">Dün</option>
            <option value="last7">Son 7 Gün</option>
            <option value="thisMonth">Bu Ay</option>
            <option value="custom">Tarih aralığı</option>
          </Select>
          {datePreset === "custom" ? (
            <>
              <Input
                type="date"
                className="h-10 text-sm"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                aria-label="Başlangıç tarihi"
              />
              <Input
                type="date"
                className="h-10 text-sm"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                aria-label="Bitiş tarihi"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      {tab === "rehber" ? (
        <Table>
          <TableElement>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Ad Soyad</TH>
                <TH>Telefon</TH>
                <TH>Son Ziyaret</TH>
                <TH>Toplam Ziyaret</TH>
                <TH className="text-right">İşlem</TH>
              </TR>
            </THead>
            <TBody>
              {loading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                      <TD colSpan={5}>
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                : null}
              {!loading && visitors.length === 0 ? (
                <TR className="hover:bg-transparent">
                  <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                    Henüz misafir bulunmuyor.
                  </TD>
                </TR>
              ) : null}
              {!loading
                ? visitors.map((visitor) => (
                    <TR key={visitor.id}>
                      <TD className="font-medium">
                        <Link href={`/app/misafirler/${visitor.id}`} className="hover:text-brand">
                          {visitor.fullName}
                        </Link>
                      </TD>
                      <TD>{visitor.phone || "—"}</TD>
                      <TD>{formatDateTr(visitor.lastVisitAt)}</TD>
                      <TD>{visitor.visitCount}</TD>
                      <TD className="text-right">
                        <Dropdown
                          align="right"
                          trigger={
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                              aria-label={`${visitor.fullName} işlemleri`}
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        >
                          <DropdownItem href={`/app/misafirler/${visitor.id}`}>Detay</DropdownItem>
                          <DropdownItem onClick={() => void openVisitorEdit(visitor)}>
                            Düzenle
                          </DropdownItem>
                          <DropdownItem danger onClick={() => setArchiving(visitor)}>
                            Arşivle
                          </DropdownItem>
                        </Dropdown>
                      </TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </TableElement>
        </Table>
      ) : (
        <Table>
          <TableElement>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Misafir</TH>
                <TH>Bina</TH>
                <TH>Daire</TH>
                <TH>Ziyaret Edilen</TH>
                <TH>{tab === "aktif" ? "Giriş" : "Giriş / Çıkış"}</TH>
                <TH>Amaç</TH>
                <TH>Plaka</TH>
                {tab === "aktif" ? <TH>Süre</TH> : <TH>Durum</TH>}
                <TH className="text-right">İşlem</TH>
              </TR>
            </THead>
            <TBody>
              {loading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TR key={`skeleton-${index}`} className="hover:bg-transparent">
                      <TD colSpan={9}>
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      </TD>
                    </TR>
                  ))
                : null}
              {!loading && visits.length === 0 ? (
                <TR className="hover:bg-transparent">
                  <TD colSpan={9} className="py-8 text-center text-sm text-muted">
                    {tab === "aktif" ? "Aktif ziyaret bulunmuyor." : "Ziyaret geçmişi boş."}
                  </TD>
                </TR>
              ) : null}
              {!loading
                ? visits.map((visit) => (
                    <TR key={visit.id}>
                      <TD className="font-medium">
                        <Link
                          href={`/app/misafirler/${visit.visitor.id}`}
                          className="hover:text-brand"
                        >
                          {visit.visitor.fullName}
                        </Link>
                      </TD>
                      <TD>{visit.building.name}</TD>
                      <TD>
                        <Link
                          href={`/app/daireler/${visit.apartment.id}`}
                          className="hover:text-brand"
                        >
                          {visit.apartment.number}
                        </Link>
                      </TD>
                      <TD>{visit.hostPerson?.fullName || "—"}</TD>
                      <TD>
                        {tab === "aktif" ? (
                          formatTimeTr(visit.checkInAt)
                        ) : (
                          <span>
                            {formatDateTr(visit.checkInAt)} {formatTimeTr(visit.checkInAt)}
                            {visit.checkOutAt ? (
                              <>
                                <br />
                                <span className="text-muted">
                                  {formatTimeTr(visit.checkOutAt)}
                                </span>
                              </>
                            ) : null}
                          </span>
                        )}
                      </TD>
                      <TD>{visit.purpose || "—"}</TD>
                      <TD>{visit.vehiclePlate || "—"}</TD>
                      <TD>
                        {tab === "aktif" ? (
                          formatVisitDuration(visit.checkInAt, visit.checkOutAt, nowTick)
                        ) : (
                          <Badge tone={statusTone(visit.status)}>
                            {VISIT_STATUS_LABELS[visit.status]}
                          </Badge>
                        )}
                      </TD>
                      <TD className="text-right">
                        <Dropdown
                          align="right"
                          trigger={
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                              aria-label="Ziyaret işlemleri"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        >
                          {visit.status === "INSIDE" ? (
                            <>
                              <DropdownItem onClick={() => setCheckingOut(visit)}>
                                Çıkış Yap
                              </DropdownItem>
                              <DropdownItem danger onClick={() => setCancelling(visit)}>
                                İptal
                              </DropdownItem>
                            </>
                          ) : null}
                          <DropdownItem href={`/app/misafirler/ziyaretler/${visit.id}`}>
                            Detay
                          </DropdownItem>
                        </Dropdown>
                      </TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </TableElement>
        </Table>
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />

      <VisitCheckInModal
        open={checkInOpen}
        auth={auth}
        pending={checkInPending}
        error={checkInError}
        selectedVisitor={selectedVisitor}
        onClose={() => (checkInPending ? undefined : setCheckInOpen(false))}
        onSubmit={handleCheckInSubmit}
        onQuickCreateVisitor={() => openVisitorCreate(true)}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />
      <VisitorFormModal
        key={editingVisitor?.id ?? (visitorFormNested ? "nested-create" : "create")}
        open={visitorFormOpen}
        title={editingVisitor ? "Misafiri Düzenle" : "Yeni Misafir"}
        initialValues={editingVisitor ? visitorToForm(editingVisitor) : emptyVisitorForm()}
        pending={visitorFormPending}
        error={visitorFormError}
        onClose={() => {
          if (visitorFormPending) return;
          setVisitorFormOpen(false);
          setEditingVisitor(null);
        }}
        onSubmit={handleVisitorSubmit}
      />

      <ConfirmDialog
        open={Boolean(checkingOut)}
        title="Çıkış yapılsın mı?"
        description={
          checkingOut
            ? `${checkingOut.visitor.fullName} için çıkış kaydedilecek.`
            : "Çıkış kaydedilecek."
        }
        confirmLabel="Çıkış Yap"
        cancelLabel="Vazgeç"
        pending={checkOutPending}
        onConfirm={() => void handleCheckOut()}
        onClose={() => (checkOutPending ? undefined : setCheckingOut(null))}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Ziyaret iptal edilsin mi?"
        description={
          cancelling
            ? `${cancelling.visitor.fullName} ziyareti iptal edilecek.`
            : "Ziyaret iptal edilecek."
        }
        confirmLabel="İptal Et"
        cancelLabel="Vazgeç"
        danger
        pending={cancelPending}
        onConfirm={() => void handleCancel()}
        onClose={() => (cancelPending ? undefined : setCancelling(null))}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Misafir arşivlensin mi?"
        description="Misafir arşivlenecek. Geçmiş ziyaret kayıtları korunacaktır."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
        danger
        pending={archivePending}
        onConfirm={() => void handleArchiveVisitor()}
        onClose={() => (archivePending ? undefined : setArchiving(null))}
      />
    </PageContainer>
  );
}
