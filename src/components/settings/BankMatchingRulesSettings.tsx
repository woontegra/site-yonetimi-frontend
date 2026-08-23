"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  BankMatchingRuleFormModal,
  bankMatchingRuleFormToPayload,
  bankMatchingRuleToForm,
  emptyBankMatchingRuleForm,
  type BankMatchingRuleFormValues,
} from "@/components/accounting/BankMatchingRuleFormModal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useActiveSite, useApiAuth } from "@/lib/active-site-context";
import { listApartments, type Apartment } from "@/lib/apartments-api";
import {
  createBankMatchingRule,
  deleteBankMatchingRule,
  listBankAccounts,
  listBankMatchingRules,
  updateBankMatchingRule,
  type BankAccount,
  type BankMatchingRule,
} from "@/lib/banks-api";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { ApiError } from "@/lib/http";
import { listPersons, type PersonListItem } from "@/lib/persons-api";

export function BankMatchingRulesSettings() {
  const { showToast } = useToast();
  const { siteId, site, status } = useActiveSite();
  const auth = useApiAuth({ requireSite: true });

  const [rules, setRules] = useState<BankMatchingRule[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [persons, setPersons] = useState<PersonListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankMatchingRule | null>(null);
  const [initialValues, setInitialValues] = useState(emptyBankMatchingRuleForm());
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<BankMatchingRule | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useCloseFormOnSiteChange(formOpen, () => {
    setFormOpen(false);
    setEditing(null);
  });

  const load = useCallback(async () => {
    if (!auth || !siteId) {
      setLoading(false);
      setRules([]);
      return;
    }
    setLoading(true);
    try {
      const [rulesResult, accountsResult, buildingsResult, personsResult] = await Promise.all([
        listBankMatchingRules(auth),
        listBankAccounts(auth, { activeOnly: true, perPage: 100 }),
        listBuildings(auth, { status: "aktif", perPage: 100 }),
        listPersons(auth, { perPage: 100 }),
      ]);
      setRules(rulesResult.items);
      setAccounts(accountsResult.items);
      setBuildings(buildingsResult.items);
      setPersons(personsResult.items);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Kurallar yüklenemedi.", "error");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [auth, siteId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleBuildingChange(buildingId: string) {
    if (!auth || !buildingId) {
      setApartments([]);
      return;
    }
    try {
      const result = await listApartments(auth, {
        buildingId,
        status: "aktif",
        perPage: 200,
      });
      setApartments(result.items);
    } catch {
      setApartments([]);
    }
  }

  function openCreate() {
    setEditing(null);
    setInitialValues(emptyBankMatchingRuleForm());
    setFormError("");
    setApartments([]);
    setFormOpen(true);
  }

  function openEdit(rule: BankMatchingRule) {
    setEditing(rule);
    setInitialValues(bankMatchingRuleToForm(rule));
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit(values: BankMatchingRuleFormValues) {
    if (!auth || formPending) return;
    setFormPending(true);
    setFormError("");
    try {
      if (editing) {
        await updateBankMatchingRule(auth, editing.id, {
          name: values.name.trim(),
          containsText: values.containsText.trim(),
          buildingId: values.buildingId || null,
          apartmentId: values.apartmentId || null,
          personId: values.personId || null,
          priority: values.priority.trim() ? Number(values.priority) : undefined,
        });
        showToast("Eşleştirme kuralı güncellendi.");
      } else {
        await createBankMatchingRule(auth, bankMatchingRuleFormToPayload(values));
        showToast("Eşleştirme kuralı oluşturuldu.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Kural kaydedilemedi.");
    } finally {
      setFormPending(false);
    }
  }

  async function handleToggle(rule: BankMatchingRule) {
    if (!auth) return;
    try {
      await updateBankMatchingRule(auth, rule.id, { isActive: !rule.isActive });
      showToast(rule.isActive ? "Kural pasife alındı." : "Kural aktifleştirildi.");
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Durum güncellenemedi.", "error");
    }
  }

  async function handleDelete() {
    if (!auth || !deleting || deletePending) return;
    setDeletePending(true);
    try {
      await deleteBankMatchingRule(auth, deleting.id);
      showToast("Eşleştirme kuralı silindi.");
      setDeleting(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Kural silinemedi.", "error");
    } finally {
      setDeletePending(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-muted">Yükleniyor…</p>;
  }

  if (status === "noSites" || !siteId) {
    return (
      <p className="text-sm text-muted">
        Önce bir site oluşturun.{" "}
        <Link href="/app/siteler" className="font-medium text-brand hover:underline">
          Siteler
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-[13px] text-muted">
          {site ? (
            <>
              Site: <span className="font-medium text-ink">{site.name}</span>
            </>
          ) : (
            "Seçili site için kurallar."
          )}
        </p>
        <Button type="button" size="sm" className="shrink-0" onClick={openCreate}>
          <Plus className="size-3.5" aria-hidden />
          Yeni Kural
        </Button>
      </div>

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Kural</TH>
              <TH>Banka Hesabı</TH>
              <TH>Açıklamada Geçen</TH>
              <TH>Bina</TH>
              <TH>Daire</TH>
              <TH className="w-20">Öncelik</TH>
              <TH className="w-24">Durum</TH>
              <TH className="w-44 text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={8}>
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                </TD>
              </TR>
            ) : null}
            {!loading && rules.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={8} className="py-6 text-center text-sm text-muted">
                  Henüz eşleştirme kuralı yok.
                </TD>
              </TR>
            ) : null}
            {!loading
              ? rules.map((rule) => (
                  <TR key={rule.id}>
                    <TD className="font-medium">{rule.name}</TD>
                    <TD>
                      {rule.bankAccount
                        ? `${rule.bankAccount.bankName} — ${rule.bankAccount.accountName}`
                        : "Tüm hesaplar"}
                    </TD>
                    <TD className="max-w-[180px] truncate">{rule.containsText}</TD>
                    <TD>{rule.building?.name ?? "—"}</TD>
                    <TD>{rule.apartment?.number ?? "—"}</TD>
                    <TD>{rule.priority}</TD>
                    <TD>
                      <StatusBadge active={rule.isActive} />
                    </TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="text-sm text-brand hover:underline"
                          onClick={() => openEdit(rule)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="text-sm text-muted hover:underline"
                          onClick={() => void handleToggle(rule)}
                        >
                          {rule.isActive ? "Pasifleştir" : "Aktifleştir"}
                        </button>
                        <button
                          type="button"
                          className="text-sm text-danger hover:underline"
                          onClick={() => setDeleting(rule)}
                        >
                          Sil
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>

      <BankMatchingRuleFormModal
        open={formOpen}
        mode={editing ? "edit" : "create"}
        siteLabel={site?.name}
        showBankAccountField
        bankAccounts={accounts.map((account) => ({
          id: account.id,
          bankName: account.bankName,
          accountName: account.accountName,
        }))}
        buildings={buildings}
        apartments={apartments}
        persons={persons}
        initialValues={initialValues}
        pending={formPending}
        error={formError}
        onClose={() => (formPending ? undefined : setFormOpen(false))}
        onSubmit={handleSubmit}
        onBuildingChange={(buildingId) => void handleBuildingChange(buildingId)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Kural silinsin mi?"
        description={
          deleting ? `"${deleting.name}" eşleştirme kuralı silinecek.` : ""
        }
        confirmLabel="Kuralı Sil"
        danger
        pending={deletePending}
        onConfirm={() => void handleDelete()}
        onClose={() => (deletePending ? undefined : setDeleting(null))}
      />
    </div>
  );
}
