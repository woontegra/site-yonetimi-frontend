"use client";

import { useCallback } from "react";
import { CatalogCrudPanel } from "@/components/settings/CatalogCrudPanel";
import {
  createAssetCategory,
  deleteAssetCategory,
  listAssetCategories,
  updateAssetCategory,
} from "@/lib/assets-api";

export function AssetCategoriesSettings() {
  const list = useCallback(async (auth: { token: string; tenantId: string }) => {
    const result = await listAssetCategories(auth, { status: "hepsi" });
    return result.items;
  }, []);

  const create = useCallback(
    async (
      auth: { token: string; tenantId: string },
      name: string,
      extra?: { description?: string },
    ) => {
      await createAssetCategory(auth, { name, description: extra?.description });
    },
    [],
  );

  const update = useCallback(
    async (
      auth: { token: string; tenantId: string },
      id: string,
      payload: { name?: string; isActive?: boolean; sortOrder?: number; description?: string | null },
    ) => {
      await updateAssetCategory(auth, id, payload);
    },
    [],
  );

  const remove = useCallback(async (auth: { token: string; tenantId: string }, id: string) => {
    const result = await deleteAssetCategory(auth, id);
    return { deactivated: result.deactivated };
  }, []);

  return (
    <CatalogCrudPanel
      emptyLabel="Henüz demirbaş kategorisi yok."
      nameColumnLabel="Kategori"
      createPlaceholder="Yeni kategori adı"
      createButtonLabel="Yeni Kategori"
      showSortOrder
      enableDescription
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
