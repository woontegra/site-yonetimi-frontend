"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, MoreHorizontal, Plus } from "lucide-react";
import {
  AssignmentFormModal,
  assignmentFormToPayload,
  type AssignmentFormValues,
} from "@/components/employees/AssignmentFormModal";
import {
  EmployeeFormModal,
  employeeFormToUpdatePayload,
  employeeToForm,
  type EmployeeFormValues,
} from "@/components/employees/EmployeeFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { useApiAuth } from "@/lib/active-site-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";
import {
  archiveEmployee,
  createEmployeeAssignment,
  endEmployeeAssignment,
  getEmployee,
  terminateEmployee,
  updateEmployee,
  type EmployeeAssignment,
  type EmployeeDetail,
} from "@/lib/employees-api";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import { todayInputValue } from "@/lib/person-constants";

const tabs = [
  { id: "genel", label: "Genel" },
  { id: "gorevlendirmeler", label: "Görevlendirmeler" },
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

export function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: false });

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("genel");
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState(todayInputValue());
  const [terminatePending, setTerminatePending] = useState(false);

  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentPending, setAssignmentPending] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  const [ending, setEnding] = useState<EmployeeAssignment | null>(null);
  const [endDate, setEndDate] = useState(todayInputValue());
  const [endPending, setEndPending] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !params.id) return;
    setError("");
    try {
      const result = await getEmployee(auth, params.id);
      setEmployee(result.employee);
    } catch (err) {
      setEmployee(null);
      setError(err instanceof ApiError ? err.message : "Çalışan yüklenemedi.");
    }
  }, [auth, params.id]);

  const loadBuildings = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await listBuildings(auth, { status: "aktif", perPage: 100 });
      setBuildings(result.items);
    } catch {
      setBuildings([]);
    }
  }, [auth]);

  useEffect(() => {
    if (!ready) return;
    void load();
    void loadBuildings();
  }, [ready, load, loadBuildings]);

  async function handleSubmit(values: EmployeeFormValues) {
    if (!auth || !employee || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      await updateEmployee(auth, employee.id, employeeFormToUpdatePayload(values));
      await load();
      setFormOpen(false);
      showToast("Çalışan güncellendi.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kayıt kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleArchive() {
    if (!auth || !employee || archivePending) return;
    setArchivePending(true);
    try {
      await archiveEmployee(auth, employee.id);
      showToast("Çalışan arşivlendi.");
      setArchiveOpen(false);
      router.push("/app/calisanlar");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Çalışan arşivlenemedi.", "error");
    } finally {
      setArchivePending(false);
    }
  }

  async function handleTerminate() {
    if (!auth || !employee || terminatePending || !terminationDate) return;
    setTerminatePending(true);
    try {
      await terminateEmployee(auth, employee.id, { terminationDate });
      showToast("Çalışan işten ayrıldı olarak işaretlendi.");
      setTerminateOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
    } finally {
      setTerminatePending(false);
    }
  }

  async function handleAssignmentSubmit(values: AssignmentFormValues) {
    if (!auth || !employee || assignmentPending) return;
    if (!employee.isActive) {
      showToast("Pasif çalışana görevlendirme yapılamaz.", "error");
      return;
    }
    setAssignmentPending(true);
    setAssignmentError("");
    try {
      await createEmployeeAssignment(auth, employee.id, assignmentFormToPayload(values));
      showToast("Görevlendirme eklendi.");
      setAssignmentOpen(false);
      await load();
    } catch (err) {
      setAssignmentError(err instanceof ApiError ? err.message : "Görevlendirme eklenemedi.");
    } finally {
      setAssignmentPending(false);
    }
  }

  async function handleEndAssignment() {
    if (!auth || !ending || endPending || !endDate) return;
    setEndPending(true);
    try {
      await endEmployeeAssignment(auth, ending.id, { endDate });
      showToast("Görevlendirme sonlandırıldı.");
      setEnding(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Görevlendirme sonlandırılamadı.", "error");
    } finally {
      setEndPending(false);
    }
  }

  function openAssignment() {
    if (!employee?.isActive) {
      showToast("Pasif çalışana görevlendirme yapılamaz.", "error");
      return;
    }
    setAssignmentError("");
    setAssignmentOpen(true);
  }

  return (
    <PageContainer>
      <Link
        href="/app/calisanlar"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Çalışanlar
      </Link>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {employee ? (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[24px] font-semibold leading-none text-ink">{employee.fullName}</h1>
              <p className="mt-1 text-sm text-muted">{employee.jobTitle}</p>
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
                {employee.isActive ? (
                  <DropdownItem
                    onClick={() => {
                      setTerminationDate(todayInputValue());
                      setTerminateOpen(true);
                    }}
                  >
                    İşten Ayrıldı Olarak İşaretle
                  </DropdownItem>
                ) : null}
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
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
              <InfoItem label="Ad" value={employee.firstName} />
              <InfoItem label="Soyad" value={employee.lastName} />
              <InfoItem label="Telefon" value={employee.phone || "—"} />
              <InfoItem label="E-posta" value={employee.email || "—"} />
              <InfoItem label="Görevi" value={employee.jobTitle} />
              <InfoItem label="İşe Giriş" value={formatDateTr(employee.hireDate)} />
              <InfoItem label="İşten Çıkış" value={formatDateTr(employee.terminationDate)} />
              <div>
                <dt className="text-xs text-muted">Durum</dt>
                <dd className="mt-0.5">
                  <StatusBadge active={employee.isActive} />
                </dd>
              </div>
              <div className="col-span-2 md:col-span-4">
                <InfoItem label="Adres" value={employee.address || "—"} />
              </div>
              <InfoItem label="Görev Yeri" value={employee.assignmentSummary || "—"} />
            </dl>
          ) : null}

          {tab === "gorevlendirmeler" ? (
            <div>
              <div className="mb-3 flex justify-end">
                {employee.isActive ? (
                  <Button onClick={openAssignment}>
                    <Plus className="size-4" aria-hidden />
                    Görevlendirme
                  </Button>
                ) : null}
              </div>
              <Table>
                <TableElement>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Kapsam</TH>
                      <TH>Başlangıç</TH>
                      <TH>Bitiş</TH>
                      <TH>Durum</TH>
                      <TH className="text-right">İşlem</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {employee.assignments.length === 0 ? (
                      <TR className="hover:bg-transparent">
                        <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                          Henüz görevlendirme bulunmuyor.
                        </TD>
                      </TR>
                    ) : (
                      employee.assignments.map((assignment) => (
                        <TR key={assignment.id}>
                          <TD className="font-medium">{assignment.scopeLabel}</TD>
                          <TD>{formatDateTr(assignment.startDate)}</TD>
                          <TD>{formatDateTr(assignment.endDate)}</TD>
                          <TD>
                            <StatusBadge active={assignment.isActive} />
                          </TD>
                          <TD className="text-right">
                            {assignment.isActive ? (
                              <button
                                type="button"
                                className="text-sm text-brand hover:underline"
                                onClick={() => {
                                  setEndDate(todayInputValue());
                                  setEnding(assignment);
                                }}
                              >
                                Sonlandır
                              </button>
                            ) : (
                              "—"
                            )}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </TableElement>
              </Table>
            </div>
          ) : null}

          {tab === "gecmis" ? (
            <p className="py-8 text-center text-sm text-muted">Henüz geçmiş kaydı bulunmuyor.</p>
          ) : null}

          <EmployeeFormModal
            open={formOpen}
            title="Çalışanı Düzenle"
            initialValues={employeeToForm(employee)}
            pending={formPending}
            error={formError}
            onClose={() => (formPending ? undefined : setFormOpen(false))}
            onSubmit={handleSubmit}
          />

          <AssignmentFormModal
            open={assignmentOpen}
            buildings={buildings}
            pending={assignmentPending}
            error={assignmentError}
            onClose={() => (assignmentPending ? undefined : setAssignmentOpen(false))}
            onSubmit={handleAssignmentSubmit}
          />

          <ConfirmDialog
            open={archiveOpen}
            title="Çalışan arşivlensin mi?"
            description="Çalışan arşivlenecek. Geçmiş görevlendirmeler korunur."
            confirmLabel="Arşivle"
            cancelLabel="Vazgeç"
            danger
            pending={archivePending}
            onConfirm={() => void handleArchive()}
            onClose={() => (archivePending ? undefined : setArchiveOpen(false))}
          />

          <Modal
            open={terminateOpen}
            title="İşten ayrıldı olarak işaretle"
            description="Çalışan pasife alınır ve aktif görevlendirmeler sonlandırılır."
            icon={AlertTriangle}
            iconTone="warning"
            variant="confirm"
            onClose={terminatePending ? () => undefined : () => setTerminateOpen(false)}
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setTerminateOpen(false)}
                  disabled={terminatePending}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="danger"
                  disabled={terminatePending || !terminationDate}
                  onClick={() => void handleTerminate()}
                >
                  {terminatePending ? "İşleniyor..." : "İşaretle"}
                </Button>
              </>
            }
          >
            <FormField label="İşten Çıkış Tarihi" htmlFor="employee-termination-date">
              <Input
                id="employee-termination-date"
                type="date"
                value={terminationDate}
                onChange={(event) => setTerminationDate(event.target.value)}
              />
            </FormField>
          </Modal>

          <Modal
            open={Boolean(ending)}
            title="Görevlendirme sonlandırılsın mı?"
            description="Görevlendirme pasife alınacak ancak geçmiş kaydı korunacaktır."
            icon={AlertTriangle}
            iconTone="warning"
            variant="confirm"
            onClose={endPending ? () => undefined : () => setEnding(null)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setEnding(null)} disabled={endPending}>
                  Vazgeç
                </Button>
                <Button
                  variant="danger"
                  disabled={endPending || !endDate}
                  onClick={() => void handleEndAssignment()}
                >
                  {endPending ? "Sonlandırılıyor..." : "Sonlandır"}
                </Button>
              </>
            }
          >
            <FormField label="Bitiş Tarihi" htmlFor="assignment-end-date">
              <Input
                id="assignment-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </FormField>
          </Modal>
        </>
      ) : null}
    </PageContainer>
  );
}
