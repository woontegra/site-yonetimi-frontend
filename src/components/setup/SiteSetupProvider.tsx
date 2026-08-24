"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SiteSetupWizard } from "@/components/setup/SiteSetupWizard";
import { useActiveSite } from "@/lib/active-site-context";

type OpenWizardOptions = {
  initialStep?: number;
  /** Header aktif sitesi farklıysa önce bu siteye geçilir, sonra sihirbaz açılır. */
  siteId?: string;
};

type SiteSetupUiContextValue = {
  wizardOpen: boolean;
  initialStep: number;
  /** Banner ve diğer dinleyiciler için kurulum durumu yenileme anahtarı */
  setupRevision: number;
  openWizard: (options?: OpenWizardOptions) => void;
  closeWizard: () => void;
  notifySetupChanged: () => void;
};

const SiteSetupUiContext = createContext<SiteSetupUiContextValue | null>(null);

export function SiteSetupProvider({ children }: { children: ReactNode }) {
  const { siteId, sites, setSiteId } = useActiveSite();
  const prevSiteIdRef = useRef(siteId);
  const pendingOpenRef = useRef<{ siteId: string; initialStep: number } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialStep, setInitialStep] = useState(0);
  const [setupRevision, setSetupRevision] = useState(0);

  useEffect(() => {
    const pending = pendingOpenRef.current;
    if (pending && siteId === pending.siteId) {
      pendingOpenRef.current = null;
      setInitialStep(pending.initialStep);
      setWizardOpen(true);
      prevSiteIdRef.current = siteId;
      return;
    }
    if (prevSiteIdRef.current && siteId && prevSiteIdRef.current !== siteId) {
      setWizardOpen(false);
      setSetupRevision((n) => n + 1);
    }
    prevSiteIdRef.current = siteId;
  }, [siteId]);

  const openWizard = useCallback(
    (options?: OpenWizardOptions) => {
      const step = options?.initialStep ?? 0;
      const targetId = options?.siteId;
      if (targetId && targetId !== siteId) {
        if (!sites.some((item) => item.id === targetId)) return;
        pendingOpenRef.current = { siteId: targetId, initialStep: step };
        setSiteId(targetId, { syncRoute: false });
        return;
      }
      setInitialStep(step);
      setWizardOpen(true);
    },
    [siteId, sites, setSiteId],
  );

  const closeWizard = useCallback(() => {
    setWizardOpen(false);
  }, []);

  const notifySetupChanged = useCallback(() => {
    setSetupRevision((n) => n + 1);
  }, []);

  const handleWizardCompleted = useCallback(() => {
    setSetupRevision((n) => n + 1);
    setWizardOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      wizardOpen,
      initialStep,
      setupRevision,
      openWizard,
      closeWizard,
      notifySetupChanged,
    }),
    [wizardOpen, initialStep, setupRevision, openWizard, closeWizard, notifySetupChanged],
  );

  return (
    <SiteSetupUiContext.Provider value={value}>
      {children}
      <SiteSetupWizard
        open={wizardOpen}
        initialStep={initialStep}
        onClose={closeWizard}
        onCompleted={handleWizardCompleted}
      />
    </SiteSetupUiContext.Provider>
  );
}

export function useSiteSetupWizard() {
  const context = useContext(SiteSetupUiContext);
  if (!context) {
    throw new Error("useSiteSetupWizard, SiteSetupProvider içinde kullanılmalıdır.");
  }
  return context;
}
