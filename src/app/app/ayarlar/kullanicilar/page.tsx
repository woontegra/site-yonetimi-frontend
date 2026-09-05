import { Suspense } from "react";
import { TenantUsersPage } from "@/components/settings/TenantUsersPage";

export default function TenantUsersRoutePage() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted">Yükleniyor…</div>}>
      <TenantUsersPage />
    </Suspense>
  );
}
