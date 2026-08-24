"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { isNavActive, navSections, adminNavSections, type NavItem } from "@/lib/nav";
import { useAuth } from "@/lib/auth-context";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { useApiAuth } from "@/lib/active-site-context";
import { getInsideVisitSummary } from "@/lib/visits-api";

const COLLAPSE_KEY = "sy_sidebar_collapsed";

type AppSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobile?: boolean;
  onNavigate?: () => void;
  adminMode?: boolean;
};

function NavLink({
  item,
  pathname,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const active = isNavActive(pathname, item.href, item);
  const Icon = item.icon;
  const showBadge = typeof badge === "number" && badge > 0;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-[13.5px] font-normal transition-colors duration-micro",
        collapsed && "justify-center px-0",
        active ? "bg-accent-subtle font-medium text-accent" : "text-slate-600 hover:bg-canvas hover:text-ink",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {collapsed ? null : <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && showBadge ? (
        <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded bg-accent px-1 text-[10px] font-semibold leading-4 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip label={item.label} side="right">
      {link}
    </Tooltip>
  );
}

export function AppSidebar({
  collapsed,
  onCollapsedChange,
  mobile = false,
  onNavigate,
  adminMode = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { ready, user } = useAuth();
  const auth = useApiAuth();
  const [insideCount, setInsideCount] = useState(0);
  const sections = (adminMode ? adminNavSections : navSections)
    .map((section) => ({
      ...section,
      items: adminMode
        ? section.items
        : section.items.filter((item) => {
            if (!item.permission) return true;
            if (!user.permissions || user.permissions.length === 0) return true;
            return Array.isArray(item.permission)
              ? hasAnyPermission(user, item.permission)
              : hasPermission(user, item.permission);
          }),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    if (adminMode || !ready || !auth) return;
    let cancelled = false;
    void getInsideVisitSummary(auth)
      .then((result) => {
        if (!cancelled) setInsideCount(result.insideCount);
      })
      .catch(() => {
        if (!cancelled) setInsideCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [adminMode, ready, auth]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-surface">
      <div
        className={cn(
          "flex h-header shrink-0 items-center border-b border-line px-3",
          collapsed && !mobile ? "justify-center" : "justify-between gap-2",
        )}
      >
        <Logo
          compact={collapsed && !mobile}
          href={adminMode ? "/app/admin" : "/app"}
          subtitle={adminMode ? "Yönetim Merkezi" : "Site Yönetimi"}
        />
        {mobile ? (
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
            aria-label="Menüyü kapat"
            onClick={onNavigate}
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      <nav aria-label={adminMode ? "Platform yönetimi" : "Ana menü"} className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            {collapsed && !mobile ? (
              <div className="mx-auto mb-1 h-px w-6 bg-line" aria-hidden />
            ) : (
              <p className="px-2.5 pb-1.5 pt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={`${section.id}-${item.href}`}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed && !mobile}
                  badge={item.badgeKey === "visitors" ? insideCount : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {mobile ? null : (
        <div className="border-t border-line p-2">
          <Tooltip
            label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            side="right"
            className="w-full"
          >
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted hover:bg-canvas hover:text-ink",
                collapsed && "justify-center px-0",
              )}
              aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
              onClick={() => onCollapsedChange(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden />
              ) : (
                <>
                  <PanelLeftClose className="size-4" aria-hidden />
                  <span>Daralt</span>
                </>
              )}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}
