"use client";

import { useCallback } from "react";
import { CatalogCrudPanel } from "@/components/settings/CatalogCrudPanel";
import {
  createExpenseType,
  deleteExpenseType,
  listExpenseTypes,
  updateExpenseType,
} from "@/lib/expenses-api";

const SUGGESTED_EXPENSE_CATEGORIES = [
  "Elektrik",
  "Su",
  "Bahçıvan",
  "Temizlik",
  "Personel",
  "Bakım ve Onarım",
  "Sigorta",
  "Vergi ve Harç",
  "Yönetim Gideri",
  "Diğer",
];

export function FinanceDefinitionsSettings() {
  const list = useCallback(async (auth: { token: string; tenantId: string }) => {
    const result = await listExpenseTypes(auth);
    return result.items;
  }, []);

  const create = useCallback(async (auth: { token: string; tenantId: string }, name: string) => {
    await createExpenseType(auth, { name });
  }, []);

  const update = useCallback(
    async (
      auth: { token: string; tenantId: string },
      id: string,
      payload: { name?: string; isActive?: boolean; sortOrder?: number },
    ) => {
      await updateExpenseType(auth, id, payload);
    },
    [],
  );

  const remove = useCallback(async (auth: { token: string; tenantId: string }, id: string) => {
    const result = await deleteExpenseType(auth, id);
    return { deactivated: result.deactivated };
  }, []);

  return (
    <CatalogCrudPanel
      emptyLabel="Henüz gider kategorisi eklenmedi."
      nameColumnLabel="Gider kategorisi"
      createPlaceholder="Örn. Elektrik"
      createButtonLabel="Yeni Gider Kategorisi"
      nameRequiredMessage="Gider kategorisi adı zorunludur."
      showSortOrder
      suggestedNames={SUGGESTED_EXPENSE_CATEGORIES}
      seedButtonLabel="Önerilen kategorileri ekle"
      list={list}
      create={create}
      update={update}
      remove={remove}
      toasts={{
        created: "Gider kategorisi eklendi.",
        updated: "Gider kategorisi güncellendi.",
        activated: "Gider kategorisi aktifleştirildi.",
        deactivated: "Gider kategorisi pasife alındı.",
        deleted: "Gider kategorisi silindi.",
        softDeleted: "Kullanımdaki gider kategorisi pasife alındı.",
      }}
    />
  );
}
