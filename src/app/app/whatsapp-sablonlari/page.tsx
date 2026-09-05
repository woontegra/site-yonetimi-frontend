"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { WhatsAppTemplateEditorModal } from "@/components/whatsapp/WhatsAppTemplateEditorModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { formatDateTr } from "@/lib/money";
import {
  createWhatsAppTemplateFromLibrary,
  deleteWhatsAppTemplateDraft,
  duplicateWhatsAppTemplate,
  listMyWhatsAppTemplates,
  listWhatsAppTemplateLibrary,
  submitWhatsAppTemplateToMeta,
  syncWhatsAppTemplates,
  WHATSAPP_TEMPLATE_CATEGORY_LABELS,
  WHATSAPP_TEMPLATE_STATUS_LABELS,
  type WhatsAppLibraryItem,
  type WhatsAppTemplateMineItem,
  type WhatsAppTemplateStatus,
} from "@/lib/whatsapp-api";

type TabId = "library" | "mine";

function statusTone(
  status: WhatsAppTemplateStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  if (status === "DRAFT") return "neutral";
  return "neutral";
}

export default function WhatsAppSablonlariPage() {
  const auth = useApiAuth({ requireSite: true });
  const { showToast, toastError } = useToast();

  const [tab, setTab] = useState<TabId>("library");
  const [library, setLibrary] = useState<WhatsAppLibraryItem[]>([]);
  const [mine, setMine] = useState<WhatsAppTemplateMineItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [pending, setPending] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<WhatsAppTemplateMineItem | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);

  const loadLibrary = useCallback(async () => {
    if (!auth) {
      setLoadingLibrary(false);
      return;
    }
    setLoadingLibrary(true);
    try {
      const result = await listWhatsAppTemplateLibrary(auth);
      setLibrary(result.items);
    } catch (error) {
      toastError(error, "Kütüphane yüklenemedi.");
      setLibrary([]);
    } finally {
      setLoadingLibrary(false);
    }
  }, [auth, showToast]);

  const loadMine = useCallback(async () => {
    if (!auth) {
      setLoadingMine(false);
      return;
    }
    setLoadingMine(true);
    try {
      const result = await listMyWhatsAppTemplates(auth);
      setMine(result.items.filter((item) => !item.name.toLowerCase().startsWith("mk_")));
    } catch (error) {
      toastError(error, "Şablonlar yüklenemedi.");
      setMine([]);
    } finally {
      setLoadingMine(false);
    }
  }, [auth, showToast]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function handleSync() {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await syncWhatsAppTemplates(auth);
      const approved = result.items.filter((t) => t.status === "APPROVED" && t.sendable).length;
      showToast(
        `Meta şablonları senkronize edildi (${result.items.length} şablon, ${approved} gönderime uygun).`,
      );
      await loadMine();
    } catch (error) {
      showToast(
        error instanceof ApiError
          ? error.message
          : "Şablonlar senkronize edilemedi. Lütfen tekrar deneyin.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  function openCreateCustom() {
    setEditorItem(null);
    setEditorReadOnly(false);
    setEditorOpen(true);
  }

  function openEditor(item: WhatsAppTemplateMineItem, readOnly = false) {
    setEditorItem(item);
    setEditorReadOnly(readOnly);
    setEditorOpen(true);
  }

  async function handleUseLibrary(item: WhatsAppLibraryItem) {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await createWhatsAppTemplateFromLibrary(auth, item.key);
      showToast("Kütüphane şablonu taslak olarak oluşturuldu.");
      await loadMine();
      setTab("mine");
      openEditor(result.item, false);
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : "Şablon oluşturulamadı.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(item: WhatsAppTemplateMineItem) {
    if (!auth || pending) return;
    if (!window.confirm(`“${item.displayName}” taslağı silinsin mi?`)) return;
    setPending(true);
    try {
      await deleteWhatsAppTemplateDraft(auth, item.id);
      showToast("Taslak silindi.");
      await loadMine();
    } catch (error) {
      toastError(error, "Silinemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(item: WhatsAppTemplateMineItem) {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await submitWhatsAppTemplateToMeta(auth, item.id);
      showToast(result.message);
      await loadMine();
    } catch (error) {
      toastError(error, "Gönderilemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleDuplicate(item: WhatsAppTemplateMineItem) {
    if (!auth || pending) return;
    setPending(true);
    try {
      const result = await duplicateWhatsAppTemplate(auth, item.id);
      showToast("Reddedilen şablon kopyalandı.");
      await loadMine();
      openEditor(result.item, false);
    } catch (error) {
      toastError(error, "Kopyalanamadı.");
    } finally {
      setPending(false);
    }
  }

  function handleEditorSaved() {
    void loadMine();
  }

  return (
    <PageContainer>
      <PageHeader
        title="WhatsApp Şablonları"
        description="Meta onaylı şablonları kütüphaneden kullanın veya kendi şablonunuzu oluşturun."
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => void handleSync()}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Meta ile Senkronize Et
            </Button>
            <Button disabled={pending} onClick={openCreateCustom}>
              <Plus className="size-3.5" aria-hidden />
              Kendi Şablonunu Oluştur
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-line">
        {(
          [
            { id: "library" as const, label: "Şablon Kütüphanesi" },
            { id: "mine" as const, label: "Şablonlarım" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm transition-colors duration-micro",
              tab === item.id
                ? "border-brand font-medium text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <div className="space-y-3">
          {loadingLibrary ? (
            <p className="text-[13px] text-muted">Kütüphane yükleniyor…</p>
          ) : library.length === 0 ? (
            <p className="text-[13px] text-muted">Kütüphane şablonu bulunamadı.</p>
          ) : (
            library.map((item) => (
              <div
                key={item.key}
                className="flex flex-col gap-3 rounded-md border border-line bg-white px-4 py-4 shadow-panel sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{item.displayName}</p>
                  <p className="mt-1 text-[13px] text-muted">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(item.variableLabels).map(([slot, label]) => (
                      <Badge key={slot}>{label}</Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => void handleUseLibrary(item)}
                  className="shrink-0"
                >
                  Kullan
                </Button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "mine" ? (
        <Table>
          <TableElement>
            <THead>
              <TR>
                <TH>Şablon</TH>
                <TH>Meta Adı</TH>
                <TH>Dil</TH>
                <TH>Kategori</TH>
                <TH>Durum</TH>
                <TH>Son Senkronizasyon</TH>
                <TH>İşlemler</TH>
              </TR>
            </THead>
            <TBody>
              {loadingMine ? (
                <TR>
                  <TD colSpan={7} className="text-muted">
                    Yükleniyor…
                  </TD>
                </TR>
              ) : mine.length === 0 ? (
                <TR>
                  <TD colSpan={7}>
                    <div className="py-4 text-center">
                      <p className="text-[13px] text-muted">Henüz WhatsApp şablonunuz yok.</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setTab("library")}
                        >
                          Kütüphaneye Git
                        </Button>
                        <Button size="sm" onClick={openCreateCustom}>
                          Kendi Şablonunu Oluştur
                        </Button>
                      </div>
                    </div>
                  </TD>
                </TR>
              ) : (
                mine.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <p className="font-medium">{item.displayName}</p>
                      {item.status === "REJECTED" && item.rejectionReason ? (
                        <p className="mt-1 text-[12px] text-danger">{item.rejectionReason}</p>
                      ) : null}
                    </TD>
                    <TD className="font-mono text-[12px]">{item.name}</TD>
                    <TD>{item.language}</TD>
                    <TD>
                      {item.category
                        ? (WHATSAPP_TEMPLATE_CATEGORY_LABELS[item.category] ?? item.category)
                        : "—"}
                    </TD>
                    <TD>
                      <Badge tone={statusTone(item.status)}>
                        {item.statusLabel || WHATSAPP_TEMPLATE_STATUS_LABELS[item.status]}
                      </Badge>
                    </TD>
                    <TD>{formatDateTr(item.lastSyncedAt)}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        {item.status === "DRAFT" ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pending}
                              onClick={() => openEditor(item, false)}
                            >
                              Düzenle
                            </Button>
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => void handleSubmit(item)}
                            >
                              Meta&apos;ya Gönder
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => void handleDelete(item)}
                            >
                              Sil
                            </Button>
                          </>
                        ) : null}
                        {item.status === "PENDING" || item.status === "APPROVED" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditor(item, true)}
                          >
                            Görüntüle
                          </Button>
                        ) : null}
                        {item.status === "REJECTED" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() => void handleDuplicate(item)}
                          >
                            Kopyala ve Düzenle
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </TableElement>
        </Table>
      ) : null}

      <WhatsAppTemplateEditorModal
        open={editorOpen}
        item={editorItem}
        readOnly={editorReadOnly}
        onClose={() => setEditorOpen(false)}
        onSaved={handleEditorSaved}
      />
    </PageContainer>
  );
}
