"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { ApiError } from "@/lib/http";

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
};

export function CatalogCrudPanel<T extends CatalogItem>({
  hint,
  emptyLabel,
  nameColumnLabel,
  createPlaceholder,
  createButtonLabel,
  showSortOrder = false,
  enableDescription = false,
  list,
  create,
  update,
  remove,
  toasts,
}: CatalogCrudPanelProps<T>) {
  const { showToast, toastError } = useToast();
  const auth = useApiAuth({ requireSite: false });
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
  }, [auth, list, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!auth || pending || !name.trim()) return;
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

  return (
    <div className="space-y-4">
      {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          className="h-10 flex-1"
          placeholder={createPlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreate();
            }
          }}
        />
        {enableDescription ? (
          <Input
            className="h-10 flex-1"
            placeholder="Açıklama (opsiyonel)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
            aria-label="Açıklama"
          />
        ) : null}
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={pending || !name.trim()}
          onClick={() => void handleCreate()}
        >
          <Plus className="size-3.5" aria-hidden />
          {createButtonLabel}
        </Button>
      </div>

      <Table>
        <TableElement>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>{nameColumnLabel}</TH>
              {showSortOrder ? <TH className="w-28">Sıralama</TH> : null}
              <TH className="w-28">Durum</TH>
              <TH className="w-52 text-right">İşlemler</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={colSpan}>
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                </TD>
              </TR>
            ) : null}
            {!loading && items.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={colSpan} className="py-6 text-center text-sm text-muted">
                  {emptyLabel}
                </TD>
              </TR>
            ) : null}
            {!loading
              ? items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      {editingId === item.id ? (
                        <div className="flex flex-col gap-1.5">
                          <Input
                            className="h-9"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            aria-label={nameColumnLabel}
                          />
                          {enableDescription ? (
                            <Input
                              className="h-9"
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
                            <span className="mt-0.5 block text-xs font-normal text-muted">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </TD>
                    {showSortOrder ? (
                      <TD>
                        {editingId === item.id ? (
                          <Input
                            className="h-9 w-24"
                            inputMode="numeric"
                            value={editSort}
                            onChange={(event) => setEditSort(event.target.value)}
                          />
                        ) : (
                          item.sortOrder
                        )}
                      </TD>
                    ) : null}
                    <TD>
                      <StatusBadge active={item.isActive} />
                    </TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {editingId === item.id ? (
                          <>
                            <button
                              type="button"
                              className="text-sm text-brand hover:underline"
                              onClick={() => void handleSaveEdit(item.id)}
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              className="text-sm text-muted hover:underline"
                              onClick={() => setEditingId(null)}
                            >
                              Vazgeç
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="text-sm text-brand hover:underline"
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
                              className="text-sm text-muted hover:underline"
                              onClick={() => void handleToggle(item)}
                            >
                              {item.isActive ? "Pasifleştir" : "Aktifleştir"}
                            </button>
                            <button
                              type="button"
                              className="text-sm text-danger hover:underline"
                              onClick={() => void handleDelete(item)}
                            >
                              Sil
                            </button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))
              : null}
          </TBody>
        </TableElement>
      </Table>
    </div>
  );
}
