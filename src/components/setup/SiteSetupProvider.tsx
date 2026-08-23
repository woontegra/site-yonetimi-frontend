"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SiteSetupWizard } from "@/components/setup/SiteSetupWizard";

type OpenWizardOptions = {
  initialStep?: number;
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [initialStep, setInitialStep] = useState(0);
  const [setupRevision, setSetupRevision] = useState(0);

  const openWizard = useCallback((options?: OpenWizardOptions) => {
    setInitialStep(options?.initialStep ?? 0);
    setWizardOpen(true);
  }, []);

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
