import type { ReactNode } from "react";
import { AlertTriangle, Ban, Info } from "lucide-react";
import { cn } from "@/lib/cn";

export type FinanceIssueSeverity = "INFO" | "WARNING" | "BLOCK";

export type FinanceIssue = {
  code: string;
  severity: FinanceIssueSeverity;
  title: string;
  message: string;
  paymentId?: string;
  debtId?: string;
  period?: string | null;
  amount?: string;
  details?: Record<string, unknown>;
};

export type ProposedAllocationLine = {
  apartmentDebtId: string;
  title: string;
  periodLabel: string | null;
  amount: string;
};

export type FinanceCheckResult = {
  allowed: boolean;
  requiresConfirmation: boolean;
  issues: FinanceIssue[];
  summary: Record<string, unknown>;
  proposedAllocation: ProposedAllocationLine[];
  debtSnapshot: Array<{ apartmentDebtId: string; remainingAmount: string }>;
};

type FinanceCheckPanelProps = {
  check: FinanceCheckResult | null;
  confirmedCodes?: string[];
  onConfirmCode?: (code: string, confirmed: boolean) => void;
  className?: string;
  children?: ReactNode;
  hideAllocationPlan?: boolean;
};

const toneStyles: Record<
  FinanceIssueSeverity,
  { box: string; icon: typeof Info; iconClass: string }
> = {
  INFO: {
    box: "border-[color:var(--tone-cyan-border)] bg-[color:var(--tone-cyan-bg)]",
    icon: Info,
    iconClass: "text-[color:var(--tone-cyan-icon)]",
  },
  WARNING: {
    box: "border-[color:var(--tone-amber-border)] bg-[color:var(--tone-amber-bg)]",
    icon: AlertTriangle,
    iconClass: "text-[color:var(--tone-amber-icon)]",
  },
  BLOCK: {
    box: "border-[color:var(--tone-rose-border)] bg-[color:var(--tone-rose-bg)]",
    icon: Ban,
    iconClass: "text-[color:var(--tone-rose-icon)]",
  },
};

export function FinanceCheckPanel({
  check,
  confirmedCodes = [],
  onConfirmCode,
  className,
  children,
  hideAllocationPlan = false,
}: FinanceCheckPanelProps) {
  if (!check) return children ?? null;
  if (check.issues.length === 0 && (hideAllocationPlan || check.proposedAllocation.length === 0)) {
    return children ?? null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {check.issues.map((issue) => {
        const tone = toneStyles[issue.severity];
        const Icon = tone.icon;
        const confirmed = confirmedCodes.includes(issue.code);
        return (
          <div
            key={`${issue.code}-${issue.paymentId ?? issue.debtId ?? issue.message}`}
            className={cn("rounded-lg border px-3 py-2.5", tone.box)}
            role={issue.severity === "INFO" ? "status" : "alert"}
          >
            <div className="flex gap-2">
              <Icon className={cn("mt-0.5 size-3.5 shrink-0", tone.iconClass)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[1.35] text-ink">{issue.title}</p>
                <p className="mt-0.5 text-[12px] font-normal leading-[1.35] text-muted">
                  {issue.message}
                </p>
                {issue.severity === "WARNING" && onConfirmCode ? (
                  <label className="mt-2 flex items-start gap-2 text-[12px] text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmed}
                      onChange={(event) => onConfirmCode(issue.code, event.target.checked)}
                    />
                    <span>Kontrol ettim, devam et</span>
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {!hideAllocationPlan && check.proposedAllocation.length > 0 ? (
        <div className="rounded-lg border border-line bg-canvas/50 px-3 py-2.5">
          <p className="text-[12px] font-medium text-ink">Dağıtım planı</p>
          <ul className="mt-1.5 space-y-1">
            {check.proposedAllocation.map((line) => (
              <li
                key={line.apartmentDebtId}
                className="flex items-center justify-between gap-2 text-[12px] text-ink"
              >
                <span className="min-w-0 truncate">{line.periodLabel || line.title}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {Number(line.amount).toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₺
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {children}
    </div>
  );
}

export function hasUnresolvedFinanceBlocks(check: FinanceCheckResult | null): boolean {
  return Boolean(check && check.issues.some((issue) => issue.severity === "BLOCK"));
}

export function hasUnresolvedFinanceWarnings(
  check: FinanceCheckResult | null,
  confirmedCodes: string[],
): boolean {
  if (!check) return false;
  return check.issues.some(
    (issue) => issue.severity === "WARNING" && !confirmedCodes.includes(issue.code),
  );
}
