"use client";

import { useCallback } from "react";
import { CatalogCrudPanel } from "@/components/settings/CatalogCrudPanel";
import {
  createExpenseType,
  deleteExpenseType,
  listExpenseTypes,
  updateExpenseType,
} from "@/lib/expenses-api";

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
      emptyLabel="Henüz gider türü eklenmedi."
      nameColumnLabel="Gider Türü"
      createPlaceholder="Yeni gider türü adı"
      createButtonLabel="Yeni Gider Türü"
      showSortOrder
      list={list}
      create={create}
      update={update}
      remove={remove}
      toasts={{
        created: "Gider türü oluşturuldu.",
        updated: "Gider türü güncellendi.",
        activated: "Gider türü aktifleştirildi.",
        deactivated: "Gider türü pasife alındı.",
        deleted: "Gider türü silindi.",
        softDeleted: "Kullanılmış gider türü pasife alındı.",
      }}
    />
  );
}
