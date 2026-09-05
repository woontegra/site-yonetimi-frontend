"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { isErrorHandled, markErrorHandled, normalizeApiError } from "@/lib/api-error";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** null = sticky until dismissed */
  durationMs?: number | null;
  action?: ToastAction;
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  durationMs: number | null;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: {
    (message: string, tone?: ToastTone): void;
    (options: ToastOptions): void;
  };
  toastError: (error: unknown, fallbackMessage?: string) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const DEDUPE_MS = 2500;

const DEFAULT_DURATION: Record<ToastTone, number | null> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 10_000,
};

const TONE_UI: Record<
  ToastTone,
  { icon: typeof CheckCircle2; iconBox: string; panel: string; role: "status" | "alert" }
> = {
  success: {
    icon: CheckCircle2,
    iconBox: "bg-[color:var(--tone-green-icon-bg)] text-[color:var(--tone-green-icon)]",
    panel:
      "border-[color:var(--tone-green-border)] bg-[color:var(--tone-green-bg)]",
    role: "status",
  },
  error: {
    icon: XCircle,
    iconBox: "bg-[color:var(--tone-rose-icon-bg)] text-[color:var(--tone-rose-icon)]",
    panel: "border-[color:var(--tone-rose-border)] bg-[color:var(--tone-rose-bg)]",
    role: "alert",
  },
  warning: {
    icon: AlertTriangle,
    iconBox: "bg-[color:var(--tone-amber-icon-bg)] text-[color:var(--tone-amber-icon)]",
    panel: "border-[color:var(--tone-amber-border)] bg-[color:var(--tone-amber-bg)]",
    role: "alert",
  },
  info: {
    icon: Info,
    iconBox: "bg-[color:var(--tone-blue-icon-bg)] text-[color:var(--tone-blue-icon)]",
    panel: "border-[color:var(--tone-blue-border)] bg-[color:var(--tone-blue-bg)]",
    role: "status",
  },
};

function isOptions(value: string | ToastOptions): value is ToastOptions {
  return typeof value === "object" && value !== null && "title" in value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const recent = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const tone = options.tone ?? "success";
      const title = options.title.trim();
      if (!title) return;

      const dedupeKey = `${tone}|${title}|${options.description ?? ""}`;
      const now = Date.now();
      const last = recent.current.get(dedupeKey);
      if (last != null && now - last < DEDUPE_MS) return;
      recent.current.set(dedupeKey, now);

      const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      const durationMs =
        options.durationMs === undefined
          ? options.action
            ? null
            : DEFAULT_DURATION[tone]
          : options.durationMs;

      setItems((current) => {
        const next = [...current, { id, title, description: options.description, tone, durationMs, action: options.action }];
        if (next.length <= MAX_TOASTS) return next;
        const dropped = next.slice(0, next.length - MAX_TOASTS);
        for (const item of dropped) {
          const timer = timers.current.get(item.id);
          if (timer != null) {
            window.clearTimeout(timer);
            timers.current.delete(item.id);
          }
        }
        return next.slice(-MAX_TOASTS);
      });

      if (durationMs != null && durationMs > 0) {
        const timer = window.setTimeout(() => dismissToast(id), durationMs);
        timers.current.set(id, timer);
      }
    },
    [dismissToast],
  );

  const showToast = useCallback(
    ((messageOrOptions: string | ToastOptions, tone: ToastTone = "success") => {
      if (isOptions(messageOrOptions)) {
        pushToast(messageOrOptions);
        return;
      }
      pushToast({ title: messageOrOptions, tone });
    }) as ToastContextValue["showToast"],
    [pushToast],
  );

  const toastError = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      if (isErrorHandled(error)) return;
      const normalized = normalizeApiError(error, fallbackMessage);
      markErrorHandled(error);
      pushToast({
        title: normalized.title,
        description: normalized.requestId
          ? `${normalized.userMessage}\nDestek kodu: ${normalized.requestId}`
          : normalized.userMessage,
        tone: "error",
        durationMs: normalized.retryable ? 10_000 : null,
      });
    },
    [pushToast],
  );

  const value = useMemo(
    () => ({ showToast, toastError, dismissToast }),
    [showToast, toastError, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-16 sm:w-[min(400px,calc(100vw-2rem))]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const ui = TONE_UI[item.tone];
          const Icon = ui.icon;
          return (
            <div
              key={item.id}
              role={ui.role}
              className={cn(
                "pointer-events-auto flex gap-2.5 rounded-lg border px-3 py-2.5 shadow-[var(--shadow-panel-hover)] motion-reduce:transition-none",
                ui.panel,
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                  ui.iconBox,
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[1.35] text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 whitespace-pre-line text-[12px] font-normal leading-[1.35] text-muted">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    className="mt-1.5 text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                    onClick={() => {
                      item.action?.onClick();
                      dismissToast(item.id);
                    }}
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted hover:bg-white/60 hover:text-ink"
                aria-label="Bildirimi kapat"
                onClick={() => dismissToast(item.id)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast, ToastProvider içinde kullanılmalıdır.");
  }
  return context;
}
