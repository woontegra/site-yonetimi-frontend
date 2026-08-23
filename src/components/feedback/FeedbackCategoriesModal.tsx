"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import {
  createFeedbackCategory,
  deleteFeedbackCategory,
  listFeedbackCategories,
  updateFeedbackCategory,
  type FeedbackCategory,
} from "@/lib/feedback-api";
import { ApiError } from "@/lib/http";

type AuthContext = { token: string; tenantId: string; siteId?: string | null };

type FeedbackCategoriesModalProps = {
  open: boolean;
  auth: AuthContext | null;
  onClose: () => void;
  onChanged?: () => void;
};

export function FeedbackCategoriesModal({
  open,
  auth,
  onClose,
  onChanged,
}: FeedbackCategoriesModalProps) {
  const { showToast } = useToast();
  const [items, setItems] = useState<FeedbackCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const result = await listFeedbackCategories(auth, { status: "hepsi" });
      setItems(result.items);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Kategoriler yüklenemedi.", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [auth, showToast]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEditingId(null);
    void load();
  }, [open, load]);

  async function handleCreate() {
    if (!auth || pending || !name.trim()) return;
    setPending(true);
    try {
      await createFeedbackCategory(auth, { name: name.trim() });
      setName("");
      showToast("Kategori eklendi.");
      await load();
      onChanged?.();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Kategori eklenemedi.", "error");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!auth || pending || !editName.trim()) return;
    setPending(true);
    try {
      await updateFeedbackCategory(auth, id, { name: editName.trim() });
      setEditingId(null);
      showToast("Kategori güncellendi.");
      await load();
      onChanged?.();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Güncellenemedi.", "error");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle(category: FeedbackCategory) {
    if (!auth || pending) return;
    setPending(true);
    try {
      await updateFeedbackCategory(auth, category.id, { isActive: !category.isActive });
      showToast(category.isActive ? "Kategori pasife alındı." : "Kategori aktifleştirildi.");
      await load();
      onChanged?.();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Durum güncellenemedi.", "error");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(category: FeedbackCategory) {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await deleteFeedbackCategory(auth, category.id);
      showToast(
        result.deactivated ? "Kullanılmış kategori pasife alındı." : "Kategori silindi.",
      );
      await load();
      onChanged?.();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Silinemedi.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Kategoriler"
      description="Bilgi ve öneri kategorilerini yönetin."
      variant="form"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            className="h-10 flex-1"
            placeholder="Yeni kategori adı"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
          <Button size="sm" disabled={pending || !name.trim()} onClick={() => void handleCreate()}>
            <Plus className="size-3.5" aria-hidden />
            Yeni Kategori
          </Button>
        </div>

        <Table>
          <TableElement>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kategori</TH>
                <TH>Durum</TH>
                <TH className="text-right">İşlemler</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR className="hover:bg-transparent">
                  <TD colSpan={3}>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  </TD>
                </TR>
              ) : null}
              {!loading && items.length === 0 ? (
                <TR className="hover:bg-transparent">
                  <TD colSpan={3} className="py-6 text-center text-sm text-muted">
                    Henüz kategori yok.
                  </TD>
                </TR>
              ) : null}
              {!loading
                ? items.map((category) => (
                    <TR key={category.id}>
                      <TD>
                        {editingId === category.id ? (
                          <Input
                            className="h-9"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                          />
                        ) : (
                          <span>
                            {category.name}
                            {category.recordCount > 0 ? (
                              <span className="ml-1 text-xs text-muted">({category.recordCount})</span>
                            ) : null}
                          </span>
                        )}
                      </TD>
                      <TD>{category.isActive ? "Aktif" : "Pasif"}</TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-2">
                          {editingId === category.id ? (
                            <>
                              <button
                                type="button"
                                className="text-sm text-brand hover:underline"
                                onClick={() => void handleSaveEdit(category.id)}
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
                                  setEditingId(category.id);
                                  setEditName(category.name);
                                }}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                className="text-sm text-muted hover:underline"
                                onClick={() => void handleToggle(category)}
                              >
                                {category.isActive ? "Pasifleştir" : "Aktifleştir"}
                              </button>
                              <button
                                type="button"
                                className="text-sm text-danger hover:underline"
                                onClick={() => void handleDelete(category)}
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
    </Modal>
  );
}
