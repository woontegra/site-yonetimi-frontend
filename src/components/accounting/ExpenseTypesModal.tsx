"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import {
  createExpenseType,
  deleteExpenseType,
  listExpenseTypes,
  updateExpenseType,
  type ExpenseType,
} from "@/lib/expenses-api";
import { ApiError } from "@/lib/http";

type AuthContext = { token: string; tenantId: string };

type ExpenseTypesModalProps = {
  open: boolean;
  auth: AuthContext | null;
  onClose: () => void;
  onChanged?: () => void;
};

export function ExpenseTypesModal({ open, auth, onClose, onChanged }: ExpenseTypesModalProps) {
  const { showToast, toastError } = useToast();
  const [items, setItems] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const result = await listExpenseTypes(auth);
      setItems(result.items);
    } catch (err) {
      toastError(err, "Gider türleri yüklenemedi.");
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
      await createExpenseType(auth, { name: name.trim() });
      setName("");
      showToast("Gider türü eklendi.");
      await load();
      onChanged?.();
    } catch (err) {
      toastError(err, "Gider türü eklenemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!auth || pending || !editName.trim()) return;
    setPending(true);
    try {
      await updateExpenseType(auth, id, { name: editName.trim() });
      setEditingId(null);
      showToast("Gider türü güncellendi.");
      await load();
      onChanged?.();
    } catch (err) {
      toastError(err, "Güncellenemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle(type: ExpenseType) {
    if (!auth || pending) return;
    setPending(true);
    try {
      await updateExpenseType(auth, type.id, { isActive: !type.isActive });
      showToast(type.isActive ? "Gider türü pasife alındı." : "Gider türü aktifleştirildi.");
      await load();
      onChanged?.();
    } catch (err) {
      toastError(err, "Durum güncellenemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(type: ExpenseType) {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await deleteExpenseType(auth, type.id);
      showToast(
        result.deactivated
          ? "Kullanılmış gider türü pasife alındı."
          : "Gider türü silindi.",
      );
      await load();
      onChanged?.();
    } catch (err) {
      toastError(err, "Silinemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Gider Türleri"
      description="Gider kategorilerini yönetin."
      variant="form"
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Kapat</Button>}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Yeni gider türü adı"
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
            Yeni Gider Türü
          </Button>
        </div>

        <Table>
          <TableElement>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Gider Türü</TH>
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
                    Henüz gider türü yok.
                  </TD>
                </TR>
              ) : null}
              {!loading
                ? items.map((type) => (
                    <TR key={type.id}>
                      <TD>
                        {editingId === type.id ? (
                          <Input
                            className="h-9"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                          />
                        ) : (
                          type.name
                        )}
                      </TD>
                      <TD>{type.isActive ? "Aktif" : "Pasif"}</TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-2">
                          {editingId === type.id ? (
                            <>
                              <button
                                type="button"
                                className="text-sm text-brand hover:underline"
                                onClick={() => void handleSaveEdit(type.id)}
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
                                  setEditingId(type.id);
                                  setEditName(type.name);
                                }}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                className="text-sm text-muted hover:underline"
                                onClick={() => void handleToggle(type)}
                              >
                                {type.isActive ? "Pasifleştir" : "Aktifleştir"}
                              </button>
                              <button
                                type="button"
                                className="text-sm text-danger hover:underline"
                                onClick={() => void handleDelete(type)}
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
