"use client";

import { useEffect, useRef } from "react";
import { useActiveSite } from "@/lib/active-site-context";

/**
 * Açık form varken header’daki active site değişirse formu kapatır.
 * Sessizce başka siteye taşımaz.
 */
export function useCloseFormOnSiteChange(open: boolean, onClose: () => void) {
  const { siteId } = useActiveSite();
  const openedAtSiteId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      openedAtSiteId.current = null;
      return;
    }
    if (openedAtSiteId.current === null) {
      openedAtSiteId.current = siteId;
      return;
    }
    if (siteId !== openedAtSiteId.current) {
      onClose();
      openedAtSiteId.current = null;
    }
  }, [open, siteId, onClose]);
}
