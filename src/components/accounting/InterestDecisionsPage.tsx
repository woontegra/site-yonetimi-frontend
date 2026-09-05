"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Percent, Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SectionCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/http";
import {
  applyInterest,
  createInterestDecision,
  deleteInterestDecision,
  listInterestDecisions,
  previewInterest,
  updateInterestDecision,
  type InterestDecision,
  type InterestDecisionStatus,
  type InterestPreviewResult,
  type InterestPreviewRow,
} from "@/lib/interest-api";
import { formatDateTr, formatMoney, MONTH_LABELS } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";

const STATUS_LABELS: Record<InterestDecisionStatus, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  INACTIVE: "Pasif",
};

function statusTone(status: InterestDecisionStatus): BadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "neutral";
  return "warning";
}

function can(user: ReturnType<typeof useAuth>["user"], code: string) {
  if (!user) return false;
  if (!user.permissions?.length) return true;
  return hasPermission(user, code);
}

function emptyForm() {
  const now = new Date();
  const y = now.getFullYear();
  return {
    name: `${y} Yönetim Kurulu Gecikme Faizi Kararı`,
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
    monthlyRate: "5",
    description: "",
    status: "DRAFT" as InterestDecisionStatus,
  };
}

function rowStatusLabel(status: InterestPreviewRow["status"]) {
  if (status === "APPLICABLE") return "Faiz uygulanacak";
  if (status === "ALREADY_APPLIED") return "Daha önce uygulanmış";
  return "Hariç";
}

export function InterestDecisionsPage() {
  const { ready, user } = useAuth();
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { hasSites, siteId } = useActiveSite();

  const canView = can(user, "interest.view");
  const canManage = can(user, "interest.manage");

  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [items, setItems] = useState<InterestDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InterestDecision | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [previewDecision, setPreviewDecision] = useState<InterestDecision | null>(null);
  const [fromYear, setFromYear] = useState(String(new Date().getFullYear()));
  const [fromMonth, setFromMonth] = useState(String(new Date().getMonth() + 1));
  const [toYear, setToYear] = useState(String(new Date().getFullYear()));
  const [toMonth, setToMonth] = useState(String(new Date().getMonth() + 1));
  const [preview, setPreview] = useState<InterestPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InterestDecision | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!ready || !auth || !siteId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await listInterestDecisions(auth, { perPage: 50 });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Faiz kararları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [ready, auth, siteId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    if (!hasSites || !siteId) {
      setNeedSiteOpen(true);
      return;
    }
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (decision: InterestDecision) => {
    setEditing(decision);
    setForm({
      name: decision.name,
      startDate: decision.startDate,
      endDate: decision.endDate,
      monthlyRate: String(Number(decision.monthlyRate)),
      description: decision.description ?? "",
      status: decision.status,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Karar adı zorunludur.";
    if (!form.startDate) next.startDate = "Başlangıç tarihi zorunludur.";
    if (!form.endDate) next.endDate = "Bitiş tarihi zorunludur.";
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      next.endDate = "Başlangıç tarihi bitiş tarihinden sonra olamaz.";
    }
    const rate = Number(form.monthlyRate.replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) next.monthlyRate = "Faiz oranı 0'dan büyük olmalıdır.";
    if (rate > 50) next.monthlyRate = "Aylık faiz oranı en fazla %50 olabilir.";
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth || !canManage || !validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        monthlyRate: Number(form.monthlyRate.replace(",", ".")),
        ratePeriod: "MONTHLY" as const,
        description: form.description.trim() || undefined,
        status: form.status,
      };
      if (editing) {
        await updateInterestDecision(auth, editing.id, payload);
        showToast("Faiz kararı güncellendi.", "success");
      } else {
        await createInterestDecision(auth, payload);
        showToast("Faiz kararı kaydedildi. Faiz henüz uygulanmadı.", "success");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const openPreview = (decision: InterestDecision) => {
    setPreviewDecision(decision);
    const start = decision.startDate.slice(0, 7).split("-");
    const end = decision.endDate.slice(0, 7).split("-");
    setFromYear(start[0] ?? String(new Date().getFullYear()));
    setFromMonth(String(Number(start[1] ?? 1)));
    setToYear(end[0] ?? String(new Date().getFullYear()));
    setToMonth(String(Number(end[1] ?? 12)));
    setPreview(null);
  };

  const runPreview = async () => {
    if (!auth || !previewDecision) return;
    setPreviewLoading(true);
    try {
      const result = await previewInterest(auth, {
        decisionId: previewDecision.id,
        fromYear: Number(fromYear),
        fromMonth: Number(fromMonth),
        toYear: Number(toYear),
        toMonth: Number(toMonth),
      });
      setPreview(result);
    } catch (err) {
      toastError(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const runApply = async () => {
    if (!auth || !previewDecision || !preview) return;
    setApplying(true);
    try {
      const result = await applyInterest(auth, {
        decisionId: previewDecision.id,
        fromYear: Number(fromYear),
        fromMonth: Number(fromMonth),
        toYear: Number(toYear),
        toMonth: Number(toMonth),
      });
      showToast(result.message, "success");
      setApplyConfirmOpen(false);
      await runPreview();
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setApplying(false);
    }
  };

  const deactivate = async (decision: InterestDecision) => {
    if (!auth || !canManage) return;
    try {
      await updateInterestDecision(auth, decision.id, { status: "INACTIVE" });
      showToast("Faiz kararı pasife alındı.", "success");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmDelete = async () => {
    if (!auth || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInterestDecision(auth, deleteTarget.id);
      showToast("Faiz kararı silindi.", "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setDeleting(false);
    }
  };

  const applicableRows = useMemo(
    () => preview?.rows.filter((r) => r.status === "APPLICABLE") ?? [],
    [preview],
  );

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title="Faiz Kararları" description="Bu sayfayı görüntüleme yetkiniz yok." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Faiz Kararları"
        description="Vadesi geçen borçlara uygulanacak gecikme faizi kararlarını yönetin."
        actions={
          canManage ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Yeni faiz kararı
            </Button>
          ) : null
        }
      />

      <SurfaceCard className="mb-4">
        <p className="text-body text-ink-muted">
          Faiz site bazlı ve opsiyoneldir. Karar oluşturulmadan faiz hesaplanmaz; arka planda otomatik faiz
          işletilmez. Ön izleme borç oluşturmaz — faiz yalnız “Faizi Uygula” onayıyla yazılır.
        </p>
      </SurfaceCard>

      {error ? (
        <SurfaceCard className="mb-4 border-danger/30 bg-danger-subtle">
          <p className="text-body text-danger">{error}</p>
        </SurfaceCard>
      ) : null}

      <SectionCard title="Kararlar">
        {loading ? (
          <p className="text-body text-ink-muted">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Percent}
            title="Henüz faiz kararı yok"
            description="Bu siteye varsayılan faiz uygulanmaz. Gecikme faizi için önce bir karar oluşturun."
            action={
              canManage ? (
                <Button type="button" onClick={openCreate}>
                  Karar oluştur
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableElement>
              <THead>
                <TR>
                  <TH>Karar</TH>
                  <TH>Tarih aralığı</TH>
                  <TH>Aylık oran</TH>
                  <TH>Durum</TH>
                  <TH>Uygulama</TH>
                  <TH className="text-right">İşlem</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <div className="font-medium text-ink">{item.name}</div>
                      {item.description ? (
                        <div className="text-caption text-ink-muted">{item.description}</div>
                      ) : null}
                    </TD>
                    <TD>
                      {formatDateTr(item.startDate)} – {formatDateTr(item.endDate)}
                    </TD>
                    <TD>%{Number(item.monthlyRate).toLocaleString("tr-TR", { maximumFractionDigits: 4 })}</TD>
                    <TD>
                      <Badge tone={statusTone(item.status)}>{STATUS_LABELS[item.status]}</Badge>
                    </TD>
                    <TD>{item.applicationCount} borç</TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => openPreview(item)}>
                          Ön izle
                        </Button>
                        {canManage && item.applicationCount === 0 ? (
                          <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(item)}>
                            Düzenle
                          </Button>
                        ) : null}
                        {canManage && item.status !== "INACTIVE" ? (
                          <Button type="button" variant="secondary" size="sm" onClick={() => void deactivate(item)}>
                            Pasife al
                          </Button>
                        ) : null}
                        {canManage && item.status === "INACTIVE" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void (async () => {
                                if (!auth) return;
                                try {
                                  await updateInterestDecision(auth, item.id, { status: "ACTIVE" });
                                  showToast("Faiz kararı aktife alındı.", "success");
                                  await load();
                                } catch (err) {
                                  toastError(err);
                                }
                              })()
                            }
                          >
                            Aktife al
                          </Button>
                        ) : null}
                        {canManage && item.applicationCount === 0 ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(item)}>
                            Sil
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableElement>
          </Table>
        )}
      </SectionCard>

      {previewDecision ? (
        <SectionCard className="mt-4" title={`Ön izleme — ${previewDecision.name}`}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <p className="text-caption text-ink-muted">
              Formül: Aylık basit faiz = yuvarla(kalan ana para × oran% / 100). İlk faiz ayı = vade ayından
              sonraki ay. Ödemeler, faiz ayından önceki ayın son gününe kadar kesilir. Bileşik faiz yok.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewDecision(null)}>
              Kapat
            </Button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <FormField label="Başlangıç yılı">
              <Input value={fromYear} onChange={(e) => setFromYear(e.target.value)} />
            </FormField>
            <FormField label="Başlangıç ayı">
              <Select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}>
                {MONTH_LABELS.map((label, idx) => (
                  <option key={label} value={String(idx + 1)}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Bitiş yılı">
              <Input value={toYear} onChange={(e) => setToYear(e.target.value)} />
            </FormField>
            <FormField label="Bitiş ayı">
              <Select value={toMonth} onChange={(e) => setToMonth(e.target.value)}>
                {MONTH_LABELS.map((label, idx) => (
                  <option key={label} value={String(idx + 1)}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runPreview()} disabled={previewLoading}>
              {previewLoading ? "Hesaplanıyor…" : "Ön İzle"}
            </Button>
            {canManage && preview && applicableRows.length > 0 && previewDecision.status === "ACTIVE" ? (
              <Button type="button" variant="secondary" onClick={() => setApplyConfirmOpen(true)}>
                Faizi Uygula
              </Button>
            ) : null}
          </div>

          {preview ? (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="İncelenen daire" value={String(preview.summary.apartmentsInspected)} />
                <Metric label="Faiz uygulanacak daire" value={String(preview.summary.apartmentsApplicable)} />
                <Metric label="Faize uygun borç satırı" value={String(preview.summary.applicableCount)} />
                <Metric label="Hariç / uygulanmış" value={String(preview.summary.excludedCount + preview.summary.alreadyAppliedCount)} />
                <Metric label="Toplam açık ana para" value={formatMoney(preview.summary.totalOpenPrincipal)} />
                <Metric label="Hesaplanan toplam faiz" value={formatMoney(preview.summary.totalInterest)} />
              </div>
              <p className="mb-3 text-caption text-ink-muted">
                Hesaplama tarihi: {formatDateTr(preview.summary.calculationAsOf)}
              </p>
              {preview.summary.applyMessage ? (
                <p className="mb-3 text-body font-medium text-ink">{preview.summary.applyMessage}</p>
              ) : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableElement>
                    <THead>
                      <TR>
                        <TH>Daire / Kişi</TH>
                        <TH>Ana borç</TH>
                        <TH>Vade</TH>
                        <TH>Dönem</TH>
                        <TH>Esas ana para</TH>
                        <TH>Faiz</TH>
                        <TH>Durum</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {preview.rows.map((row) => (
                        <TR key={`${row.sourceDebtId}-${row.periodYear}-${row.periodMonth}`}>
                          <TD>
                            <div className="font-medium text-ink">
                              {row.buildingName} · Daire {row.apartmentNumber}
                            </div>
                            <div className="text-caption text-ink-muted">
                              {row.personLabel}
                              {row.relationLabel ? ` · ${row.relationLabel}` : ""}
                            </div>
                          </TD>
                          <TD>
                            <div>{row.sourceTitle}</div>
                            <div className="text-caption text-ink-muted">
                              {row.sourcePeriodLabel ?? "—"} · {row.sourceType === "DUES" ? "Aidat" : "Manuel"}
                            </div>
                          </TD>
                          <TD>
                            <div>{formatDateTr(row.dueDate)}</div>
                            <div className="text-caption text-ink-muted">{row.elapsedLabel}</div>
                          </TD>
                          <TD>{row.periodLabel}</TD>
                          <TD>{formatMoney(row.principalBase)}</TD>
                          <TD>{formatMoney(row.interestAmount)}</TD>
                          <TD>
                            <div>{rowStatusLabel(row.status)}</div>
                            {row.excludeReason ? (
                              <div className="text-caption text-ink-muted">{row.excludeReason}</div>
                            ) : null}
                            {row.warning ? (
                              <div className="text-caption text-warning">{row.warning}</div>
                            ) : null}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
            </>
          ) : null}
        </SectionCard>
      ) : null}

      <FormModal
        open={formOpen}
        onClose={() => (saving ? undefined : setFormOpen(false))}
        title={editing ? "Faiz kararını düzenle" : "Yeni faiz kararı"}
        description="Kararı kaydetmek borç oluşturmaz. Ön izleme sonrası faiz uygulanır."
        icon={Percent}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              İptal
            </Button>
            <Button type="submit" form="interest-decision-form" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      >
        <form id="interest-decision-form" onSubmit={onSubmitForm} className="space-y-4">
          <FormField label="Karar adı" error={formErrors.name}>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={Boolean(editing && editing.applicationCount > 0)}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Başlangıç tarihi" error={formErrors.startDate}>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                disabled={Boolean(editing && editing.applicationCount > 0)}
              />
            </FormField>
            <FormField label="Bitiş tarihi" error={formErrors.endDate}>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                disabled={Boolean(editing && editing.applicationCount > 0)}
              />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Aylık faiz oranı (%)"
              error={formErrors.monthlyRate}
              hint="Örn. 5 = ayda %5"
            >
              <Input
                value={form.monthlyRate}
                onChange={(e) => setForm((f) => ({ ...f, monthlyRate: e.target.value }))}
                disabled={Boolean(editing && editing.applicationCount > 0)}
              />
            </FormField>
            <FormField label="Oran periyodu">
              <Select value="MONTHLY" disabled>
                <option value="MONTHLY">Aylık</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Durum">
            <Select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as InterestDecisionStatus }))
              }
            >
              <option value="DRAFT">Taslak</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Pasif</option>
            </Select>
          </FormField>
          <FormField label="Açıklama">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={Boolean(editing && editing.applicationCount > 0)}
              rows={3}
            />
          </FormField>
          {editing && editing.applicationCount > 0 ? (
            <p className="text-caption text-warning">
              Bu faiz kararı daha önce {editing.applicationCount} borca uygulanmıştır. Geçmiş
              hesaplamaların korunması için oran/tarihler değiştirilemez; pasife alabilirsiniz.
            </p>
          ) : null}
        </form>
      </FormModal>

      <ConfirmDialog
        open={applyConfirmOpen}
        onClose={() => setApplyConfirmOpen(false)}
        title="Faizi uygula"
        description={preview?.summary.applyMessage ?? "Seçilen döneme faiz uygulanacak."}
        confirmLabel="Faizi Uygula"
        pending={applying}
        pendingLabel="Uygulanıyor…"
        onConfirm={() => void runApply()}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Faiz kararını sil"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” silinecek. Henüz uygulanmamış kararlar silinebilir.`
            : ""
        }
        confirmLabel="Sil"
        danger
        pending={deleting}
        pendingLabel="Siliniyor…"
        onConfirm={() => void confirmDelete()}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />
    </PageContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-canvas px-3 py-2">
      <div className="text-caption text-ink-muted">{label}</div>
      <div className="text-body font-semibold text-ink">{value}</div>
    </div>
  );
}
