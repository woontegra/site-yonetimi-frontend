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
export type ModalSize = "sm" | "md" | "lg";

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
  sm: "max-w-[440px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
};

const variantSize: Record<ModalVariant, ModalSize> = {
  form: "lg",
  confirm: "sm",
  detail: "md",
};

const iconTones = {
  brand: "bg-brand-soft text-brand",
  danger: "bg-red-50 text-danger",
  warning: "bg-amber-50 text-warning",
};

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
  const [visible, setVisible] = useState(open);
  const [entered, setEntered] = useState(false);

  const resolvedSize = size ?? variantSize[variant];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
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
    },
    [onClose],
  );

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

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      const initial =
        dialogRef.current?.querySelector<HTMLElement>("[data-modal-autofocus]") ??
        dialogRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-modal-footer] button',
        );
      initial?.focus();
    }, 20);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [visible, handleKeyDown]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Kapat"
        className={cn(
          "absolute inset-0 bg-ink/35 backdrop-blur-[2px] transition-opacity duration-[170ms] ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 flex w-full max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-modal",
          "transition-[opacity,transform] duration-[170ms] ease-out",
          entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.98] opacity-0",
          sizes[resolvedSize],
          className,
        )}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-6 py-5">
          {Icon ? (
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                iconTones[iconTone],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-[17px] font-semibold leading-snug text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[13px] leading-5 text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors duration-micro hover:bg-canvas hover:text-ink"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        {children ? (
          <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        ) : null}

        {footer ? (
          <div
            data-modal-footer
            className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-4"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
