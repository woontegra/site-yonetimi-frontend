"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSiteSetupWizard } from "@/components/setup/SiteSetupProvider";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { getSetupSummary, type SetupStatus } from "@/lib/site-setup-api";

const HIDDEN_STATUSES: SetupStatus[] = ["COMPLETED", "SKIPPED"];

export function SetupIncompleteBanner() {
  const auth = useApiAuth({ requireSite: true });
  const { siteId, status } = useActiveSite();
  const { openWizard, setupRevision } = useSiteSetupWizard();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (status !== "ready" || !auth || !siteId) {
      setSetupStatus(null);
      return;
    }
    setLoading(true);
    try {
      const summary = await getSetupSummary(auth);
      if (summary.site.id !== siteId) {
        return;
      }
      setSetupStatus(summary.site.setupStatus);
    } catch {
      setSetupStatus(null);
    } finally {
      setLoading(false);
    }
  }, [auth, siteId, status, setupRevision]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !setupStatus || HIDDEN_STATUSES.includes(setupStatus)) {
    return null;
  }

  return (
    <div className="border-b border-warning/20 bg-warning-subtle/70 px-4 py-2 lg:px-6 xl:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-normal text-ink">Site kurulumunuz henüz tamamlanmadı.</p>
        <Button type="button" size="sm" onClick={() => openWizard()}>
          Kuruluma Devam Et
        </Button>
      </div>
    </div>
  );
}
