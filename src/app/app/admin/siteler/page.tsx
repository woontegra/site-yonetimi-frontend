import { Suspense } from "react";
import { AdminSitesPage } from "@/components/admin/AdminSitesPage";

export default function AdminSitesRoute() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted">Yükleniyor…</div>}>
      <AdminSitesPage />
    </Suspense>
  );
}
