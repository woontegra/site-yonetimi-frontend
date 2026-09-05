"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, MoreHorizontal, Search, X } from "lucide-react";
import { ApartmentCombobox } from "@/components/apartments/ApartmentCombobox";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  foldSearchText,
  formatApartmentOccupantLabel,
  getApartmentOccupantView,
} from "@/lib/apartment-labels";
import type { Apartment } from "@/lib/apartments-api";
import {
  isGenericMatchKey,
  parseCounterpartyFromDescription,
} from "@/lib/bank-statement-counterparty";
import type { StatementPreviewRow } from "@/lib/banks-api";
import { cn } from "@/lib/cn";
import { formatDateTr, formatMoney } from "@/lib/money";
import {
  buildMatchDisplay,
  isBulkApprovableMatch,
  matchReasonOf,
} from "@/lib/statement-match-display";

export type RowDecision = "COLLECT" | "BANK_ONLY" | "LATER" | "EXCLUDE";

export type RowWorkState = {
  decision: RowDecision | null;
  directionOverride: "CREDIT" | "DEBIT" | null;
  directionConfirmed: boolean;
  apartmentId: string | null;
  personId: string | null;
  createRule: boolean;
  ruleText: string;
  selected: boolean;
};

export type StatementReviewSummary = {
  totalRows: number;
  creditCount: number;
  debitCount: number;
  invalidCount: number;
  duplicateCount: number;
  autoMatchedCount: number;
  unmatchedCount: number;
  importableCreditTotal: string;
};

type DirectionFilter = "ALL" | "CREDIT" | "DEBIT";
type MatchFilter =
  | "ALL"
  | "UNMATCHED"
  | "AUTO"
  | "MANUAL"
  | "SUSPECT"
  | "DUPLICATE"
  | "EXCLUDED";

const PAGE_SIZE = 50;

function needsDirectionConfirm(row: StatementPreviewRow): boolean {
  return Boolean(
    row.message?.toLocaleLowerCase("tr-TR").includes("tutar yönü") ||
      (row as { warnings?: string[] }).warnings?.some?.((w) =>
        w.toLocaleLowerCase("tr-TR").includes("tutar yönü"),
      ),
  );
}

function rowNeedsDirection(
  row: StatementPreviewRow,
  directionSuspectIds: Set<number>,
): boolean {
  return directionSuspectIds.has(row.rowIndex) || needsDirectionConfirm(row);
}

function effectiveDirection(row: StatementPreviewRow, work: RowWorkState): "CREDIT" | "DEBIT" {
  return work.directionOverride ?? row.direction;
}

/** Gerçek otomatik eşleşme: seçilebilir apartmentId + HIGH/MEDIUM; onaylanmamış. */
function isRealAutoMatched(row: StatementPreviewRow, work: RowWorkState): boolean {
  if (
    work.decision === "COLLECT" ||
    work.decision === "EXCLUDE" ||
    work.decision === "BANK_ONLY" ||
    work.decision === "LATER"
  ) {
    return false;
  }
  const aptId = work.apartmentId ?? row.match?.apartmentId;
  return (
    row.direction === "CREDIT" &&
    row.previewStatus === "READY" &&
    row.match?.matchStatus === "SUGGESTED" &&
    Boolean(aptId) &&
    (row.match.confidence === "HIGH" || row.match.confidence === "MEDIUM")
  );
}

function isManuallyMatched(work: RowWorkState): boolean {
  return work.decision === "COLLECT" && Boolean(work.apartmentId);
}

function personExistsInSite(name: string | null, apartments: Apartment[]): boolean {
  if (!name || isGenericMatchKey(name)) return false;
  const needle = foldSearchText(name);
  if (needle.length < 3) return false;
  return apartments.some((apt) => {
    const view = getApartmentOccupantView(apt);
    return [...view.owners, ...view.tenants].some((person) => {
      const full = foldSearchText(person.fullName);
      return full === needle || full.includes(needle) || needle.includes(full);
    });
  });
}

function matchLabel(
  row: StatementPreviewRow,
  work: RowWorkState,
  apartments: Apartment[],
  partyName: string | null,
): { title: string; subtitle: string; reason: string } {
  const aptId = work.apartmentId ?? row.match?.apartmentId ?? null;
  const apt = aptId ? apartments.find((a) => a.id === aptId) : null;
  if (apt) {
    const view = getApartmentOccupantView(apt);
    return {
      title: `${view.buildingName} · Daire ${view.apartmentNumber}`,
      subtitle: view.personLine,
      reason: work.apartmentId
        ? "Manuel eşleştirme"
        : row.match?.reason ?? "Otomatik öneri",
    };
  }
  if (aptId && row.match?.matchStatus === "SUGGESTED") {
    return {
      title: "Daire eşleşti (liste yenilenmeli)",
      subtitle: row.match.reason,
      reason: row.match.reason,
    };
  }
  if (row.previewStatus === "AMBIGUOUS" || (row.match?.candidateCount ?? 0) > 1) {
    return {
      title: row.match?.reason || "Birden fazla daire adayı",
      subtitle: "",
      reason: row.match?.reason ?? "",
    };
  }
  if (partyName && !personExistsInSite(partyName, apartments)) {
    return {
      title: "Eşleşme bulunamadı",
      subtitle: "Bu gönderen aktif site sakinleri arasında bulunamadı.",
      reason: row.match?.reason ?? "",
    };
  }
  if (partyName && personExistsInSite(partyName, apartments)) {
    return {
      title: "Eşleşme bulunamadı",
      subtitle: "Gönderen sakinlerde var; daire bağlantısı kurulamadı.",
      reason: row.match?.reason ?? "",
    };
  }
  return {
    title: row.message || row.match?.reason || "Eşleşme bulunamadı",
    subtitle: "",
    reason: row.match?.reason ?? "",
  };
}

function confidenceTone(confidence: string | undefined) {
  if (confidence === "HIGH") return "success" as const;
  if (confidence === "MEDIUM") return "warning" as const;
  if (confidence === "LOW") return "neutral" as const;
  return "neutral" as const;
}

function confidenceLabel(confidence: string | undefined) {
  if (confidence === "HIGH") return "Yüksek";
  if (confidence === "MEDIUM") return "Orta";
  if (confidence === "LOW") return "Düşük";
  return "—";
}

function decisionLabel(
  decision: RowDecision | null,
  row: StatementPreviewRow,
  work?: RowWorkState,
): string {
  const workHasManual = Boolean(work?.apartmentId);
  if (row.previewStatus === "DUPLICATE") return "Mükerrer";
  if (decision === "COLLECT") return "Onaylandı";
  if (decision === "BANK_ONLY") return "Yalnız banka hareketi";
  if (decision === "LATER") return "Daha sonra eşleştir";
  if (decision === "EXCLUDE") return "Hariç";
  if (row.direction === "DEBIT" || row.previewStatus === "DEBIT_SKIP_PAYMENT") {
    return "Giden — tahsilat yok";
  }
  if (isRealAutoMatched(row, work ?? emptyRowWork()) || workHasManual) {
    return "Öneri — Onay bekliyor";
  }
  return "Çözülmemiş";
}

function primaryActionLabel(row: StatementPreviewRow, work: RowWorkState, dir: "CREDIT" | "DEBIT") {
  if (dir === "DEBIT") return "İncele";
  if (work.decision === "COLLECT") return "Kontrol Et";
  if (isRealAutoMatched(row, work) || isManuallyMatched(work)) return "Kontrol Et";
  return "Eşleştir";
}

function MatchSuggestionCell({
  display,
  senderName,
}: {
  display: ReturnType<typeof buildMatchDisplay>;
  senderName: string | null;
}) {
  if (!display) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div className="space-y-1">
      {senderName ? (
        <p className="text-[11px] leading-tight text-muted">
          <span className="font-medium text-ink/80">{senderName}</span>
          <span className="mx-1 text-muted">→</span>
        </p>
      ) : null}
      <p className="text-[13px] font-medium leading-snug text-ink">{display.buildingLine}</p>
      {display.ownersLine && display.tenantsLine ? (
        <div className="space-y-0.5 text-xs leading-snug text-ink">
          <p className={cn(display.nameMismatch && "text-warning")}>{display.ownersLine}</p>
          <p>{display.tenantsLine}</p>
        </div>
      ) : display.personLine ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-xs leading-snug text-ink",
              display.nameMismatch && "text-warning",
            )}
          >
            {display.personLine}
          </span>
          {display.roleBadge ? (
            <Badge tone={display.roleBadge === "Kiracı" ? "info" : "neutral"}>
              {display.roleBadge}
            </Badge>
          ) : null}
          {display.nameMismatch ? (
            <AlertTriangle className="size-3.5 text-warning" aria-label="İsim uyuşmazlığı" />
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted">Kişi atanmamış</span>
      )}
    </div>
  );
}

type SuspectKind =
  | "direction"
  | "balance"
  | "no_sender"
  | "ambiguous"
  | "no_debt"
  | "low_parse";

type Props = {
  step: 3 | 4;
  rows: StatementPreviewRow[];
  summary: StatementReviewSummary | null;
  apartments: Apartment[];
  apartmentsLoading?: boolean;
  work: Record<number, RowWorkState>;
  onWorkChange: (rowIndex: number, patch: Partial<RowWorkState>) => void;
  onWorkBatch: (indexes: number[], patch: Partial<RowWorkState>) => void;
  warnings: string[];
  directionSuspectIds: Set<number>;
  parseErrorCount: number;
};

export function emptyRowWork(): RowWorkState {
  return {
    decision: null,
    directionOverride: null,
    directionConfirmed: false,
    apartmentId: null,
    personId: null,
    createRule: false,
    ruleText: "",
    selected: false,
  };
}

export function StatementReviewWorkspace({
  step,
  rows,
  summary,
  apartments,
  apartmentsLoading = false,
  work,
  onWorkChange,
  onWorkBatch,
  warnings,
  directionSuspectIds,
  parseErrorCount,
}: Props) {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("CREDIT");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("UNMATCHED");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [suspectOpen, setSuspectOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null);
  const [matchMode, setMatchMode] = useState(false);
  const [drawerRejectOpen, setDrawerRejectOpen] = useState(false);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);

  const enriched = useMemo(() => {
    return rows.map((row) => {
      const w = work[row.rowIndex] ?? emptyRowWork();
      const dir = effectiveDirection(row, w);
      const party = parseCounterpartyFromDescription(row.description, dir);
      const directionSuspect = rowNeedsDirection(row, directionSuspectIds);
      return { row, work: w, dir, party, directionSuspect };
    });
  }, [rows, work, directionSuspectIds]);

  /** READ-ONLY gerçek otomatik sayımı — summary’ye körü körüne güvenme. */
  const liveStats = useMemo(() => {
    let withApartmentId = 0;
    let withPersonId = 0;
    let highReady = 0;
    let withDebtPreview = 0;
    let textualOnly = 0;
    let ambiguous = 0;
    let unmatchedCredit = 0;
    let realAuto = 0;
    let orphanApartmentId = 0;

    const suspectBreakdown: Record<SuspectKind, number> = {
      direction: 0,
      balance: 0,
      no_sender: 0,
      ambiguous: 0,
      no_debt: 0,
      low_parse: 0,
    };

    for (const { row, work: w, dir, party, directionSuspect } of enriched) {
      if (dir === "CREDIT" && row.previewStatus === "AMBIGUOUS") {
        ambiguous += 1;
        suspectBreakdown.ambiguous += 1;
      }
      if (directionSuspect && !w.directionConfirmed) suspectBreakdown.direction += 1;
      if (!party.counterpartyName && dir === "CREDIT") suspectBreakdown.no_sender += 1;
      if (row.previewStatus === "AMBIGUOUS") {
        /* already counted */
      }
      if (
        row.match?.matchStatus === "SUGGESTED" &&
        row.match.apartmentId &&
        !(row.allocationPreview?.length) &&
        dir === "CREDIT"
      ) {
        suspectBreakdown.no_debt += 1;
      }

      if (isRealAutoMatched(row, w)) {
        realAuto += 1;
        withApartmentId += 1;
        if (row.match?.personId) withPersonId += 1;
        if (row.match?.confidence === "HIGH" && row.canAutoProcess) highReady += 1;
        if (row.allocationPreview && row.allocationPreview.length > 0) withDebtPreview += 1;
        if (!apartments.some((a) => a.id === row.match!.apartmentId)) orphanApartmentId += 1;
      } else if (
        dir === "CREDIT" &&
        row.match?.matchStatus === "SUGGESTED" &&
        !row.match.apartmentId
      ) {
        textualOnly += 1;
      }

      const auto = isRealAutoMatched(row, w);
      const manual = isManuallyMatched(w);
      if (
        dir === "CREDIT" &&
        row.previewStatus !== "DUPLICATE" &&
        !auto &&
        !manual &&
        w.decision !== "COLLECT"
      ) {
        unmatchedCredit += 1;
      }
    }

    if (warnings.some((w) => w.toLocaleLowerCase("tr-TR").includes("bakiye"))) {
      suspectBreakdown.balance = enriched.filter((e) => e.dir === "CREDIT").length;
    }
    if (parseErrorCount > 0) suspectBreakdown.low_parse = parseErrorCount;

    return {
      realAuto,
      withApartmentId,
      withPersonId,
      highReady,
      withDebtPreview,
      textualOnly,
      ambiguous,
      unmatchedCredit,
      orphanApartmentId,
      suspectBreakdown,
      directionSuspectCount: enriched.filter(
        (e) => e.directionSuspect && !e.work.directionConfirmed,
      ).length,
    };
  }, [enriched, apartments, warnings, parseErrorCount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return enriched.filter(({ row, work: w, dir, party, directionSuspect }) => {
      if (directionFilter === "CREDIT" && dir !== "CREDIT") return false;
      if (directionFilter === "DEBIT" && dir !== "DEBIT") return false;

      const excluded = w.decision === "EXCLUDE" || row.previewStatus === "DUPLICATE";
      const auto = isRealAutoMatched(row, w);
      const manual = isManuallyMatched(w);
      const unmatched =
        dir === "CREDIT" &&
        row.previewStatus !== "DUPLICATE" &&
        !auto &&
        !manual &&
        w.decision !== "COLLECT";

      if (matchFilter === "UNMATCHED" && !unmatched) return false;
      if (matchFilter === "AUTO" && !auto) return false;
      if (matchFilter === "MANUAL" && !manual) return false;
      if (matchFilter === "SUSPECT" && !(directionSuspect && !w.directionConfirmed)) {
        return false;
      }
      if (matchFilter === "DUPLICATE" && row.previewStatus !== "DUPLICATE") return false;
      if (matchFilter === "EXCLUDED" && !excluded) return false;

      if (!q) return true;
      const aptId = w.apartmentId ?? row.match?.apartmentId;
      const apt = aptId ? apartments.find((a) => a.id === aptId) : null;
      const hay = [
        row.description,
        party.counterpartyName ?? "",
        row.referenceNo ?? "",
        party.referenceHint ?? "",
        apt ? formatApartmentOccupantLabel(apt) : "",
        String(row.amount),
        row.message,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return hay.includes(q);
    });
  }, [enriched, directionFilter, matchFilter, search, apartments]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const selectedIndexes = filtered.filter((f) => f.work.selected).map((f) => f.row.rowIndex);

  const decisionTotals = useMemo(() => {
    let collect = 0;
    let collectAmount = 0;
    let bankOnly = 0;
    let later = 0;
    let exclude = 0;
    let duplicate = 0;
    let unresolved = 0;
    let unresolvedSuspect = 0;

    for (const { row, work: w, dir, directionSuspect } of enriched) {
      if (row.previewStatus === "DUPLICATE") {
        duplicate += 1;
        continue;
      }
      if (directionSuspect && !w.directionConfirmed) unresolvedSuspect += 1;
      const decision =
        w.decision ??
        (dir === "DEBIT" || row.previewStatus === "DEBIT_SKIP_PAYMENT" ? "BANK_ONLY" : null);
      if (decision === "COLLECT") {
        collect += 1;
        if (dir === "CREDIT") collectAmount += row.amount;
      } else if (decision === "BANK_ONLY") bankOnly += 1;
      else if (decision === "LATER") later += 1;
      else if (decision === "EXCLUDE") exclude += 1;
      else if (dir === "CREDIT") unresolved += 1;
      else bankOnly += 1;
    }
    return {
      collect,
      collectAmount,
      bankOnly,
      later,
      exclude,
      duplicate,
      unresolved,
      unresolvedSuspect,
    };
  }, [enriched]);

  const bulkCandidates = useMemo(() => {
    return enriched.filter(
      ({ row, work: w, dir }) =>
        dir === "CREDIT" &&
        w.decision !== "COLLECT" &&
        w.decision !== "EXCLUDE" &&
        isRealAutoMatched(row, w) &&
        isBulkApprovableMatch(row.match),
    );
  }, [enriched]);

  const bulkKindCounts = useMemo(() => {
    const counts = { owner: 0, tenant: 0, rule: 0, nameAndApt: 0 };
    for (const { row } of bulkCandidates) {
      const kind = row.match?.matchKind;
      if (kind === "FULL_NAME_OWNER") counts.owner += 1;
      else if (kind === "FULL_NAME_TENANT") counts.tenant += 1;
      else if (kind === "RULE") counts.rule += 1;
      else if (kind === "NAME_AND_APARTMENT") counts.nameAndApt += 1;
    }
    return counts;
  }, [bulkCandidates]);

  const drawerRow =
    drawerIndex != null ? enriched.find((item) => item.row.rowIndex === drawerIndex) : null;

  function openDrawer(rowIndex: number, match = false) {
    setDrawerIndex(rowIndex);
    setMatchMode(match);
    setDrawerRejectOpen(false);
  }

  function approveRow(rowIndex: number) {
    const item = enriched.find((e) => e.row.rowIndex === rowIndex);
    if (!item) return;
    const aptId = item.work.apartmentId ?? item.row.match?.apartmentId ?? null;
    const personId = item.work.personId ?? item.row.match?.personId ?? null;
    onWorkChange(rowIndex, {
      decision: "COLLECT",
      apartmentId: aptId,
      personId,
    });
  }

  function applyCardFilter(
    kind: "total" | "credit" | "debit" | "auto" | "unmatched" | "suspect" | "duplicate",
  ) {
    setPage(0);
    setSearch("");
    if (kind === "total") {
      setDirectionFilter("ALL");
      setMatchFilter("ALL");
    } else if (kind === "credit") {
      setDirectionFilter("CREDIT");
      setMatchFilter("ALL");
    } else if (kind === "debit") {
      setDirectionFilter("DEBIT");
      setMatchFilter("ALL");
    } else if (kind === "auto") {
      setDirectionFilter("CREDIT");
      setMatchFilter("AUTO");
    } else if (kind === "unmatched") {
      setDirectionFilter("CREDIT");
      setMatchFilter("UNMATCHED");
    } else if (kind === "suspect") {
      setDirectionFilter("ALL");
      setMatchFilter("SUSPECT");
      setSuspectOpen(true);
    } else {
      setDirectionFilter("ALL");
      setMatchFilter("DUPLICATE");
    }
  }

  const filterSummary = useMemo(() => {
    const dirLabel =
      directionFilter === "CREDIT"
        ? "gelen"
        : directionFilter === "DEBIT"
          ? "giden"
          : "";
    const matchLabelText =
      matchFilter === "UNMATCHED"
        ? "eşleşmeyen"
        : matchFilter === "AUTO"
          ? "otomatik eşleşen"
          : matchFilter === "MANUAL"
            ? "manuel eşleşen"
            : matchFilter === "SUSPECT"
              ? "şüpheli yön"
              : matchFilter === "DUPLICATE"
                ? "mükerrer"
                : matchFilter === "EXCLUDED"
                  ? "hariç"
                  : "";
    const parts = [dirLabel, matchLabelText].filter(Boolean);
    if (!parts.length) return `Görüntülenen: ${filtered.length} hareket`;
    return `Görüntülenen: ${filtered.length} ${parts.join(" ")} hareket`;
  }, [directionFilter, matchFilter, filtered.length]);

  const displayAuto = liveStats.realAuto;
  const displayUnmatched = liveStats.unmatchedCredit;
  const displaySuspect = liveStats.directionSuspectCount;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {summary ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {(
            [
              ["Toplam", summary.totalRows, "total" as const],
              ["Gelen", summary.creditCount, "credit" as const],
              ["Giden", summary.debitCount, "debit" as const],
              ["Otomatik", displayAuto, "auto" as const],
              ["Eşleşmeyen", displayUnmatched, "unmatched" as const],
              ["Şüpheli yön", displaySuspect, "suspect" as const],
              ["Onaylanan", decisionTotals.collect, null],
              ["Tahsilat tutarı", formatMoney(decisionTotals.collectAmount), null],
            ] as const
          ).map(([label, value, kind]) => (
            <button
              key={label}
              type="button"
              disabled={!kind}
              onClick={() => kind && applyCardFilter(kind)}
              className={cn(
                "rounded-md border border-line bg-canvas px-2.5 py-2 text-left",
                kind && "transition-colors hover:border-accent/40 hover:bg-accent-subtle/40",
                kind === "auto" && matchFilter === "AUTO" && "border-accent bg-accent-subtle/50",
                kind === "unmatched" &&
                  matchFilter === "UNMATCHED" &&
                  "border-accent bg-accent-subtle/50",
              )}
            >
              <p className="text-[11px] text-muted">{label}</p>
              <p className="text-[13px] font-medium text-ink">{value}</p>
            </button>
          ))}
        </div>
      ) : null}

      <p className="shrink-0 text-xs text-muted">
        {filterSummary}
        {matchFilter === "UNMATCHED" && displayAuto > 0 ? (
          <>
            {" "}
            · Otomatik {displayAuto} satır gizli —{" "}
            <button
              type="button"
              className="font-medium text-accent underline-offset-2 hover:underline"
              onClick={() => applyCardFilter("auto")}
            >
              Otomatik eşleşenleri göster
            </button>
          </>
        ) : null}
        {displayAuto === 0 && summary && summary.autoMatchedCount > 0 ? (
          <span className="text-warning">
            {" "}
            · Backend özeti {summary.autoMatchedCount} gösteriyordu; gerçek apartmentId sayısı 0.
          </span>
        ) : null}
      </p>

      {displaySuspect > 0 || liveStats.ambiguous > 0 ? (
        <div className="shrink-0 rounded-md border border-line bg-canvas/60">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            onClick={() => setSuspectOpen((v) => !v)}
          >
            {suspectOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Şüpheli neden dağılımı
            <span className="text-muted">
              · yön {liveStats.suspectBreakdown.direction} · aday belirsiz{" "}
              {liveStats.suspectBreakdown.ambiguous} · gönderen yok{" "}
              {liveStats.suspectBreakdown.no_sender}
            </span>
          </button>
          {suspectOpen ? (
            <ul className="grid gap-1 border-t border-line px-3 py-2 text-xs text-muted sm:grid-cols-2">
              <li>Tutar yönü belirsiz: {liveStats.suspectBreakdown.direction}</li>
              <li>Birden fazla daire adayı: {liveStats.suspectBreakdown.ambiguous}</li>
              <li>Gönderen belirlenemedi: {liveStats.suspectBreakdown.no_sender}</li>
              <li>Açık borç yok (eşleşmede): {liveStats.suspectBreakdown.no_debt}</li>
              <li>PDF düşük güven / parse: {liveStats.suspectBreakdown.low_parse}</li>
              <li>
                Gerçek otomatik (apartmentId): {liveStats.withApartmentId} · kişi:{" "}
                {liveStats.withPersonId} · borç önizleme: {liveStats.withDebtPreview}
              </li>
            </ul>
          ) : null}
        </div>
      ) : null}

      {warnings.length > 0 || parseErrorCount > 0 ? (
        <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-amber-950"
            onClick={() => setWarningsOpen((v) => !v)}
          >
            {warningsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            PDF ayrıştırma uyarıları · {warnings.length + (parseErrorCount > 0 ? 1 : 0)}
          </button>
          {warningsOpen ? (
            <ul className="space-y-1 border-t border-amber-200 px-3 py-2 text-sm text-amber-900">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
              {parseErrorCount > 0 ? (
                <li>{parseErrorCount} satırda parse uyarısı var (satır detayında).</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex shrink-0 flex-col gap-2 rounded-md border border-line bg-canvas/70 p-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value as DirectionFilter);
                setPage(0);
              }}
              className="w-auto min-w-[120px]"
            >
              <option value="ALL">Tümü (yön)</option>
              <option value="CREDIT">Gelen</option>
              <option value="DEBIT">Giden</option>
            </Select>
            <Select
              value={matchFilter}
              onChange={(e) => {
                setMatchFilter(e.target.value as MatchFilter);
                setPage(0);
              }}
              className="w-auto min-w-[160px]"
            >
              <option value="ALL">Tüm eşleşmeler</option>
              <option value="UNMATCHED">Eşleşmeyen</option>
              <option value="AUTO">Otomatik eşleşen</option>
              <option value="MANUAL">Manuel eşleşen</option>
              <option value="SUSPECT">Şüpheli yön</option>
              <option value="DUPLICATE">Mükerrer</option>
              <option value="EXCLUDED">Hariç tutulan</option>
            </Select>
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <Input
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Gönderen, açıklama, daire, tutar…"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMoreFiltersOpen((v) => !v)}
            >
              Diğer Filtreler
            </Button>
          </div>
          {moreFiltersOpen ? (
            <p className="text-xs text-muted">
              Aktif daire sayısı: {apartmentsLoading ? "…" : apartments.length}. Liste dışı otomatik
              eşleşme: {liveStats.orphanApartmentId}.
            </p>
          ) : null}

          {bulkCandidates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
              <Button type="button" size="sm" onClick={() => setBulkApproveOpen(true)}>
                Yüksek güvenli {bulkCandidates.length} öneriyi onayla…
              </Button>
              <span className="text-xs text-muted">
                Yalnız tam ad / kural / ad+daire. Daire-no veya isim uyuşmazlığı dahil değil.
              </span>
            </div>
          ) : null}

          {selectedIndexes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
              <span className="text-sm font-medium text-ink">
                {selectedIndexes.length} satır seçildi
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => onWorkBatch(selectedIndexes, { decision: "COLLECT" })}
              >
                Tahsilata Onayla
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  onWorkBatch(selectedIndexes, { decision: "BANK_ONLY", apartmentId: null })
                }
              >
                Yalnız Banka Hareketi
              </Button>
              <Dropdown
                align="right"
                trigger={
                  <Button type="button" size="sm" variant="ghost">
                    Diğer İşlemler
                  </Button>
                }
              >
                <DropdownItem
                  onClick={() =>
                    onWorkBatch(selectedIndexes, {
                      decision: "LATER",
                      apartmentId: null,
                      personId: null,
                    })
                  }
                >
                  Daha Sonra Eşleştir
                </DropdownItem>
                <DropdownItem onClick={() => onWorkBatch(selectedIndexes, { decision: "EXCLUDE" })}>
                  Hariç Tut
                </DropdownItem>
              </Dropdown>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="shrink-0 rounded-md border border-line bg-canvas px-3 py-3 text-sm">
          <p className="font-medium text-ink">Son onay özeti</p>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Tahsilata aktarılacak</dt>
              <dd className="font-medium">
                {decisionTotals.collect} / {formatMoney(decisionTotals.collectAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Yalnız banka hareketi</dt>
              <dd className="font-medium">{decisionTotals.bankOnly}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Daha sonra eşleştirilecek</dt>
              <dd className="font-medium">{decisionTotals.later}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Hariç tutulan</dt>
              <dd className="font-medium">{decisionTotals.exclude}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Onayda oluşacak: BankTransaction ≈{" "}
            {decisionTotals.collect + decisionTotals.bankOnly + decisionTotals.later} · Payment ≈{" "}
            {decisionTotals.collect}
          </p>
          {decisionTotals.unresolvedSuspect > 0 ? (
            <p className="mt-2 text-sm text-danger">
              {decisionTotals.unresolvedSuspect} satırda tutar yönü doğrulanmadan içe aktarım
              yapılamaz.
            </p>
          ) : null}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-line">
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-canvas text-xs text-muted">
              <tr>
                {step === 3 ? (
                  <th className="w-10 px-2 py-2 font-medium">Seç</th>
                ) : null}
                <th className="w-[108px] px-2 py-2 font-medium">Tarih</th>
                <th className="w-[210px] px-2 py-2 font-medium">Gönderen / Alıcı</th>
                <th className="min-w-[280px] px-2 py-2 font-medium">Açıklama / Ref</th>
                <th className="w-[120px] px-2 py-2 text-right font-medium">Tutar</th>
                <th className="w-[90px] px-2 py-2 font-medium">Yön</th>
                <th className="w-[250px] px-2 py-2 font-medium">Önerilen eşleşme</th>
                <th className="w-[110px] px-2 py-2 text-right font-medium">Açık borç</th>
                <th className="w-[140px] px-2 py-2 font-medium">Güven / Durum</th>
                {step === 3 ? <th className="w-[110px] px-2 py-2 font-medium">İşlem</th> : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ row, work: w, dir, party, directionSuspect }) => {
                const aptId = w.apartmentId ?? row.match?.apartmentId ?? null;
                const display = buildMatchDisplay(
                  row,
                  apartments,
                  aptId,
                  w.personId ?? row.match?.personId ?? null,
                );
                const unmatchedLabel = matchLabel(row, w, apartments, party.counterpartyName);
                const apt = aptId ? apartments.find((a) => a.id === aptId) : null;
                const openDebt = apt ? getApartmentOccupantView(apt).openDebtAmount : null;
                const conf =
                  w.decision === "COLLECT"
                    ? "HIGH"
                    : isRealAutoMatched(row, w) || isManuallyMatched(w)
                      ? row.match?.confidence
                      : undefined;
                const suggested =
                  (isRealAutoMatched(row, w) || isManuallyMatched(w)) &&
                  w.decision !== "COLLECT";
                const showSuggestion =
                  Boolean(display) &&
                  (isRealAutoMatched(row, w) ||
                    isManuallyMatched(w) ||
                    w.decision === "COLLECT");

                return (
                  <tr
                    key={row.rowIndex}
                    className={cn(
                      "cursor-pointer border-t border-line hover:bg-canvas/80",
                      dir === "DEBIT" && "bg-slate-50/60",
                      w.decision === "EXCLUDE" && "opacity-50",
                      directionSuspect && !w.directionConfirmed && "bg-amber-50/70",
                      suggested && "bg-emerald-50/40",
                    )}
                    onClick={() => openDrawer(row.rowIndex, false)}
                  >
                    {step === 3 ? (
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={w.selected}
                          onChange={(e) =>
                            onWorkChange(row.rowIndex, { selected: e.target.checked })
                          }
                        />
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-2 py-2 align-top">
                      <div className="font-medium text-ink">{formatDateTr(row.transactionDate)}</div>
                      {row.valueDate ? (
                        <div className="text-[11px] text-muted">
                          Valör {formatDateTr(row.valueDate)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="line-clamp-2 font-medium text-ink">
                        {party.counterpartyName ??
                          (dir === "CREDIT" ? "Gönderen bilinmiyor" : "Alıcı bilinmiyor")}
                      </div>
                      <div className="text-[11px] text-muted">
                        {dir === "CREDIT" ? "Gönderen" : "Alıcı"}
                        {party.channel ? ` · ${party.channel}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="line-clamp-2 text-ink">{party.summaryLine}</div>
                      <div className="text-[11px] text-muted">
                        {party.referenceHint || row.referenceNo
                          ? `Ref: ${party.referenceHint ?? row.referenceNo}`
                          : row.sourcePage != null
                            ? `Sayfa ${row.sourcePage}`
                            : null}
                      </div>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-2 text-right align-top font-medium",
                        dir === "CREDIT" ? "text-emerald-700" : "text-ink",
                      )}
                    >
                      {formatMoney(row.amount)}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Badge
                        tone={
                          directionSuspect && !w.directionConfirmed
                            ? "warning"
                            : dir === "CREDIT"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {directionSuspect && !w.directionConfirmed
                          ? "Belirsiz"
                          : dir === "CREDIT"
                            ? "Gelen"
                            : "Giden"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 align-top">
                      {showSuggestion && display ? (
                        <MatchSuggestionCell
                          display={display}
                          senderName={party.counterpartyName}
                        />
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-sm text-ink">{unmatchedLabel.title}</p>
                          {unmatchedLabel.subtitle ? (
                            <p className="text-[11px] text-muted">{unmatchedLabel.subtitle}</p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                      {openDebt != null && openDebt > 0
                        ? formatMoney(openDebt)
                        : apt
                          ? "—"
                          : "—"}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <Badge tone={confidenceTone(conf)}>
                          {confidenceLabel(conf)}
                        </Badge>
                        <span className="text-[11px] text-muted">
                          {decisionLabel(w.decision, row, w)}
                        </span>
                      </div>
                    </td>
                    {step === 3 ? (
                      <td className="px-2 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              openDrawer(
                                row.rowIndex,
                                dir === "CREDIT" &&
                                  !isRealAutoMatched(row, w) &&
                                  !isManuallyMatched(w),
                              )
                            }
                          >
                            {primaryActionLabel(row, w, dir)}
                          </Button>
                          <Dropdown
                            align="right"
                            menuClassName="z-[70]"
                            trigger={
                              <button
                                type="button"
                                className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
                                aria-label="Diğer işlemler"
                              >
                                <MoreHorizontal className="size-4" />
                              </button>
                            }
                          >
                            <DropdownItem
                              onClick={() =>
                                onWorkChange(row.rowIndex, {
                                  directionOverride: "CREDIT",
                                  directionConfirmed: true,
                                })
                              }
                            >
                              Yönü Gelen Yap
                            </DropdownItem>
                            <DropdownItem
                              onClick={() =>
                                onWorkChange(row.rowIndex, {
                                  directionOverride: "DEBIT",
                                  directionConfirmed: true,
                                  decision: "BANK_ONLY",
                                  apartmentId: null,
                                })
                              }
                            >
                              Yönü Giden Yap
                            </DropdownItem>
                            <DropdownItem
                              onClick={() =>
                                onWorkChange(row.rowIndex, {
                                  decision: "BANK_ONLY",
                                  apartmentId: null,
                                  personId: null,
                                  createRule: false,
                                })
                              }
                            >
                              Yalnız Banka Hareketi Olarak Aktar
                            </DropdownItem>
                            <DropdownItem
                              onClick={() =>
                                onWorkChange(row.rowIndex, {
                                  decision: "LATER",
                                  apartmentId: null,
                                  personId: null,
                                  createRule: false,
                                })
                              }
                            >
                              Daha Sonra Eşleştir
                            </DropdownItem>
                            <DropdownItem
                              danger
                              onClick={() =>
                                onWorkChange(row.rowIndex, {
                                  decision: "EXCLUDE",
                                  createRule: false,
                                })
                              }
                            >
                              Hariç Tut
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted">
                    {filterSummary}. Filtreyi değiştirin veya özet kartlara tıklayın.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 text-sm text-muted">
        <span>
          {filtered.length} satır · Sayfa {pageSafe + 1}/{pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Önceki
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pageSafe >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Sonraki
          </Button>
        </div>
      </div>

      {drawerRow ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-ink/35" role="presentation">
          <button
            type="button"
            className="h-full flex-1 cursor-default"
            aria-label="Paneli kapat"
            onClick={() => setDrawerIndex(null)}
          />
          <aside className="flex h-full w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-modal sm:max-w-[560px]">
            <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <p className="font-medium text-ink">Hareket detayı</p>
                <p className="text-xs text-muted">
                  {formatDateTr(drawerRow.row.transactionDate)} ·{" "}
                  {drawerRow.dir === "CREDIT" ? "Gelen" : "Giden"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted hover:bg-canvas"
                onClick={() => setDrawerIndex(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
              <section className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Banka hareketi
                </p>
                <p>
                  <span className="text-muted">Tutar: </span>
                  {formatMoney(drawerRow.row.amount)} ·{" "}
                  {drawerRow.dir === "CREDIT" ? "Gelen" : "Giden"}
                </p>
                {drawerRow.row.balanceAfter != null ? (
                  <p>
                    <span className="text-muted">Bakiye: </span>
                    {formatMoney(drawerRow.row.balanceAfter)}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted">
                    {drawerRow.dir === "CREDIT" ? "Gönderen" : "Alıcı"}:{" "}
                  </span>
                  {drawerRow.party.counterpartyName ?? "—"}
                </p>
                <p>
                  <span className="text-muted">Referans: </span>
                  {drawerRow.party.referenceHint ?? drawerRow.row.referenceNo ?? "—"}
                </p>
                {drawerRow.row.sourcePage != null ? (
                  <p>
                    <span className="text-muted">PDF: </span>
                    Sayfa {drawerRow.row.sourcePage}
                    {drawerRow.row.sourceRowNumber
                      ? ` · satır ${drawerRow.row.sourceRowNumber}`
                      : ""}
                  </p>
                ) : null}
                <div className="rounded-md border border-line bg-canvas px-2.5 py-2 text-xs leading-relaxed text-ink">
                  {drawerRow.row.description}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Eşleşme
                </p>
                {(() => {
                  const aptId =
                    drawerRow.work.apartmentId ?? drawerRow.row.match?.apartmentId ?? null;
                  const display = buildMatchDisplay(
                    drawerRow.row,
                    apartments,
                    aptId,
                    drawerRow.work.personId ?? drawerRow.row.match?.personId ?? null,
                  );
                  const conf =
                    drawerRow.work.decision === "COLLECT"
                      ? "HIGH"
                      : isRealAutoMatched(drawerRow.row, drawerRow.work) ||
                          isManuallyMatched(drawerRow.work)
                        ? drawerRow.row.match?.confidence
                        : undefined;
                  const reason =
                    matchReasonOf(drawerRow.row.match) ||
                    matchLabel(
                      drawerRow.row,
                      drawerRow.work,
                      apartments,
                      drawerRow.party.counterpartyName,
                    ).reason;
                  if (!display) {
                    return (
                      <p className="text-muted">
                        {matchLabel(
                          drawerRow.row,
                          drawerRow.work,
                          apartments,
                          drawerRow.party.counterpartyName,
                        ).title}
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-2 rounded-md border border-line bg-canvas px-3 py-3">
                      <p>
                        <span className="text-muted">Gönderen: </span>
                        <span className="font-medium">
                          {drawerRow.party.counterpartyName ?? "—"}
                        </span>
                      </p>
                      <p className="text-muted">→</p>
                      <p className="text-base font-semibold text-ink">{display.buildingLine}</p>
                      {display.ownersLine && display.tenantsLine ? (
                        <>
                          <p>{display.ownersLine}</p>
                          <p>{display.tenantsLine}</p>
                        </>
                      ) : (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span>{display.personLine || "Kişi atanmamış"}</span>
                          {display.roleBadge ? (
                            <Badge tone={display.roleBadge === "Kiracı" ? "info" : "neutral"}>
                              {display.roleBadge}
                            </Badge>
                          ) : null}
                        </p>
                      )}
                      {display.nameMismatch ? (
                        <p className="flex items-center gap-1.5 text-sm text-warning">
                          <AlertTriangle className="size-3.5" />
                          Gönderen adı kayıtlı kişiyle uyuşmuyor — kontrol edin.
                        </p>
                      ) : null}
                      <p>
                        <span className="text-muted">Eşleşme nedeni: </span>
                        {reason || "—"}
                      </p>
                      <p>
                        <span className="text-muted">Güven: </span>
                        <Badge tone={confidenceTone(conf)}>{confidenceLabel(conf)}</Badge>
                        {drawerRow.work.decision === "COLLECT" ? (
                          <span className="ml-2 text-xs font-medium text-emerald-700">
                            Onaylandı
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-muted">Öneri — Onay bekliyor</span>
                        )}
                      </p>
                      <p>
                        <span className="text-muted">Gelen: </span>
                        {formatMoney(drawerRow.row.amount)}
                      </p>
                    </div>
                  );
                })()}
                {(() => {
                  const aptId =
                    drawerRow.work.apartmentId ?? drawerRow.row.match?.apartmentId ?? null;
                  const apt = aptId ? apartments.find((a) => a.id === aptId) : null;
                  if (!apt) return null;
                  const view = getApartmentOccupantView(apt);
                  if (view.openDebtAmount <= 0 && !drawerRow.row.allocationPreview?.length) {
                    return <p className="text-xs text-warning">Açık borç bulunmuyor</p>;
                  }
                  return (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-ink">
                        Açık borç toplamı: {formatMoney(view.openDebtAmount)}
                      </p>
                      {drawerRow.row.allocationPreview?.length ? (
                        <>
                          <p className="text-muted">Önerilen dağıtım:</p>
                          <ul className="rounded-md border border-line bg-canvas px-2.5 py-2">
                            {drawerRow.row.allocationPreview.map((item) => (
                              <li
                                key={item.apartmentDebtId}
                                className="flex justify-between gap-2"
                              >
                                <span>{item.label}</span>
                                <span>{formatMoney(item.amount)}</span>
                              </li>
                            ))}
                            {drawerRow.row.allocationRemainder &&
                            Number(drawerRow.row.allocationRemainder) > 0 ? (
                              <li className="mt-1 flex justify-between gap-2 text-warning">
                                <span>Dağıtılamayan</span>
                                <span>{formatMoney(drawerRow.row.allocationRemainder)}</span>
                              </li>
                            ) : null}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  );
                })()}
              </section>

              {step === 3 &&
              (matchMode ||
                (!isRealAutoMatched(drawerRow.row, drawerRow.work) &&
                  !isManuallyMatched(drawerRow.work) &&
                  drawerRow.dir === "CREDIT")) ? (
                <section className="space-y-3">
                  <FormField label="Başka daire seç" htmlFor="review-match-apt">
                    <ApartmentCombobox
                      id="review-match-apt"
                      apartments={apartments}
                      loading={apartmentsLoading}
                      defaultOpen={matchMode}
                      emptyMessage={
                        apartmentsLoading
                          ? "Daireler yükleniyor…"
                          : apartments.length === 0
                            ? "Bu sitede aktif daire bulunamadı"
                            : `${apartments.length} daire var ancak bu aramayla eşleşen kişi/daire bulunamadı`
                      }
                      value={drawerRow.work.apartmentId ?? drawerRow.row.match?.apartmentId ?? ""}
                      onChange={(id) => {
                        const apt = apartments.find((a) => a.id === id);
                        const view = apt ? getApartmentOccupantView(apt) : null;
                        const preferred =
                          drawerRow.party.counterpartyName &&
                          !isGenericMatchKey(drawerRow.party.counterpartyName)
                            ? drawerRow.party.counterpartyName
                            : "";
                        onWorkChange(drawerRow.row.rowIndex, {
                          apartmentId: id || null,
                          personId: view?.primaryPerson?.id ?? null,
                          decision:
                            drawerRow.work.decision === "COLLECT" && id
                              ? "COLLECT"
                              : null,
                          ruleText: preferred,
                        });
                      }}
                    />
                  </FormField>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={drawerRow.work.createRule}
                      onChange={(e) =>
                        onWorkChange(drawerRow.row.rowIndex, { createRule: e.target.checked })
                      }
                    />
                    <span>Bu göndericiyi sonraki hareketlerde aynı daireyle eşleştir</span>
                  </label>
                  {drawerRow.work.createRule ? (
                    <FormField label="Kural anahtarı" htmlFor="review-rule">
                      <Input
                        id="review-rule"
                        value={drawerRow.work.ruleText}
                        onChange={(e) =>
                          onWorkChange(drawerRow.row.rowIndex, { ruleText: e.target.value })
                        }
                        placeholder="Gönderen adı (genel EFT/Havale olmasın)"
                      />
                    </FormField>
                  ) : null}
                </section>
              ) : null}

              {step === 3 ? (
                <section className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    İşlemler
                  </p>
                  {drawerRow.dir === "CREDIT" && drawerRow.row.previewStatus !== "DUPLICATE" ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => {
                          approveRow(drawerRow.row.rowIndex);
                          setDrawerIndex(null);
                        }}
                        disabled={
                          !(
                            drawerRow.work.apartmentId ?? drawerRow.row.match?.apartmentId
                          )
                        }
                      >
                        Onayla
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setMatchMode(true);
                          setDrawerRejectOpen(false);
                        }}
                      >
                        Değiştir
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setDrawerRejectOpen((v) => !v)}
                      >
                        Reddet
                      </Button>
                      {drawerRejectOpen ? (
                        <div className="flex flex-col gap-1.5 rounded-md border border-line bg-canvas p-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              onWorkChange(drawerRow.row.rowIndex, {
                                apartmentId: null,
                                personId: null,
                                decision: "LATER",
                                createRule: false,
                              });
                              setDrawerIndex(null);
                            }}
                          >
                            Daha Sonra Eşleştir
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              onWorkChange(drawerRow.row.rowIndex, {
                                apartmentId: null,
                                personId: null,
                                decision: "BANK_ONLY",
                                createRule: false,
                              });
                              setDrawerIndex(null);
                            }}
                          >
                            Yalnız Banka Hareketi
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              onWorkChange(drawerRow.row.rowIndex, {
                                decision: "EXCLUDE",
                                createRule: false,
                              });
                              setDrawerIndex(null);
                            }}
                          >
                            Hariç Tut
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onWorkChange(drawerRow.row.rowIndex, {
                          decision: "BANK_ONLY",
                          directionConfirmed: true,
                        })
                      }
                    >
                      Giden hareketi banka hareketi olarak aktar
                    </Button>
                  )}
                  {drawerRow.directionSuspect && !drawerRow.work.directionConfirmed ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onWorkChange(drawerRow.row.rowIndex, {
                            directionOverride: "CREDIT",
                            directionConfirmed: true,
                          })
                        }
                      >
                        Yönü Gelen Yap
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onWorkChange(drawerRow.row.rowIndex, {
                            directionOverride: "DEBIT",
                            directionConfirmed: true,
                            decision: "BANK_ONLY",
                          })
                        }
                      >
                        Yönü Giden Yap
                      </Button>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="shrink-0 overflow-auto rounded-md border border-line">
          <p className="border-b border-line bg-canvas px-3 py-2 text-sm font-medium">
            Onaylanan tahsilatlar (yalnız kullanıcı onayı)
          </p>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-2 py-2">Gönderen</th>
                <th className="px-2 py-2">Daire</th>
                <th className="px-2 py-2">Kayıtlı kişi</th>
                <th className="px-2 py-2 text-right">Tutar</th>
                <th className="px-2 py-2">Borca dağıtım</th>
              </tr>
            </thead>
            <tbody>
              {enriched
                .filter((e) => e.work.decision === "COLLECT" && e.dir === "CREDIT")
                .map(({ row, work: w, party }) => {
                  const display = buildMatchDisplay(
                    row,
                    apartments,
                    w.apartmentId ?? row.match?.apartmentId ?? null,
                    w.personId ?? row.match?.personId ?? null,
                  );
                  return (
                    <tr key={row.rowIndex} className="border-t border-line">
                      <td className="px-2 py-2">{party.counterpartyName ?? "—"}</td>
                      <td className="px-2 py-2 font-medium">
                        {display?.buildingLine ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        {display?.personLine ||
                          display?.ownersLine ||
                          display?.tenantsLine ||
                          "—"}
                      </td>
                      <td className="px-2 py-2 text-right">{formatMoney(row.amount)}</td>
                      <td className="px-2 py-2 text-xs text-muted">
                        {row.allocationPreview?.length
                          ? row.allocationPreview
                              .map((a) => `${a.label}: ${formatMoney(a.amount)}`)
                              .join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              {decisionTotals.collect === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    Henüz onaylanmış eşleşme yok. Öneri durumundaki hareketler tahsilata
                    dahil edilmez.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkApproveOpen}
        title={`${bulkCandidates.length} yüksek güvenli öneriyi onaylamak üzeresiniz.`}
        description={[
          `Tam malik adı eşleşmesi: ${bulkKindCounts.owner}`,
          `Tam kiracı adı eşleşmesi: ${bulkKindCounts.tenant}`,
          `Önceden onaylı kural: ${bulkKindCounts.rule}`,
          `Daire + kişi birlikte: ${bulkKindCounts.nameAndApt}`,
          "",
          "Yalnız daire numarası ve isim uyuşmazlığı toplu onaya dahil edilmez.",
          "",
          ...bulkCandidates.slice(0, 8).map(({ row, party }) => {
            const display = buildMatchDisplay(
              row,
              apartments,
              row.match?.apartmentId ?? null,
              row.match?.personId ?? null,
            );
            return `${party.counterpartyName ?? "?"} → ${display?.buildingLine ?? "?"} · ${display?.personLine || display?.ownersLine || "?"} · ${formatMoney(row.amount)} · ${matchReasonOf(row.match)}`;
          }),
          bulkCandidates.length > 8 ? `… ve ${bulkCandidates.length - 8} satır daha` : "",
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="Toplu Onayla"
        onClose={() => setBulkApproveOpen(false)}
        onConfirm={() => {
          for (const { row, work: w } of bulkCandidates) {
            onWorkChange(row.rowIndex, {
              decision: "COLLECT",
              apartmentId: w.apartmentId ?? row.match?.apartmentId ?? null,
              personId: w.personId ?? row.match?.personId ?? null,
            });
          }
          setBulkApproveOpen(false);
        }}
      />
    </div>
  );
}

export function countUnresolvedDirection(
  rows: StatementPreviewRow[],
  work: Record<number, RowWorkState>,
  directionSuspectIds: Set<number>,
): number {
  let n = 0;
  for (const row of rows) {
    const w = work[row.rowIndex] ?? emptyRowWork();
    if (rowNeedsDirection(row, directionSuspectIds) && !w.directionConfirmed) n += 1;
  }
  return n;
}
