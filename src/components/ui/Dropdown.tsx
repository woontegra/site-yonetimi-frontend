"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/cn";

type DropdownProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  menuClassName?: string;
};

export function Dropdown({
  trigger,
  children,
  align = "left",
  className,
  menuClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 180;
    const left = align === "right" ? rect.right - menuWidth : rect.left;
    setPosition({
      top: rect.bottom + 6,
      left: Math.min(Math.max(8, left), window.innerWidth - menuWidth - 8),
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onRepositionClose() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onRepositionClose);
    window.addEventListener("scroll", onRepositionClose, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onRepositionClose);
      window.removeEventListener("scroll", onRepositionClose, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <div
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        {trigger}
      </div>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={{ top: position.top, left: position.left }}
              className={cn(
                "fixed z-50 min-w-[160px] rounded-md border border-line bg-white py-1 shadow-menu",
                menuClassName,
              )}
            >
              <div onClick={() => setOpen(false)}>{children}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function DropdownItem({
  children,
  href,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-micro",
    danger ? "text-danger hover:bg-red-50" : "text-ink hover:bg-canvas",
  );

  if (href) {
    return (
      <Link role="menuitem" href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" role="menuitem" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
