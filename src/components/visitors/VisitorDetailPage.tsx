"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import {
  VisitorFormModal,
  visitorFormToUpdatePayload,
  visitorToForm,
  type VisitorFormValues,
} from "@/components/visitors/VisitorFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import {
  VISIT_STATUS_LABELS,
  deleteVisitor,
  formatTimeTr,
  formatVisitDuration,
  getVisitor,
  listVisits,
  updateVisitor,
  type Visit,
  type VisitStatus,
  type VisitorDetail,
} from "@/lib/visits-api";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "ziyaretler", label: "Ziyaretler" },
] as const;

type TabId = (typeof tabs)[number]["id"];
const PER_PAGE = 20;

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function statusTone(status: VisitStatus) {
  if (status === "INSIDE") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "COMPLETED") return "neutral" as const;
  return "warning" as const;
}

export function VisitorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: false });

  const [visitor, setVisitor] = useState<VisitorDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");

  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitPage, setVisitPage] = useState(1);
  const [visitTotal, setVisitTotal] = useState(0);
  const [visitsLoading, setVisitsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getVisitor(auth, params.id);
      setVisitor(result.visitor);
    } catch (err) {
      setVisitor(null);
      setError(err instanceof ApiError ? err.message : "Misafir yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadVisits = useCallback(async () => {
    if (!auth || !params.id) return;
    setVisitsLoading(true);
    try {
      const result = await listVisits(auth, {
        visitorId: params.id,
        page: visitPage,
        perPage: PER_PAGE,
      });
      setVisits(result.items);
      setVisitTotal(result.total);
    } catch {
      setVisits([]);
      setVisitTotal(0);
    } finally {
      setVisitsLoading(false);
    }
  }, [auth, params.id, visitPage]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || tab !== "ziyaretler") return;
    void loadVisits();
  }, [ready, tab, loadVisits]);

  async function handleSubmit(values: VisitorFormValues) {
    if (!auth || !visitor || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateVisitor(auth, visitor.id, visitorFormToUpdatePayload(values));
      await load();
      setFormOpen(false);
      showToast("Misafir güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !visitor || archivePending) return;
    setArchivePending(true);
    try {
      await deleteVisitor(auth, visitor.id);
      showToast("Misafir arşivlendi.");
      setArchiveOpen(false);
      router.push("/app/misafirler");
    } catch (err) {
      toastError(err, "Misafir arşivlenemedi.");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/misafirler"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Misafirler
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {visitor ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">{visitor.fullName}</h1>
              <p className="mt-1 text-sm text-muted">{visitor.phone || "Telefon yok"}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setFormError("");
                  setFormOpen(true);
                }}
              >
                Düzenle
              </Button>
              <Dropdown
                align="right"
                trigger={
                  <Button variant="secondary" size="sm" aria-label="İşlemler">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              >
                <DropdownItem danger onClick={() => setArchiveOpen(true)}>
                  Arşivle
                </DropdownItem>
              </Dropdown>
            </div>
          </div>

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
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
              <InfoItem label="Ad" value={visitor.firstName} />
              <InfoItem label="Soyad" value={visitor.lastName} />
              <InfoItem label="Telefon" value={visitor.phone || "—"} />
              <InfoItem label="T.C. Kimlik No" value={visitor.nationalId || "—"} />
              <InfoItem label="Toplam Ziyaret" value={visitor.visitCount} />
              <InfoItem label="Son Ziyaret" value={formatDateTr(visitor.lastVisitAt)} />
              <InfoItem label="Not" value={visitor.note || "—"} />
            </dl>
          ) : null}

          {tab === "ziyaretler" ? (
            <div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Tarih</TH>
                      <TH>Bina / Daire</TH>
                      <TH>Giriş</TH>
                      <TH>Çıkış</TH>
                      <TH>Süre</TH>
                      <TH>Amaç</TH>
                      <TH>Durum</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {visitsLoading ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={7}>
                          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        </TD>
                      </TR>
                    ) : null}
                    {!visitsLoading && visits.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                          Ziyaret kaydı bulunmuyor.
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
                            <TD>
                              {visit.building.name} / {visit.apartment.number}
                            </TD>
                            <TD>{formatTimeTr(visit.checkInAt)}</TD>
                            <TD>{formatTimeTr(visit.checkOutAt)}</TD>
                            <TD>{formatVisitDuration(visit.checkInAt, visit.checkOutAt)}</TD>
                            <TD>{visit.purpose || "—"}</TD>
                            <TD>
                              <Badge tone={statusTone(visit.status)}>
                                {VISIT_STATUS_LABELS[visit.status]}
                              </Badge>
                            </TD>
                          </TR>
                        ))
                      : null}
                  </TBody>
                </TableElement>
              </Table>
              <Pagination
                page={visitPage}
                perPage={PER_PAGE}
                total={visitTotal}
                onPageChange={setVisitPage}
              />
            </div>
          ) : null}

          <VisitorFormModal
            open={formOpen}
            title="Misafiri Düzenle"
            initialValues={visitorToForm(visitor)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <ConfirmDialog
            open={archiveOpen}
            title="Misafir arşivlensin mi?"
            description="Misafir arşivlenecek. Geçmiş ziyaret kayıtları korunacaktır."
            confirmLabel="Arşivle"
            cancelLabel="Vazgeç"
            danger
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => (archivePending ? undefined : setArchiveOpen(false))}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
