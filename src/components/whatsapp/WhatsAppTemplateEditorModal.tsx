"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useApiAuth } from "@/lib/active-site-context";
import { MESSAGE_TEMPLATE_VARIABLES } from "@/lib/communications-api";
import { ApiError } from "@/lib/http";
import {
  countBodyVariables,
  createCustomWhatsAppTemplate,
  normalizeMetaTemplateName,
  submitWhatsAppTemplateToMeta,
  updateWhatsAppTemplateDraft,
  WHATSAPP_TEMPLATE_CATEGORY_LABELS,
  WHATSAPP_TEMPLATE_STATUS_LABELS,
  type WhatsAppTemplateMineItem,
} from "@/lib/whatsapp-api";

type EditorForm = {
  displayName: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  parameterMapping: Record<string, string>;
};

type WhatsAppTemplateEditorModalProps = {
  open: boolean;
  onClose: () => void;
  item?: WhatsAppTemplateMineItem | null;
  readOnly?: boolean;
  onSaved?: (item: WhatsAppTemplateMineItem) => void;
};

const emptyForm = (): EditorForm => ({
  displayName: "",
  name: "",
  language: "tr",
  category: "UTILITY",
  bodyText: "",
  parameterMapping: {},
});

function itemToForm(item: WhatsAppTemplateMineItem): EditorForm {
  return {
    displayName: item.displayName ?? "",
    name: item.name ?? "",
    language: item.language ?? "tr",
    category: item.category ?? "UTILITY",
    bodyText: item.bodyText ?? "",
    parameterMapping: { ...(item.parameterMapping ?? {}) },
  };
}

function previewBodyWithMapping(bodyText: string, mapping: Record<string, string>): string {
  return bodyText.replace(/\{\{(\d+)\}\}/g, (_match, slot: string) => {
    const key = mapping[slot];
    if (!key) return `{{${slot}}}`;
    const variable = MESSAGE_TEMPLATE_VARIABLES.find((item) => item.key === key);
    return variable?.sample ?? `{{${slot}}}`;
  });
}

function syncMappingWithBody(bodyText: string, mapping: Record<string, string>): Record<string, string> {
  const count = countBodyVariables(bodyText);
  const next: Record<string, string> = {};
  for (let i = 1; i <= count; i += 1) {
    const key = String(i);
    next[key] = mapping[key] ?? "";
  }
  return next;
}

export function WhatsAppTemplateEditorModal({
  open,
  onClose,
  item,
  readOnly = false,
  onSaved,
}: WhatsAppTemplateEditorModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { showToast } = useToast();

  const [form, setForm] = useState<EditorForm>(emptyForm());
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [variablePick, setVariablePick] = useState<string>(
    MESSAGE_TEMPLATE_VARIABLES[0]?.key ?? "adSoyad",
  );

  const isDraft = !item || item.status === "DRAFT";
  const locked = readOnly || !isDraft;
  const isCreate = !item;

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setNameTouched(false);
    if (item) {
      setForm(itemToForm(item));
    } else {
      setForm(emptyForm());
    }
  }, [open, item]);

  const normalizedNameHint = useMemo(
    () => normalizeMetaTemplateName(form.name || form.displayName),
    [form.displayName, form.name],
  );

  const previewText = useMemo(
    () => previewBodyWithMapping(form.bodyText, form.parameterMapping),
    [form.bodyText, form.parameterMapping],
  );

  const variableCount = useMemo(() => countBodyVariables(form.bodyText), [form.bodyText]);

  const insertVariable = useCallback(() => {
    if (locked) return;
    const nextSlot = variableCount + 1;
    const token = `{{${nextSlot}}}`;
    setForm((prev) => {
      const bodyText = prev.bodyText ? `${prev.bodyText} ${token}` : token;
      const parameterMapping = syncMappingWithBody(bodyText, {
        ...prev.parameterMapping,
        [String(nextSlot)]: variablePick,
      });
      return { ...prev, bodyText, parameterMapping };
    });
  }, [locked, variableCount, variablePick]);

  function validateForm(): string | null {
    if (!form.displayName.trim()) return "Görünen ad zorunludur.";
    if (!form.name.trim()) return "Meta şablon adı zorunludur.";
    if (!form.bodyText.trim()) return "Şablon metni zorunludur.";
    if (variableCount > 0) {
      for (let i = 1; i <= variableCount; i += 1) {
        const slot = String(i);
        const field = form.parameterMapping[slot];
        if (!field || !MESSAGE_TEMPLATE_VARIABLES.some((v) => v.key === field)) {
          return `{{${slot}}} için geçerli bir alan seçin.`;
        }
      }
    }
    return null;
  }

  function buildPayload() {
    return {
      displayName: form.displayName.trim(),
      name: normalizeMetaTemplateName(form.name.trim()),
      language: form.language.trim(),
      category: form.category.trim(),
      bodyText: form.bodyText.trim(),
      parameterMapping: syncMappingWithBody(form.bodyText, form.parameterMapping),
    };
  }

  async function handleSaveDraft() {
    if (!auth || pending || locked) return;
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setPending(true);
    setFormError("");
    try {
      const payload = buildPayload();
      const result = isCreate
        ? await createCustomWhatsAppTemplate(auth, payload)
        : await updateWhatsAppTemplateDraft(auth, item!.id, payload);
      showToast(isCreate ? "Taslak şablon oluşturuldu." : "Taslak kaydedildi.");
      onSaved?.(result.item);
      onClose();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Taslak kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmitToMeta() {
    if (!auth || pending || locked || !item) return;
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setPending(true);
    setFormError("");
    try {
      const payload = buildPayload();
      await updateWhatsAppTemplateDraft(auth, item.id, payload);
      const result = await submitWhatsAppTemplateToMeta(auth, item.id);
      showToast(result.message);
      onSaved?.(result.item);
      onClose();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Meta'ya gönderilemedi.");
    } finally {
      setPending(false);
    }
  }

  const title = isCreate
    ? "Kendi Şablonunu Oluştur"
    : locked
      ? "Şablon Detayı"
      : "Şablonu Düzenle";

  const description = isCreate
    ? "Meta onay sürecine göndermeden önce taslağı kaydedebilirsiniz."
    : item
      ? `${WHATSAPP_TEMPLATE_STATUS_LABELS[item.status]} · ${item.source === "LIBRARY" ? "Kütüphane" : item.source === "CUSTOM" ? "Özel" : "Meta senkron"}`
      : undefined;

  return (
    <FormModal
      open={open}
      title={title}
      description={description}
      icon={MessageCircle}
      size="lg"
      className="sm:max-w-[760px]"
      onClose={() => (pending ? undefined : onClose())}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            İptal
          </Button>
          {!locked ? (
            <>
              <Button variant="secondary" disabled={pending} onClick={() => void handleSaveDraft()}>
                {pending ? "Kaydediliyor…" : "Taslak Kaydet"}
              </Button>
              {!isCreate ? (
                <Button disabled={pending} onClick={() => void handleSubmitToMeta()}>
                  {pending ? "Gönderiliyor…" : "Meta'ya Gönder"}
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {item?.status === "REJECTED" && item.rejectionReason ? (
          <div className="rounded-[10px] border border-danger/30 bg-red-50 px-3 py-2.5">
            <p className="text-[12px] font-medium uppercase tracking-wide text-danger">Red nedeni</p>
            <p className="mt-1 text-[13px] text-ink">{item.rejectionReason}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Görünen ad" required>
            <Input
              value={form.displayName}
              onChange={(e) => {
                const displayName = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  displayName,
                  name: nameTouched ? prev.name : normalizeMetaTemplateName(displayName),
                }));
              }}
              disabled={locked}
              placeholder="Aidat Hatırlatma"
              data-modal-autofocus={!locked}
            />
          </FormField>
          <FormField
            label="Meta şablon adı"
            required
            hint={`Meta'da kullanılacak ad: ${normalizedNameHint}`}
          >
            <Input
              value={form.name}
              onChange={(e) => {
                setNameTouched(true);
                setForm((prev) => ({ ...prev, name: e.target.value }));
              }}
              disabled={locked}
              placeholder="aidat_hatirlatma"
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Dil">
            <Select
              value={form.language}
              onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
              disabled={locked}
            >
              <option value="tr">Türkçe (tr)</option>
              <option value="en">English (en)</option>
            </Select>
          </FormField>
          <FormField label="Kategori">
            <Select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              disabled={locked}
            >
              {Object.entries(WHATSAPP_TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Şablon metni" required hint="Meta değişkenleri {{1}}, {{2}} formatında olmalıdır.">
          {!locked ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Select
                value={variablePick}
                onChange={(e) => setVariablePick(e.target.value)}
                className="max-w-[200px]"
                aria-label="Eklenecek değişken"
              >
                {MESSAGE_TEMPLATE_VARIABLES.map((variable) => (
                  <option key={variable.key} value={variable.key}>
                    {variable.label}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" variant="secondary" onClick={insertVariable}>
                <Plus className="size-3.5" aria-hidden />
                Değişken Ekle
              </Button>
            </div>
          ) : null}
          <Textarea
            rows={5}
            value={form.bodyText}
            onChange={(e) => {
              const bodyText = e.target.value;
              setForm((prev) => ({
                ...prev,
                bodyText,
                parameterMapping: syncMappingWithBody(bodyText, prev.parameterMapping),
              }));
            }}
            disabled={locked}
            placeholder="Sayın {{1}}, ..."
          />
        </FormField>

        {variableCount > 0 ? (
          <div className="space-y-2 rounded-[10px] border border-line bg-canvas/40 p-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
              Değişken eşleştirme
            </p>
            {Array.from({ length: variableCount }, (_, index) => {
              const slot = String(index + 1);
              return (
                <div key={slot} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
                  <span className="text-[13px] font-medium text-ink">{`{{${slot}}}`}</span>
                  {locked ? (
                    <Badge>
                      {MESSAGE_TEMPLATE_VARIABLES.find(
                        (v) => v.key === form.parameterMapping[slot],
                      )?.label ?? form.parameterMapping[slot] ?? "—"}
                    </Badge>
                  ) : (
                    <Select
                      value={form.parameterMapping[slot] ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          parameterMapping: {
                            ...prev.parameterMapping,
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
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted">
            Önizleme
          </p>
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-[14px] rounded-tl-sm border border-line bg-white px-3 py-2.5 shadow-sm">
              <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink">
                {previewText || "Şablon metni girildiğinde önizleme burada görünür."}
              </p>
            </div>
          </div>
        </div>

        {formError ? <p className="text-[13px] text-danger">{formError}</p> : null}
      </div>
    </FormModal>
  );
}
