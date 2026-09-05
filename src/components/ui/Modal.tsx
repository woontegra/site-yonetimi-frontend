"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type ModalVariant = "form" | "confirm" | "detail";
export type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "full"
  | "workspace"
  | "small"
  | "medium"
  | "large"
  | "wide";

export type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconTone?: "brand" | "danger" | "warning";
  variant?: ModalVariant;
  size?: ModalSize;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const sizes: Record<ModalSize, string> = {
  sm: "max-w-[420px] sm:mx-4",
  small: "max-w-[420px] sm:mx-4",
  md: "max-w-[520px] sm:mx-4",
  medium: "max-w-[520px] sm:mx-4",
  lg: "max-w-[720px] sm:mx-4",
  large: "max-w-[720px] sm:mx-4",
  xl: "max-w-[960px] sm:mx-4",
  wide: "max-w-[1040px] sm:mx-4",
  full: "max-w-[1100px] sm:mx-4",
  workspace: "max-w-none sm:mx-3 sm:w-[min(calc(100vw-24px),1680px)]",
};

const variantSize: Record<ModalVariant, ModalSize> = {
  form: "lg",
  confirm: "sm",
  detail: "md",
};

const iconTones = {
  brand: "bg-accent-subtle text-accent",
  danger: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning",
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function Modal({
  open,
  title,
  description,
  icon: Icon,
  iconTone = "brand",
  variant = "form",
  size,
  onClose,
  children,
  footer,
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [visible, setVisible] = useState(open);
  const [entered, setEntered] = useState(false);

  const resolvedSize = size ?? variantSize[variant];
  const isWorkspace = resolvedSize === "workspace";

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onCloseRef.current();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setEntered(false);
    const timer = window.setTimeout(() => setVisible(false), 170);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!visible) return;

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible, handleKeyDown]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const initial =
        root.querySelector<HTMLElement>("[data-modal-autofocus]") ??
        root.querySelector<HTMLElement>(
          "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-modal-footer] button",
        );
      initial?.focus();
    }, 20);

    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    };
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center p-0",
        isWorkspace ? "sm:items-center sm:p-3" : "sm:items-center sm:p-4",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-ink/45 backdrop-blur-[3px] transition-opacity duration-[170ms] ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 flex h-[min(100dvh,100%)] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none border border-line bg-surface shadow-modal",
          isWorkspace
            ? "sm:h-[calc(100vh-24px)] sm:max-h-[96vh] sm:rounded-lg"
            : "sm:h-auto sm:max-h-[88vh] sm:rounded-lg",
          "transition-[opacity,transform] duration-[170ms] ease-out",
          entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.98] opacity-0",
          sizes[resolvedSize],
          className,
        )}
      >
        <div className="flex shrink-0 items-start gap-2.5 px-4 py-3.5 sm:px-5">
          {Icon ? (
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                iconTones[iconTone],
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-modal text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 whitespace-pre-line text-[12px] leading-[1.35] text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="rounded-md p-1.5 text-muted transition-colors duration-micro hover:bg-canvas hover:text-ink"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        {children ? (
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto border-t border-line px-4 py-3.5 sm:px-5",
              isWorkspace && "flex flex-col",
            )}
          >
            {children}
          </div>
        ) : null}

        {footer ? (
          <div
            data-modal-footer
            className="action-stack shrink-0 border-t border-line bg-canvas/50 px-4 py-3 sm:flex-row sm:justify-end"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
