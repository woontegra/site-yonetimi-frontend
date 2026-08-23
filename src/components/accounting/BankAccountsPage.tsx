"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import {
  BankAccountFormModal,
  bankAccountFormToPayload,
  emptyBankAccountForm,
  type BankAccountFormValues,
} from "@/components/accounting/BankAccountFormModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { NeedSiteDialog } from "@/components/sites/NeedSiteDialog";
import { useAuth } from "@/lib/auth-context";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import {
  createBankAccount,
  listBankAccounts,
  type BankAccount,
} from "@/lib/banks-api";
import { ApiError } from "@/lib/http";
import { formatMoney } from "@/lib/money";

export function BankAccountsPage() {
  const { ready } = useAuth();
  const { showToast } = useToast();
  const auth = useApiAuth({ requireSite: true });
  const { site, siteId, hasSites } = useActiveSite();

  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [needSiteOpen, setNeedSiteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError("");
    try {
      const result = await listBankAccounts(auth, { perPage: 100 });
      setItems(result.items);
    } catch (error) {
      setItems([]);
      setListError(error instanceof ApiError ? error.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleSubmit(values: BankAccountFormValues) {
    if (!auth || formPending) return;
    if (!values.siteId) {
      setFormError("Site seçimi zorunludur.");
      return;
    }
    setFormPending(true);
    setFormError("");
    try {
      await createBankAccount({ ...auth, siteId: values.siteId }, bankAccountFormToPayload(values));
      showToast("Banka hesabı eklendi.");
      setFormOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Hesap kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/app/muhasebe"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Muhasebe
      </Link>

      <PageHeader
        title="Banka Hesapları"
        description={
          site?.name ? `${site.name} için banka hesaplarını yönetin.` : "Banka hesaplarını yönetin."
        }
        actions={
          <Button
            onClick={() => {
              if (!hasSites) {
                setNeedSiteOpen(true);
                return;
              }
              setFormError("");
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Banka Hesabı
          </Button>
        }
      />

      {listError ? <p className="mb-3 text-sm text-danger">{listError}</p> : null}

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Banka</TH>
              <TH>Hesap</TH>
              <TH>IBAN</TH>
              <TH className="text-right">Kayıtlı Bakiye</TH>
              <TH>Bağlantı</TH>
              <TH>Son Senkronizasyon</TH>
              <TH className="text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <TR key={`s-${index}`} className="hover:bg-transparent">
                    <TD colSpan={7}>
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    </TD>
                  </TR>
                ))
              : null}
            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={7} className="py-8 text-center text-sm text-muted">
                  Henüz banka hesabı bulunmuyor.
                </TD>
              </TR>
            ) : null}
            {!loading
              ? items.map((account) => (
                  <TR key={account.id}>
                    <TD className="font-medium">{account.bankName}</TD>
                    <TD>{account.accountName}</TD>
                    <TD className="font-mono text-[13px]">{account.iban || "—"}</TD>
                    <TD className="text-right font-medium">
                      {formatMoney(account.bookBalance)}
                    </TD>
                    <TD>Manuel</TD>
                    <TD>—</TD>
                    <TD className="text-right">
                      <Link
                        href={`/app/muhasebe/bankalar/${account.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        Detay
                      </Link>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>

      <BankAccountFormModal
        open={formOpen}
        initialValues={emptyBankAccountForm({ siteId: siteId ?? "" })}
        pending={formPending}
        error={formError}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <NeedSiteDialog open={needSiteOpen} onClose={() => setNeedSiteOpen(false)} />
    </PageContainer>
  );
}
