import { Suspense } from "react";
import { BankAccountsPage } from "@/components/accounting/BankAccountsPage";

export default function BankalarRoute() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted">Yükleniyor…</div>}>
      <BankAccountsPage />
    </Suspense>
  );
}
