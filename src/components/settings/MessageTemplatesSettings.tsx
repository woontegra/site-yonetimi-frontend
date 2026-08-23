"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import {
  activateMessageTemplate,
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_TEMPLATE_VARIABLES,
  previewTemplateBodySample,
  updateMessageTemplate,
  type MessageChannel,
  type MessageTemplate,
} from "@/lib/communications-api";
import { ApiError } from "@/lib/http";
import {
  listWhatsAppTemplates,
  type WhatsAppTemplate,
} from "@/lib/whatsapp-api";

type FormState = {
  name: string;
  channel: MessageChannel;
  body: string;
  whatsAppTemplateId: string;
  whatsAppParameterMapping: Record<string, string>;
};

const emptyForm = (channel: MessageChannel = "WHATSAPP"): FormState => ({
  name: "",
  channel,
  body: "",
  whatsAppTemplateId: "",
  whatsAppParameterMapping: {},
});

function emptyMapping(count: number): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (let i = 1; i <= count; i += 1) {
    mapping[String(i)] = "";
  }
  return mapping;
}

function mergeMapping(
  count: number,
  existing: Record<string, string> | null | undefined,
): Record<string, string> {
  const base = emptyMapping(count);
  if (!existing) return base;
  for (let i = 1; i <= count; i += 1) {
    const key = String(i);
    if (existing[key]) base[key] = existing[key];
  }
  return base;
}

function mappingComplete(count: number, mapping: Record<string, string>): boolean {
  if (count === 0) return true;
  for (let i = 1; i <= count; i += 1) {
    const field = mapping[String(i)];
    if (!field || !MESSAGE_TEMPLATE_VARIABLES.some((item) => item.key === field)) {
      return false;
    }
  }
  return true;
}

export function MessageTemplatesSettings() {
  const auth = useApiAuth({ requireSite: true });
  const { showToast } = useToast();

  const [channelFilter, setChannelFilter] = useState<MessageChannel | "">("");
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState("");
  const [cursor, setCursor] = useState<{ start: number; end: number } | null>(null);

  const load = useCallback(async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await listMessageTemplates(auth, {
        channel: channelFilter || undefined,
      });
      setItems(result.items);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Şablonlar yüklenemedi.", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [auth, channelFilter, showToast]);

  const loadWaTemplates = useCallback(async () => {
    if (!auth) {
      setWaTemplates([]);
      return;
    }
    setWaTemplatesLoading(true);
    try {
      const result = await listWhatsAppTemplates(auth, { status: "APPROVED" });
      setWaTemplates(result.items.filter((item) => item.sendable));
    } catch {
      setWaTemplates([]);
    } finally {
      setWaTemplatesLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (formOpen && form.channel === "WHATSAPP") {
      void loadWaTemplates();
    }
  }, [formOpen, form.channel, loadWaTemplates]);

  const selectedWaTemplate = useMemo(
    () => waTemplates.find((item) => item.id === form.whatsAppTemplateId) ?? null,
    [waTemplates, form.whatsAppTemplateId],
  );

  const paramCount = selectedWaTemplate?.bodyVariableCount ?? 0;

  const samplePreview = useMemo(
    () => (form.body.trim() ? previewTemplateBodySample(form.body) : ""),
    [form.body],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(channelFilter || "WHATSAPP"));
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(item: MessageTemplate) {
    setEditing(item);
    const count = item.whatsAppTemplate?.bodyVariableCount ?? 0;
    setForm({
      name: item.name,
      channel: item.channel,
      body: item.body,
      whatsAppTemplateId: item.whatsAppTemplateId ?? "",
      whatsAppParameterMapping: mergeMapping(count, item.whatsAppParameterMapping),
    });
    setFormError("");
    setFormOpen(true);
  }

  function handleWaTemplateChange(templateId: string) {
    const template = waTemplates.find((item) => item.id === templateId);
    const count = template?.bodyVariableCount ?? 0;
    setForm((prev) => ({
      ...prev,
      whatsAppTemplateId: templateId,
      whatsAppParameterMapping: mergeMapping(count, prev.whatsAppParameterMapping),
      body: template ? `[Meta] ${template.name} · ${template.language}` : prev.body,
    }));
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    setForm((prev) => {
      const start = cursor?.start ?? prev.body.length;
      const end = cursor?.end ?? prev.body.length;
      const next = `${prev.body.slice(0, start)}${token}${prev.body.slice(end)}`;
      const pos = start + token.length;
      setCursor({ start: pos, end: pos });
      return { ...prev, body: next };
    });
  }

  async function handleSave() {
    if (!auth || pending) return;
    if (!form.name.trim()) {
      setFormError("Ad zorunludur.");
      return;
    }

    if (form.channel === "SMS") {
      if (!form.body.trim()) {
        setFormError("İçerik zorunludur.");
        return;
      }
    } else {
      if (!form.whatsAppTemplateId) {
        setFormError("Meta WhatsApp şablonu seçin.");
        return;
      }
      if (!mappingComplete(paramCount, form.whatsAppParameterMapping)) {
        setFormError("WhatsApp şablonundaki tüm değişkenleri eşleştirin.");
        return;
      }
    }

    const body =
      form.channel === "WHATSAPP"
        ? form.body.trim() ||
          (selectedWaTemplate
            ? `[Meta] ${selectedWaTemplate.name} · ${selectedWaTemplate.language}`
            : form.name.trim())
        : form.body.trim();

    setPending(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        channel: form.channel,
        body,
        ...(form.channel === "WHATSAPP"
          ? {
              whatsAppTemplateId: form.whatsAppTemplateId,
              whatsAppParameterMapping: form.whatsAppParameterMapping,
            }
          : {
              whatsAppTemplateId: null,
              whatsAppParameterMapping: null,
            }),
      };
      if (editing) {
        await updateMessageTemplate(auth, editing.id, payload);
        showToast("Şablon güncellendi.");
      } else {
        await createMessageTemplate(auth, payload);
        showToast("Şablon oluşturuldu.");
      }
      setFormOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Şablon kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle(item: MessageTemplate) {
    if (!auth || pending) return;
    setPending(true);
    try {
      await activateMessageTemplate(auth, item.id, !item.isActive);
      showToast(item.isActive ? "Şablon pasife alındı." : "Şablon aktifleştirildi.");
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Durum güncellenemedi.", "error");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(item: MessageTemplate) {
    if (!auth || pending) return;
    if (!window.confirm(`“${item.name}” şablonu silinsin mi?`)) return;
    setPending(true);
    try {
      await deleteMessageTemplate(auth, item.id);
      showToast("Şablon silindi.");
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Şablon silinemedi.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        SMS şablonlarında değişkenler gönderimde doldurulur. WhatsApp şablonları Meta onaylı şablonlarla eşleşir.
      </p>
      <p className="rounded-[10px] border border-line bg-canvas/40 px-3 py-2.5 text-[13px] text-muted">
        Meta şablon oluşturma ve onay süreci için{" "}
        <Link href="/app/whatsapp-sablonlari" className="font-medium text-brand hover:underline">
          WhatsApp Şablonları
        </Link>{" "}
        sayfasını kullanın.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as MessageChannel | "")}
          className="sm:max-w-[220px]"
          aria-label="Kanal filtresi"
        >
          <option value="">Tüm kanallar</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
        </Select>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" aria-hidden />
          Yeni Şablon
        </Button>
      </div>

      <Table>
        <TableElement>
          <THead>
            <TR>
              <TH>Ad</TH>
              <TH>Kanal</TH>
              <TH>Meta / İçerik</TH>
              <TH>Durum</TH>
              <TH>İşlem</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              <TR>
                <TD colSpan={5} className="text-muted">
                  Yükleniyor…
                </TD>
              </TR>
            ) : items.length === 0 ? (
              <TR>
                <TD colSpan={5} className="text-muted">
                  Henüz mesaj şablonu yok.
                </TD>
              </TR>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <p className="font-medium">{item.name}</p>
                  </TD>
                  <TD>
                    <Badge>{MESSAGE_CHANNEL_LABELS[item.channel]}</Badge>
                  </TD>
                  <TD>
                    {item.channel === "WHATSAPP" && item.whatsAppTemplate ? (
                      <p className="text-[13px] text-ink">
                        {item.whatsAppTemplate.name} · {item.whatsAppTemplate.language}
                      </p>
                    ) : (
                      <p className="max-w-[360px] truncate text-[12px] text-muted">{item.body}</p>
                    )}
                  </TD>
                  <TD>
                    <StatusBadge active={item.isActive} />
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => void handleToggle(item)}
                      >
                        {item.isActive ? "Pasife Al" : "Aktifleştir"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => void handleDelete(item)}
                      >
                        Sil
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableElement>
      </Table>

      <FormModal
        open={formOpen}
        title={editing ? "Şablonu Düzenle" : "Yeni Şablon"}
        description={
          form.channel === "WHATSAPP"
            ? "Meta onaylı WhatsApp şablonunu seçin ve değişkenleri eşleştirin."
            : "Mesaj gövdesinde değişken çiplerini kullanabilirsiniz."
        }
        onClose={() => (pending ? undefined : setFormOpen(false))}
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setFormOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => void handleSave()}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Ad" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Borç Hatırlatma"
              data-modal-autofocus
            />
          </FormField>
          <FormField label="Kanal" required>
            <Select
              value={form.channel}
              onChange={(e) => {
                const channel = e.target.value as MessageChannel;
                setForm((prev) => ({
                  ...emptyForm(channel),
                  name: prev.name,
                }));
              }}
              disabled={Boolean(editing)}
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </Select>
          </FormField>

          {form.channel === "WHATSAPP" ? (
            <>
              <FormField
                label="Meta WhatsApp Şablonu"
                required
                hint="Yalnızca onaylı ve gönderime uygun şablonlar listelenir."
              >
                <Select
                  value={form.whatsAppTemplateId}
                  onChange={(e) => handleWaTemplateChange(e.target.value)}
                  disabled={waTemplatesLoading}
                >
                  <option value="">
                    {waTemplatesLoading ? "Şablonlar yükleniyor…" : "Şablon seçin"}
                  </option>
                  {waTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.language}
                    </option>
                  ))}
                </Select>
              </FormField>
              {!waTemplatesLoading && waTemplates.length === 0 ? (
                <p className="text-[13px] text-muted">
                  Onaylı Meta şablonu bulunamadı.{" "}
                  <Link href="/app/entegrasyonlar" className="font-medium text-brand hover:underline">
                    Entegrasyonlar
                  </Link>{" "}
                  sayfasından WhatsApp bağlantısı kurup şablonları senkronize edin.
                </p>
              ) : null}
              {paramCount > 0 ? (
                <div className="space-y-2 rounded-[10px] border border-line bg-canvas/40 p-3">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
                    Değişken eşleştirme
                  </p>
                  {Array.from({ length: paramCount }, (_, index) => {
                    const slot = String(index + 1);
                    return (
                      <div key={slot} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
                        <span className="text-[13px] font-medium text-ink">{`{{${slot}}}`}</span>
                        <Select
                          value={form.whatsAppParameterMapping[slot] ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              whatsAppParameterMapping: {
                                ...prev.whatsAppParameterMapping,
                                [slot]: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Alan seçin</option>
                          {MESSAGE_TEMPLATE_VARIABLES.map((variable) => (
                            <option key={variable.key} value={variable.key}>
                              {variable.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    );
                  })}
                </div>
              ) : selectedWaTemplate ? (
                <p className="text-[13px] text-muted">Bu Meta şablonunda gövde değişkeni yok.</p>
              ) : null}
              <FormField
                label="Önizleme metni"
                hint="Uygulama içi önizleme için kullanılır; Meta şablonu gönderimde kullanılır."
              >
                <Textarea
                  rows={3}
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Opsiyonel önizleme metni"
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="İçerik" required hint="Değişken çiplerine tıklayarak ekleyin.">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {MESSAGE_TEMPLATE_VARIABLES.map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      className="rounded border border-line bg-canvas px-2 py-0.5 text-[12px] font-medium text-ink hover:bg-white"
                      onClick={() => insertVariable(variable.key)}
                      title={variable.label}
                    >
                      {`{{${variable.key}}}`}
                    </button>
                  ))}
                </div>
                <Textarea
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  onSelect={(e) => {
                    const target = e.currentTarget;
                    setCursor({ start: target.selectionStart, end: target.selectionEnd });
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    setCursor({ start: target.selectionStart, end: target.selectionEnd });
                  }}
                  onKeyUp={(e) => {
                    const target = e.currentTarget;
                    setCursor({ start: target.selectionStart, end: target.selectionEnd });
                  }}
                  placeholder="Sayın {{adSoyad}}, ..."
                />
              </FormField>
              <div className="rounded-[10px] border border-line bg-canvas/50 p-3">
                <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">
                  Örnek önizleme
                </p>
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink">
                  {samplePreview || "Şablon içeriği girildiğinde örnek metin burada görünür."}
                </p>
              </div>
            </>
          )}

          {formError ? <p className="text-[13px] text-danger">{formError}</p> : null}
        </div>
      </FormModal>
    </div>
  );
}
