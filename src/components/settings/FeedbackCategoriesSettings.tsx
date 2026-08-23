"use client";

import { useCallback } from "react";
import { CatalogCrudPanel } from "@/components/settings/CatalogCrudPanel";
import {
  createFeedbackCategory,
  deleteFeedbackCategory,
  listFeedbackCategories,
  updateFeedbackCategory,
} from "@/lib/feedback-api";

export function FeedbackCategoriesSettings() {
  const list = useCallback(async (auth: { token: string; tenantId: string }) => {
    const result = await listFeedbackCategories(auth, { status: "hepsi" });
    return result.items;
  }, []);

  const create = useCallback(async (auth: { token: string; tenantId: string }, name: string) => {
    await createFeedbackCategory(auth, { name });
  }, []);

  const update = useCallback(
    async (
      auth: { token: string; tenantId: string },
      id: string,
      payload: { name?: string; isActive?: boolean; sortOrder?: number },
    ) => {
      await updateFeedbackCategory(auth, id, payload);
    },
    [],
  );

  const remove = useCallback(async (auth: { token: string; tenantId: string }, id: string) => {
    const result = await deleteFeedbackCategory(auth, id);
    return { deactivated: result.deactivated };
  }, []);

  return (
    <CatalogCrudPanel
      emptyLabel="Henüz bilgi / öneri kategorisi yok."
      nameColumnLabel="Kategori"
      createPlaceholder="Yeni kategori adı"
      createButtonLabel="Yeni Kategori"
      showSortOrder
      list={list}
      create={create}
      update={update}
      remove={remove}
      toasts={{
        created: "Kategori oluşturuldu.",
        updated: "Kategori güncellendi.",
        activated: "Kategori aktifleştirildi.",
        deactivated: "Kategori pasife alındı.",
        deleted: "Kategori silindi.",
        softDeleted: "Kullanılmış kategori pasife alındı.",
      }}
    />
  );
}
