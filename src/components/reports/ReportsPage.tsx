"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  FileSpreadsheet,
  FileText,
  Landmark,
  PieChart,
  Receipt,
  ScrollText,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Fragment } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SectionCard, StatCard, SurfaceCard } from "@/components/ui/SurfaceCard";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import { listBankAccounts, type BankAccount } from "@/lib/banks-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { listExpenseTypes, type ExpenseType } from "@/lib/expenses-api";
import { ApiError } from "@/lib/http";
import { formatDateTr, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/money";
import {
  downloadReportExport,
  fetchReport,
  type ReportQuery,
  type ReportType,
} from "@/lib/reports-api";
import { listSuppliers, type Supplier } from "@/lib/suppliers-api";
import { cn } from "@/lib/cn";
import type { CardTone } from "@/lib/card-tones";

const REPORT_TYPES: Array<{
  id: ReportType;
  title: string;
  description: string;
  icon: typeof PieChart;
  tone: CardTone;
}> = [
  {
    id: "financial-summary",
    title: "Mali Durum Özeti",
    description: "Tahakkuk, tahsilat, gider ve açık borç özeti.",
    icon: PieChart,
    tone: "teal",
  },
  {
    id: "apartment-debts",
    title: "Daire Borç Durumu",
    description: "Daire bazında borç, ödenen ve gecikmiş tutarlar.",
    icon: Wallet,
    tone: "rose",
  },
  {
    id: "payments",
    title: "Tahsilat Raporu",
    description: "Ödemeler, kaynak ve borç dağılımları.",
    icon: Banknote,
    tone: "green",
  },
  {
    id: "expenses",
    title: "Gider Raporu",
    description: "Gider türü, tedarikçi ve ödeme yöntemi.",
    icon: TrendingDown,
    tone: "amber",
  },
  {
    id: "bank-transactions",
    title: "Banka Hareketleri",
    description: "Gelen/giden hareketler ve eşleşmeler.",
    icon: Landmark,
    tone: "cyan",
  },
  {
    id: "apartment-statement",
    title: "Daire Hesap Ekstresi",
    description: "Tek dairenin kronolojik borç/tahsilat dökümü.",
    icon: ScrollText,
    tone: "blue",
  },
];

function defaultDates() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

function hasExportableData(reportType: ReportType, data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  if (reportType === "financial-summary") {
    const summary = data.summary as
      | { accrualCount?: number; collectionCount?: number; expenseCount?: number }
      | undefined;
    const monthly = (data.monthly as unknown[]) ?? [];
    return (
      ((summary?.accrualCount ?? 0) +
        (summary?.collectionCount ?? 0) +
        (summary?.expenseCount ?? 0) >
        0) ||
      monthly.length > 0
    );
  }
  return Array.isArray(data.items) && data.items.length > 0;
}

export function ReportsPage() {
  const { showToast, toastError } = useToast();
  const { site, hasSites } = useActiveSite();
  const auth = useApiAuth({ requireSite: true });
  const defaults = useMemo(() => defaultDates(), []);

  const [reportType, setReportType] = useState<ReportType>("financial-summary");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [buildingId, setBuildingId] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [debtFilter, setDebtFilter] = useState<"all" | "with_debt" | "overdue" | "closed">("all");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [direction, setDirection] = useState("");
  const [matchFilter, setMatchFilter] = useState("all");
  const [expenseStatus, setExpenseStatus] = useState("");

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [needSiteOpen, setNeedSiteOpen] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    void Promise.all([
      listBuildings(auth, { status: "aktif", perPage: 100 }),
      listExpenseTypes(auth, { activeOnly: true }),
      listSuppliers(auth, { perPage: 100 }).catch(() => ({ items: [] as Supplier[] })),
      listBankAccounts(auth, { activeOnly: true, perPage: 100 }).catch(() => ({
        items: [] as BankAccount[],
      })),
    ]).then(([b, e, s, ba]) => {
      setBuildings(b.items);
      setExpenseTypes(e.items);
      setSuppliers(s.items ?? []);
      setBankAccounts(ba.items ?? []);
    });
  }, [auth]);

  useEffect(() => {
    if (!auth || !buildingId) {
      setApartments([]);
      setApartmentId("");
      return;
    }
    void listApartments(auth, { buildingId, status: "aktif", perPage: 200 }).then((result) => {
      setApartments(result.items);
    });
  }, [auth, buildingId]);

  const queryParams = useMemo((): ReportQuery => {
    const base: ReportQuery = {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      buildingId: buildingId || undefined,
      apartmentId: apartmentId || undefined,
    };
    if (reportType === "apartment-debts") base.debtFilter = debtFilter;
    if (reportType === "payments") {
      base.includeCancelled = includeCancelled;
      if (paymentMethod) base.paymentMethod = paymentMethod;
    }
    if (reportType === "expenses") {
      if (expenseTypeId) base.expenseTypeId = expenseTypeId;
      if (supplierId) base.supplierId = supplierId;
      if (paymentMethod) base.paymentMethod = paymentMethod;
      if (expenseStatus) base.status = expenseStatus;
    }
    if (reportType === "bank-transactions") {
      if (bankAccountId) base.bankAccountId = bankAccountId;
      if (direction) base.direction = direction;
      base.matchFilter = matchFilter;
    }
    return base;
  }, [
    apartmentId,
    bankAccountId,
    buildingId,
    dateFrom,
    dateTo,
    debtFilter,
    direction,
    expenseStatus,
    expenseTypeId,
    includeCancelled,
    matchFilter,
    paymentMethod,
    reportType,
    supplierId,
  ]);

  const canExport = hasExportableData(reportType, data);

  async function handleFetch() {
    if (!auth?.siteId) {
      if (!hasSites) setNeedSiteOpen(true);
      return;
    }
    if (reportType === "apartment-statement" && (!buildingId || !apartmentId)) {
      showToast("Daire hesap ekstresi için bina ve daire seçimi zorunludur.", "error");
      return;
    }
    setLoading(true);
    setData(null);
    setExpandedPaymentId(null);
    try {
      const result = await fetchReport(
        { token: auth.token, tenantId: auth.tenantId, siteId: auth.siteId },
        reportType,
        queryParams,
      );
      setData(result);
      if (!hasExportableData(reportType, result)) {
        showToast("Seçtiğiniz filtrelere uygun kayıt bulunamadı.");
      } else {
        showToast("Rapor başarıyla hazırlandı.");
      }
    } catch (error) {
      toastError(error, "Rapor yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    const next = defaultDates();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setBuildingId("");
    setApartmentId("");
    setDebtFilter("all");
    setIncludeCancelled(false);
    setExpenseTypeId("");
    setSupplierId("");
    setPaymentMethod("");
    setBankAccountId("");
    setDirection("");
    setMatchFilter("all");
    setExpenseStatus("");
    setData(null);
  }

  async function handleExport(format: "pdf" | "xlsx") {
    if (!auth?.siteId || !canExport || exporting) return;
    setExporting(format);
    try {
      await downloadReportExport(
        { token: auth.token, tenantId: auth.tenantId, siteId: auth.siteId },
        reportType,
        format,
        queryParams,
      );
      showToast(format === "pdf" ? "PDF indirildi." : "Excel indirildi.");
    } catch (error) {
      toastError(
        error,
        format === "pdf" ? "PDF oluşturulamadı. Lütfen tekrar deneyin." : "Excel indirilemedi.",
      );
    } finally {
      setExporting(null);
    }
  }

  const selectedMeta = REPORT_TYPES.find((item) => item.id === reportType)!;

  return (
    <PageContainer>
      <PageHeader
        title="Raporlar"
        description="Sitenizin mali durumunu inceleyin ve raporlarınızı PDF veya Excel olarak dışa aktarın."
      />

      <SurfaceCard className="mb-4" tone="teal">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Aktif site:{" "}
            <span className="font-medium text-ink">{site?.name ?? "Seçilmedi"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleFetch()} disabled={loading || !auth}>
              {loading ? "Hazırlanıyor…" : "Raporu Getir"}
            </Button>
            <Button type="button" variant="secondary" onClick={clearFilters} disabled={loading}>
              Filtreleri Temizle
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canExport || Boolean(exporting) || loading}
              onClick={() => void handleExport("pdf")}
            >
              <FileText className="size-4" aria-hidden />
              {exporting === "pdf" ? "PDF…" : "PDF İndir"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canExport || Boolean(exporting) || loading}
              onClick={() => void handleExport("xlsx")}
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {exporting === "xlsx" ? "Excel…" : "Excel İndir"}
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_TYPES.map((item) => {
          const Icon = item.icon;
          const active = reportType === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setReportType(item.id);
                setData(null);
              }}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                active ? "border-accent bg-accent-subtle/40" : "border-line bg-surface hover:bg-canvas",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-accent text-white" : "bg-canvas text-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <SectionCard title="Filtreler" description={`${selectedMeta.title} için filtreler.`} tone="neutral">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Başlangıç</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Bitiş</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Bina</span>
            <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
              <option value="">Tümü</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">
              Daire{reportType === "apartment-statement" ? " *" : ""}
            </span>
            <Select
              value={apartmentId}
              onChange={(e) => setApartmentId(e.target.value)}
              disabled={!buildingId}
            >
              <option value="">{buildingId ? "Seçin" : "Önce bina seçin"}</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  Daire {a.number}
                </option>
              ))}
            </Select>
          </label>

          {reportType === "apartment-debts" ? (
            <label className="text-sm">
              <span className="mb-1 block text-muted">Borç durumu</span>
              <Select
                value={debtFilter}
                onChange={(e) => setDebtFilter(e.target.value as typeof debtFilter)}
              >
                <option value="all">Tümü</option>
                <option value="with_debt">Borcu olanlar</option>
                <option value="overdue">Gecikmiş borcu olanlar</option>
                <option value="closed">Borcu kapananlar</option>
              </Select>
            </label>
          ) : null}

          {reportType === "payments" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Ödeme yöntemi</span>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="">Tümü</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={(e) => setIncludeCancelled(e.target.checked)}
                />
                İptal edilenleri göster
              </label>
            </>
          ) : null}

          {reportType === "expenses" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Gider türü</span>
                <Select value={expenseTypeId} onChange={(e) => setExpenseTypeId(e.target.value)}>
                  <option value="">Tümü</option>
                  {expenseTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Tedarikçi</span>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Tümü</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Ödeme yöntemi</span>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="">Tümü</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Durum</span>
                <Select value={expenseStatus} onChange={(e) => setExpenseStatus(e.target.value)}>
                  <option value="">Tamamlanan (varsayılan)</option>
                  <option value="COMPLETED">Tamamlandı</option>
                  <option value="CANCELLED">İptal</option>
                </Select>
              </label>
            </>
          ) : null}

          {reportType === "bank-transactions" ? (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Banka hesabı</span>
                <Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                  <option value="">Tümü</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} / {a.accountName}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Yön</span>
                <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="CREDIT">Gelen</option>
                  <option value="DEBIT">Giden</option>
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Eşleşme</span>
                <Select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)}>
                  <option value="all">Tümü</option>
                  <option value="matched">Eşleşen</option>
                  <option value="unmatched">Eşleşmeyen</option>
                  <option value="to_payment">Tahsilata aktarılan</option>
                  <option value="to_expense">Gidere aktarılan</option>
                  <option value="ignored">Hariç tutulan</option>
                </Select>
              </label>
            </>
          ) : null}
        </div>
      </SectionCard>

      <div className="mt-4">
        {loading ? <p className="text-sm text-muted">Rapor hazırlanıyor…</p> : null}
        {!loading && !data ? (
          <EmptyState
            icon={Receipt}
            title="Rapor türü seçin ve getirin"
            description="Özet kartlardan bir rapor seçin, filtreleri ayarlayın ve Raporu Getir’e basın."
            compact
          />
        ) : null}
        {!loading && data ? <ReportResult reportType={reportType} data={data} expandedPaymentId={expandedPaymentId} onTogglePayment={setExpandedPaymentId} /> : null}
      </div>

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />
    </PageContainer>
  );
}

function ReportResult({
  reportType,
  data,
  expandedPaymentId,
  onTogglePayment,
}: {
  reportType: ReportType;
  data: Record<string, unknown>;
  expandedPaymentId: string | null;
  onTogglePayment: (id: string | null) => void;
}) {
  if (reportType === "financial-summary") {
    const summary = data.summary as {
      accrualTotal: string;
      collectionTotal: string;
      expenseTotal: string;
      openDebtTotal: string;
      collectionRate: number | null;
      collectionVsExpense: string;
    };
    const monthly = (data.monthly as Array<Record<string, string>>) ?? [];
    const methods = (data.paymentMethods as Array<{ methodLabel: string; amount: string; count: number }>) ?? [];
    const definitions = data.definitions as Record<string, string>;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Tahakkuk" value={formatMoney(summary.accrualTotal)} tone="blue" hint={definitions.accrual} />
          <StatCard label="Tahsilat" value={formatMoney(summary.collectionTotal)} tone="green" hint={definitions.collection} />
          <StatCard label="Gider" value={formatMoney(summary.expenseTotal)} tone="amber" hint={definitions.expense} />
          <StatCard label="Açık borç" value={formatMoney(summary.openDebtTotal)} tone="rose" hint={definitions.openDebt} />
          <StatCard
            label="Tahsilat oranı"
            value={summary.collectionRate == null ? "—" : `%${summary.collectionRate}`}
            tone="teal"
          />
          <StatCard label="Tahsilat − Gider" value={formatMoney(summary.collectionVsExpense)} tone="cyan" />
        </div>
        {methods.length ? (
          <SectionCard title="Tahsilat yöntemi dağılımı" tone="green">
            <ul className="space-y-1 text-sm">
              {methods.map((m) => (
                <li key={m.methodLabel} className="flex justify-between gap-3">
                  <span>{m.methodLabel} ({m.count})</span>
                  <span className="font-medium">{formatMoney(m.amount)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
        <SectionCard title="Aylık özet" tone="teal">
          <ReportTable
            headers={["Dönem", "Tahakkuk", "Tahsilat", "Gider"]}
            rows={monthly.map((row) => [
              row.periodLabel,
              formatMoney(row.accrual),
              formatMoney(row.collection),
              formatMoney(row.expense),
            ])}
          />
        </SectionCard>
      </div>
    );
  }

  if (reportType === "apartment-debts") {
    const summary = data.summary as {
      indebtedApartmentCount: number;
      openDebtTotal: string;
      openPrincipalTotal?: string;
      openInterestTotal?: string;
      overdueTotal: string;
      collectedTotal: string;
    };
    const items = (data.items as Array<Record<string, unknown>>) ?? [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard label="Borçlu daire" value={String(summary.indebtedApartmentCount)} tone="rose" />
          <StatCard label="Toplam açık borç" value={formatMoney(summary.openDebtTotal)} tone="rose" />
          <StatCard
            label="Açık ana para"
            value={formatMoney(summary.openPrincipalTotal ?? summary.openDebtTotal)}
            tone="rose"
          />
          <StatCard
            label="Açık gecikme faizi"
            value={formatMoney(summary.openInterestTotal ?? "0")}
            tone="amber"
          />
          <StatCard label="Gecikmiş borç" value={formatMoney(summary.overdueTotal)} tone="amber" />
          <StatCard label="Tahsil edilmiş" value={formatMoney(summary.collectedTotal)} tone="green" />
        </div>
        <ReportTable
          headers={[
            "Daire",
            "Malik",
            "Kiracı / sakin",
            "Toplam",
            "Ödenen",
            "Kalan",
            "Ana para",
            "Faiz",
            "En eski açık",
            "Gecikmiş",
            "Durum",
          ]}
          rows={items.map((row) => [
            String(row.apartmentLabel),
            String(row.ownerName ?? "—"),
            String(row.tenantName ?? row.displayPerson ?? "Kayıtlı kişi yok"),
            formatMoney(String(row.totalDebt)),
            formatMoney(String(row.paid)),
            formatMoney(String(row.remaining)),
            formatMoney(String(row.remainingPrincipal ?? row.remaining)),
            formatMoney(String(row.remainingInterest ?? "0")),
            row.oldestOpenDueDate ? formatDateTr(String(row.oldestOpenDueDate)) : "—",
            formatMoney(String(row.overdue)),
            String(row.statusLabel),
          ])}
        />
      </div>
    );
  }

  if (reportType === "payments") {
    const summary = data.summary as { totalAmount: string; count: number };
    const items = (data.items as Array<Record<string, unknown>>) ?? [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Toplam tahsilat" value={formatMoney(summary.totalAmount)} tone="green" />
          <StatCard label="Kayıt sayısı" value={String(summary.count)} tone="green" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableElement>
              <THead>
                <TR className="hover:bg-transparent">
                  {["Ödeme tarihi", "Bina / daire", "Malik / sakin", "Tutar", "Yöntem", "Kaynak", "Durum", ""].map(
                    (h) => (
                      <TH key={h}>{h}</TH>
                    ),
                  )}
                </TR>
              </THead>
              <TBody>
                {items.length === 0 ? (
                  <TR>
                    <TD colSpan={8} className="py-6 text-center text-sm text-muted">
                      Seçtiğiniz filtrelere uygun kayıt bulunamadı.
                    </TD>
                  </TR>
                ) : (
                  items.map((row) => {
                    const id = String(row.id);
                    const allocations = (row.allocations as Array<Record<string, string>>) ?? [];
                    return (
                      <Fragment key={id}>
                        <TR>
                          <TD>{formatDateTr(String(row.paymentDate))}</TD>
                          <TD>{String(row.apartmentLabel)}</TD>
                          <TD>{String(row.personName)}</TD>
                          <TD>{formatMoney(String(row.amount))}</TD>
                          <TD>{String(row.paymentMethodLabel)}</TD>
                          <TD>{String(row.source)}</TD>
                          <TD>{String(row.statusLabel)}</TD>
                          <TD>
                            {allocations.length ? (
                              <button
                                type="button"
                                className="text-sm text-accent hover:underline"
                                onClick={() =>
                                  onTogglePayment(expandedPaymentId === id ? null : id)
                                }
                              >
                                Dağılım
                              </button>
                            ) : null}
                          </TD>
                        </TR>
                        {expandedPaymentId === id ? (
                          <TR className="hover:bg-transparent">
                            <TD colSpan={8} className="bg-canvas/50 text-sm text-muted">
                              {allocations.map((a) => (
                                <div key={a.id}>
                                  {a.debtTitle}: {formatMoney(a.amount)}
                                </div>
                              ))}
                              {row.description ? <div>Açıklama: {String(row.description)}</div> : null}
                            </TD>
                          </TR>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TBody>
            </TableElement>
          </Table>
        </div>
      </div>
    );
  }

  if (reportType === "expenses") {
    const summary = data.summary as {
      totalAmount: string;
      topExpenseType: string;
      count: number;
      monthlyAverage: string;
    };
    const items = (data.items as Array<Record<string, unknown>>) ?? [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Toplam gider" value={formatMoney(summary.totalAmount)} tone="amber" />
          <StatCard label="En yüksek tür" value={summary.topExpenseType} tone="amber" />
          <StatCard label="Kayıt" value={String(summary.count)} tone="amber" />
          <StatCard label="Aylık ortalama" value={formatMoney(summary.monthlyAverage)} tone="amber" />
        </div>
        <ReportTable
          headers={["Tarih", "Tür", "Açıklama", "Tedarikçi", "Tutar", "Yöntem", "Banka/kasa", "Belge", "Durum"]}
          rows={items.map((row) => [
            formatDateTr(String(row.expenseDate)),
            String(row.expenseTypeName),
            String(row.title),
            String(row.supplierName ?? "—"),
            formatMoney(String(row.amount)),
            String(row.paymentMethodLabel),
            String(row.bankInfo ?? "—"),
            String(row.referenceNo ?? "—"),
            String(row.statusLabel),
          ])}
        />
      </div>
    );
  }

  if (reportType === "bank-transactions") {
    const summary = data.summary as { incomingTotal: string; outgoingTotal: string; count: number };
    const items = (data.items as Array<Record<string, unknown>>) ?? [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Gelen" value={formatMoney(summary.incomingTotal)} tone="green" />
          <StatCard label="Giden" value={formatMoney(summary.outgoingTotal)} tone="rose" />
          <StatCard label="Kayıt" value={String(summary.count)} tone="cyan" />
        </div>
        <p className="text-sm text-muted">
          Giden hareketler burada görünür; tahsilat toplamına dahil edilmez.
        </p>
        <ReportTable
          headers={["Tarih", "Hesap", "Açıklama", "Gelen", "Giden", "Daire", "Kişi", "Güven", "Durum", "Bağlantı"]}
          rows={items.map((row) => [
            formatDateTr(String(row.transactionDate)),
            String(row.bankAccountLabel),
            String(row.description),
            row.incoming ? formatMoney(String(row.incoming)) : "—",
            row.outgoing ? formatMoney(String(row.outgoing)) : "—",
            String(row.apartmentLabel ?? "—"),
            String(row.personName ?? "—"),
            String(row.confidence),
            String(row.matchStatusLabel),
            String(row.linkLabel ?? "—"),
          ])}
        />
      </div>
    );
  }

  // apartment-statement
  const apartment = data.apartment as {
    label: string;
    ownerName: string | null;
    tenantName: string | null;
    displayPerson: string;
  };
  const summary = data.summary as {
    openingBalance: string;
    closingBalance: string;
    periodDebit: string;
    periodCredit: string;
  };
  const items = (data.items as Array<Record<string, unknown>>) ?? [];
  const site = data.site as { name: string };
  return (
    <div className="space-y-4">
      <SectionCard title="Hesap özeti" tone="blue">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-muted">Site</dt><dd className="font-medium">{site.name}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">Daire</dt><dd className="font-medium">{apartment.label}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">Malik</dt><dd className="font-medium">{apartment.ownerName ?? "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">Kiracı / sakin</dt><dd className="font-medium">{apartment.tenantName ?? apartment.displayPerson}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">Önceki dönem devri</dt><dd className="font-medium">{formatMoney(summary.openingBalance)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">Kapanış bakiyesi</dt><dd className="font-medium">{formatMoney(summary.closingBalance)}</dd></div>
        </dl>
      </SectionCard>
      <ReportTable
        headers={["Tarih", "İşlem", "Açıklama", "Borç", "Tahsilat", "Bakiye"]}
        rows={items.map((row) => [
          formatDateTr(String(row.date)),
          String(row.typeLabel),
          String(row.description),
          row.debit ? formatMoney(String(row.debit)) : "—",
          row.credit ? formatMoney(String(row.credit)) : "—",
          formatMoney(String(row.balance)),
        ])}
      />
    </div>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              {headers.map((h) => (
                <TH key={h}>{h}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={headers.length} className="py-6 text-center text-sm text-muted">
                  Seçtiğiniz filtrelere uygun kayıt bulunamadı.
                </TD>
              </TR>
            ) : (
              rows.map((row, index) => (
                <TR key={index}>
                  {row.map((cell, cellIndex) => (
                    <TD key={cellIndex}>{cell}</TD>
                  ))}
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>
    </div>
  );
}
