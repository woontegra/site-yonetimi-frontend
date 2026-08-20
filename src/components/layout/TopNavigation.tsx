"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  compactPrimaryNav,
  isNavActive,
  otherNav,
  overflowNav,
  primaryNav,
  type NavItem,
} from "@/lib/nav";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-micro",
        active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-canvas hover:text-ink",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

function OtherMenu({ items, pathname, label = "Diğer" }: { items: NavItem[]; pathname: string; label?: string }) {
  const childActive = items.some((item) => isNavActive(pathname, item.href));

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-micro",
            childActive ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-canvas hover:text-ink",
          )}
          aria-haspopup="menu"
        >
          {label}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      }
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isNavActive(pathname, item.href);
        return (
          <DropdownItem key={item.href} href={item.href}>
            <Icon className={cn("size-4", active ? "text-brand" : "text-muted")} aria-hidden />
            <span className={active ? "font-medium text-brand" : undefined}>{item.label}</span>
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}

export function TopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Ana menü">
      <div className="hidden items-center gap-0.5 xl:flex">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <OtherMenu items={otherNav} pathname={pathname} />
      </div>

      <div className="hidden items-center gap-0.5 md:flex xl:hidden">
        {compactPrimaryNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <OtherMenu items={overflowNav} pathname={pathname} />
      </div>
    </nav>
  );
}
