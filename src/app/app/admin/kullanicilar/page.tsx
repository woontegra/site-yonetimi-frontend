import { Suspense } from "react";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export default function AdminUsersRoute() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted">Yükleniyor…</div>}>
      <AdminUsersPage />
    </Suspense>
  );
}
