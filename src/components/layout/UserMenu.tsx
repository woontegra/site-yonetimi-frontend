"use client";

import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { apiLogout } from "@/lib/api";
import { clearSession } from "@/lib/session";

export function UserMenu() {
  const { user, token } = useAuth();

  async function handleLogout() {
    if (token) {
      await apiLogout(token);
    }
    clearSession();
    window.location.assign("/giris");
  }

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className="flex max-w-[220px] items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-canvas"
          aria-haspopup="menu"
          aria-label="Kullanıcı menüsü"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent">
            {user.fullName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden truncate font-normal lg:inline">{user.fullName}</span>
          <ChevronDown className="size-3.5 text-muted" aria-hidden />
        </button>
      }
    >
      <DropdownItem href="/app/ayarlar">
        <Settings className="size-4 text-muted" aria-hidden />
        Ayarlar
      </DropdownItem>
      <DropdownItem danger onClick={() => void handleLogout()}>
        <LogOut className="size-4" aria-hidden />
        Çıkış
      </DropdownItem>
    </Dropdown>
  );
}
