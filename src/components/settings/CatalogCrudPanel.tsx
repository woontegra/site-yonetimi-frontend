"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import {
  SettingsField,
  SettingsInput,
  settingsUi,
} from "@/components/settings/settings-ui";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";
import { cn } from "@/lib/cn";

export type CatalogItem = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  description?: string | null;
};

type Auth = { token: string; tenantId: string; siteId?: string | null };

type CatalogCrudPanelProps<T extends CatalogItem> = {
  hint?: string;
  emptyLabel: string;
  nameColumnLabel: string;
  createPlaceholder: string;
  createButtonLabel: string;
  nameRequiredMessage?: string;
  showSortOrder?: boolean;
  enableDescription?: boolean;
  list: (auth: Auth) => Promise<T[]>;
  create: (auth: Auth, name: string, extra?: { description?: string }) => Promise<void>;
  update: (
    auth: Auth,
    id: string,
    payload: { name?: string; isActive?: boolean; sortOrder?: number; description?: string | null },
  ) => Promise<void>;
  remove: (auth: Auth, id: string) => Promise<{ deactivated?: boolean } | void>;
  toasts: {
    created: string;
    updated: string;
    activated: string;
    deactivated: string;
    deleted: string;
    softDeleted: string;
  };
  suggestedNames?: string[];
  seedButtonLabel?: string;
};

export function CatalogCrudPanel<T extends CatalogItem>({
  hint,
  emptyLabel,
  nameColumnLabel,
  createPlaceholder,
  createButtonLabel,
  nameRequiredMessage = "Ad zorunludur.",
  showSortOrder = false,
  enableDescription = false,
  list,
  create,
  update,
  remove,
  toasts,
  suggestedNames,
  seedButtonLabel = "Önerilenleri ekle",
}: CatalogCrudPanelProps<T>) {
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: false });
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSort, setEditSort] = useState("");

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(await list(auth));
    } catch (error) {
      toastError(error, "Liste yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [auth, list, toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!auth || pending) return;
    if (!name.trim()) {
      setNameError(nameRequiredMessage);
      return;
    }
    setNameError("");
    setPending(true);
    try {
      await create(auth, name.trim(), enableDescription ? { description: description.trim() || undefined } : undefined);
      setName("");
      setDescription("");
      showToast(toasts.created);
      await load();
    } catch (error) {
      toastError(error, "Kayıt oluşturulamadı.");
    } finally {
      setPending(false);
    }
  }

  async function handleSeedSuggested() {
    if (!auth || pending || !suggestedNames?.length) return;
    setPending(true);
    try {
      const existing = new Set(items.map((item) => item.name.trim().toLocaleLowerCase("tr")));
      let added = 0;
      for (const suggested of suggestedNames) {
        const key = suggested.trim().toLocaleLowerCase("tr");
        if (!key || existing.has(key)) continue;
        try {
          await create(auth, suggested.trim());
          existing.add(key);
          added += 1;
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 409)) {
            throw error;
          }
        }
      }
      if (added > 0) {
        showToast(`${added} kategori eklendi.`);
        await load();
      } else {
        showToast("Eklenecek yeni önerilen kategori kalmadı.");
      }
    } catch (error) {
      toastError(error, "Önerilen kategoriler eklenemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!auth || pending || !editName.trim()) return;
    const sortOrder = editSort.trim() ? Number(editSort) : undefined;
    if (showSortOrder && editSort.trim() && (!Number.isInteger(sortOrder) || (sortOrder ?? 0) < 0)) {
      showToast("Sıralama 0 veya pozitif tam sayı olmalıdır.", "error");
      return;
    }
    setPending(true);
    try {
      await update(auth, id, {
        name: editName.trim(),
        ...(showSortOrder && sortOrder !== undefined ? { sortOrder } : {}),
        ...(enableDescription ? { description: editDescription.trim() || null } : {}),
      });
      setEditingId(null);
      showToast(toasts.updated);
      await load();
    } catch (error) {
      toastError(error, "Güncellenemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle(item: T) {
    if (!auth || pending) return;
    setPending(true);
    try {
      await update(auth, item.id, { isActive: !item.isActive });
      showToast(item.isActive ? toasts.deactivated : toasts.activated);
      await load();
    } catch (error) {
      toastError(error, "Durum güncellenemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(item: T) {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await remove(auth, item.id);
      showToast(
        result && "deactivated" in result && result.deactivated
          ? toasts.softDeleted
          : toasts.deleted,
      );
      await load();
    } catch (error) {
      toastError(error, "Silinemedi.");
    } finally {
      setPending(false);
    }
  }

  const colSpan = showSortOrder ? 4 : 3;
  const showSeed = Boolean(suggestedNames?.length) && !loading && items.length === 0;

  return (
    <div className="space-y-3">
      {hint ? <p className={settingsUi.help}>{hint}</p> : null}

      <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-end", settingsUi.formGap)}>
        <SettingsField
          label={nameColumnLabel}
          htmlFor="catalog-create-name"
          className="flex-1"
          error={nameError}
          required
        >
          <SettingsInput
            id="catalog-create-name"
            placeholder={createPlaceholder}
            value={name}
            invalid={Boolean(nameError)}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
        </SettingsField>
        {enableDescription ? (
          <SettingsField label="Açıklama" htmlFor="catalog-create-description" className="flex-1" hint="Opsiyonel">
            <SettingsInput
              id="catalog-create-description"
              placeholder="Açıklama"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </SettingsField>
        ) : null}
        <button
          type="button"
          className={cn(settingsUi.btnPrimary, "shrink-0")}
          disabled={pending}
          onClick={() => void handleCreate()}
        >
          <Plus className="size-3.5" aria-hidden />
          {createButtonLabel}
        </button>
      </div>

      {showSeed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className={settingsUi.help}>İsterseniz hazır kategorileri ekleyebilirsiniz.</p>
          <button
            type="button"
            className={settingsUi.btnSm}
            disabled={pending}
            onClick={() => void handleSeedSuggested()}
          >
            {seedButtonLabel}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full border-collapse text-left">
          <thead className="border-b border-line bg-canvas/80">
            <tr>
              <th className={cn(settingsUi.tableHead, "px-3 py-2")}>{nameColumnLabel}</th>
              {showSortOrder ? (
                <th className={cn(settingsUi.tableHead, "w-24 px-3 py-2")}>Sıralama</th>
              ) : null}
              <th className={cn(settingsUi.tableHead, "w-24 px-3 py-2")}>Durum</th>
              <th className={cn(settingsUi.tableHead, "w-44 px-3 py-2 text-right")}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-3">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
                </td>
              </tr>
            ) : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className={cn(settingsUi.help, "px-3 py-4 text-center")}>
                  {emptyLabel}
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((item) => (
                  <tr key={item.id} className="border-b border-line/70 last:border-b-0 hover:bg-canvas/60">
                    <td className={cn(settingsUi.tableCell, "px-3 py-2.5")}>
                      {editingId === item.id ? (
                        <div className="flex flex-col gap-1.5">
                          <SettingsInput
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            aria-label={nameColumnLabel}
                          />
                          {enableDescription ? (
                            <SettingsInput
                              placeholder="Açıklama (opsiyonel)"
                              value={editDescription}
                              onChange={(event) => setEditDescription(event.target.value)}
                              aria-label="Açıklama"
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span>
                          <span className="font-medium">{item.name}</span>
                          {enableDescription && item.description ? (
                            <span className={cn(settingsUi.help, "mt-0.5 block")}>{item.description}</span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    {showSortOrder ? (
                      <td className={cn(settingsUi.tableCell, "px-3 py-2.5")}>
                        {editingId === item.id ? (
                          <SettingsInput
                            className="w-20"
                            inputMode="numeric"
                            value={editSort}
                            onChange={(event) => setEditSort(event.target.value)}
                          />
                        ) : (
                          item.sortOrder
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5">
                      <StatusBadge active={item.isActive} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {editingId === item.id ? (
                          <>
                            <button
                              type="button"
                              className={settingsUi.rowAction}
                              onClick={() => void handleSaveEdit(item.id)}
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              className={settingsUi.rowActionMuted}
                              onClick={() => setEditingId(null)}
                            >
                              Vazgeç
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={settingsUi.rowAction}
                              onClick={() => {
                                setEditingId(item.id);
                                setEditName(item.name);
                                setEditDescription(item.description ?? "");
                                setEditSort(String(item.sortOrder));
                              }}
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className={settingsUi.rowActionMuted}
                              onClick={() => void handleToggle(item)}
                            >
                              {item.isActive ? "Pasife Al" : "Aktifleştir"}
                            </button>
                            <button
                              type="button"
                              className={settingsUi.rowActionDanger}
                              onClick={() => void handleDelete(item)}
                            >
                              Sil
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
