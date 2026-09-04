"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, MessageCircle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Table, TableElement, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useCloseFormOnSiteChange } from "@/hooks/useCloseFormOnSiteChange";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useApiAuth } from "@/lib/active-site-context";
import { listBuildings, type Building } from "@/lib/buildings-api";
import { cn } from "@/lib/cn";
import {
  getIntegrationsStatus,
  listMessageTemplates,
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_STATUS_LABELS,
  previewDebtReminders,
  sendDebtReminders,
  type DebtReminderPreview,
  type DebtReminderRecipient,
  type DebtReminderSendResult,
  type IntegrationsStatus,
  type MessageChannel,
  type MessageRelationType,
  type MessageTemplate,
} from "@/lib/communications-api";
import { ApiError } from "@/lib/http";
import {
  DEFAULT_MESSAGE_CHANNEL,
  hasMultipleUserFacingMessageChannels,
  MESSAGE_CHANNEL_HINTS,
  USER_FACING_MESSAGE_CHANNELS,
} from "@/lib/messaging-channels";
import { formatDateTr, formatMoney } from "@/lib/money";
import { RELATION_TYPE_LABELS } from "@/lib/person-constants";

const CHANNEL_ICONS = {
  WHATSAPP: MessageCircle,
  SMS: MessageSquare,
} as const;

type Step = "channel" | "recipients" | "result";

type DebtReminderSendModalProps = {
  open: boolean;
  onClose: () => void;
};

function recipientKey(row: Pick<DebtReminderRecipient, "personId" | "apartmentId">) {
  return `${row.personId}:${row.apartmentId}`;
}

export function DebtReminderSendModal({ open, onClose }: DebtReminderSendModalProps) {
  const auth = useApiAuth({ requireSite: true });
  const { showToast, toastError } = useToast();
  useCloseFormOnSiteChange(open, onClose);

  const [step, setStep] = useState<Step>(
    hasMultipleUserFacingMessageChannels() ? "channel" : "recipients",
  );
  const [channel, setChannel] = useState<MessageChannel>(DEFAULT_MESSAGE_CHANNEL);
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [includeTenant, setIncludeTenant] = useState(true);
  const [includeOwner, setIncludeOwner] = useState(true);
  const [buildingId, setBuildingId] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [preview, setPreview] = useState<DebtReminderPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const autoSelectRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DebtReminderSendResult | null>(null);
  const [previewRow, setPreviewRow] = useState<DebtReminderRecipient | null>(null);

  const resetState = useCallback(() => {
    setStep(hasMultipleUserFacingMessageChannels() ? "channel" : "recipients");
    setChannel(DEFAULT_MESSAGE_CHANNEL);
    setTemplateId("");
    setIncludeTenant(true);
    setIncludeOwner(true);
    setBuildingId("");
    setOverdueOnly(false);
    setSearch("");
    setPreview(null);
    setSelected(new Set());
    autoSelectRef.current = true;
    setLoading(false);
    setSending(false);
    setError("");
    setResult(null);
    setPreviewRow(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    if (!auth) return;
    void (async () => {
      try {
        const [status, buildingResult] = await Promise.all([
          getIntegrationsStatus(auth),
          listBuildings(auth, { status: "aktif", perPage: 100 }),
        ]);
        setIntegrations(status);
        setBuildings(buildingResult.items);
      } catch (err) {
        toastError(err, "Entegrasyon durumu alınamadı.");
      }
    })();
  }, [open, auth, resetState, showToast]);

  const relationTypes = useMemo(() => {
    const types: MessageRelationType[] = [];
    if (includeTenant) types.push("TENANT");
    if (includeOwner) types.push("OWNER");
    return types;
  }, [includeTenant, includeOwner]);

  const loadTemplatesAndPreview = useCallback(async () => {
    if (!auth || relationTypes.length === 0) {
      setPreview(null);
      setTemplates([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [templateResult, previewResult] = await Promise.all([
        listMessageTemplates(auth, { channel, isActive: true }),
        previewDebtReminders(auth, {
          channel,
          relationTypes,
          buildingId: buildingId || undefined,
          overdueOnly,
          search: debouncedSearch || undefined,
          templateId: templateId || undefined,
        }),
      ]);
      const filteredItems =
        channel === "WHATSAPP" &&
        integrations?.whatsapp &&
        !integrations.whatsapp.isMock
          ? templateResult.items.filter((t) => t.whatsAppTemplate?.sendable === true)
          : templateResult.items;
      setTemplates(filteredItems);
      const nextTemplateId =
        templateId && filteredItems.some((t) => t.id === templateId)
          ? templateId
          : previewResult.templateId &&
              filteredItems.some((t) => t.id === previewResult.templateId)
            ? previewResult.templateId
            : filteredItems[0]?.id ?? "";

      const finalPreview =
        nextTemplateId && nextTemplateId !== (previewResult.templateId ?? "")
          ? await previewDebtReminders(auth, {
              channel,
              relationTypes,
              buildingId: buildingId || undefined,
              overdueOnly,
              search: debouncedSearch || undefined,
              templateId: nextTemplateId,
            })
          : previewResult;

      if (nextTemplateId !== templateId) {
        setTemplateId(nextTemplateId);
      }

      setPreview(finalPreview);
      const validKeys = finalPreview.recipients.filter((r) => r.hasPhone).map(recipientKey);
      setSelected((prev) => {
        if (autoSelectRef.current) {
          autoSelectRef.current = false;
          return new Set(validKeys);
        }
        const valid = new Set(validKeys);
        const next = new Set<string>();
        for (const key of prev) {
          if (valid.has(key)) next.add(key);
        }
        return next;
      });
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError ? err.message : "Önizleme yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth, channel, relationTypes, buildingId, overdueOnly, debouncedSearch, templateId, integrations]);

  useEffect(() => {
    if (!open || step !== "recipients") return;
    void loadTemplatesAndPreview();
  }, [open, step, loadTemplatesAndPreview]);

  const selectableRecipients = useMemo(
    () => preview?.recipients.filter((r) => r.hasPhone) ?? [],
    [preview],
  );

  const allSelectableSelected =
    selectableRecipients.length > 0 &&
    selectableRecipients.every((r) => selected.has(recipientKey(r)));

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableRecipients.map(recipientKey)));
  }

  function toggleRow(row: DebtReminderRecipient, checked: boolean) {
    if (!row.hasPhone) return;
    const key = recipientKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function handleSend() {
    if (!auth || !templateId || selected.size === 0 || sending) return;
    setSending(true);
    setError("");
    try {
      const recipients = (preview?.recipients ?? [])
        .filter((r) => selected.has(recipientKey(r)))
        .map((r) => ({ personId: r.personId, apartmentId: r.apartmentId }));
      const sendResult = await sendDebtReminders(
        auth,
        {
          channel,
          templateId,
          relationTypes,
          buildingId: buildingId || null,
          overdueOnly,
          recipients,
        },
        crypto.randomUUID(),
      );
      setResult(sendResult);
      setStep("result");
      showToast(
        sendResult.batch.isMock
          ? "Test gönderimi tamamlandı."
          : "Borç hatırlatmaları gönderildi.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderim tamamlanamadı.");
    } finally {
      setSending(false);
    }
  }

  function channelBadge(ch: MessageChannel) {
    const status = ch === "WHATSAPP" ? integrations?.whatsapp : integrations?.sms;
    if (!status) return <Badge>Yükleniyor</Badge>;
    return (
      <Badge tone={status.connected ? "warning" : "neutral"}>
        {status.label || "Bağlı değil"}
      </Badge>
    );
  }

  const title =
    step === "channel"
      ? "Kanal Seçin"
      : step === "recipients"
        ? "Alıcıları Seçin"
        : "Gönderim Sonucu";

  const description =
    step === "channel"
      ? "Borç hatırlatmasını hangi kanaldan göndermek istediğinizi seçin."
      : step === "recipients"
        ? "Filtreleyin, şablon seçin ve gönderilecek kişileri işaretleyin."
        : "Toplu gönderimin özeti aşağıdadır.";

  const failedMessages = result?.messages.filter((m) => m.status === "FAILED") ?? [];

  const whatsappNeedsConnection =
    channel === "WHATSAPP" &&
    integrations?.whatsapp &&
    !integrations.whatsapp.isMock &&
    !integrations.whatsapp.connected;

  const whatsappNeedsApprovedTemplates =
    channel === "WHATSAPP" &&
    integrations?.whatsapp &&
    !integrations.whatsapp.isMock &&
    !loading &&
    templates.length === 0;

  return (
    <>
      <FormModal
        open={open}
        title={title}
        description={description}
        icon={MessageCircle}
        size="lg"
        className="sm:max-w-[860px]"
        onClose={() => (sending ? undefined : onClose())}
        footer={
          step === "channel" ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                Vazgeç
              </Button>
              <Button
                disabled={whatsappNeedsConnection}
                onClick={() => {
                  autoSelectRef.current = true;
                  setSelected(new Set());
                  setStep("recipients");
                }}
              >
                Devam
              </Button>
            </>
          ) : step === "recipients" ? (
            <>
              <Button
                variant="secondary"
                disabled={sending}
                onClick={() => {
                  if (hasMultipleUserFacingMessageChannels()) {
                    setStep("channel");
                    setError("");
                    return;
                  }
                  onClose();
                }}
              >
                {hasMultipleUserFacingMessageChannels() ? "Geri" : "Vazgeç"}
              </Button>
              <Button
                disabled={
                  sending ||
                  selected.size === 0 ||
                  !templateId ||
                  relationTypes.length === 0 ||
                  whatsappNeedsConnection
                }
                onClick={() => void handleSend()}
              >
                {sending ? "Gönderiliyor…" : "Gönder"}
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Kapat</Button>
          )
        }
      >
        {step === "channel" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {USER_FACING_MESSAGE_CHANNELS.map((id) => {
              const Icon = CHANNEL_ICONS[id];
              const active = channel === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChannel(id)}
                  className={cn(
                    "flex flex-col gap-3 rounded-[10px] border px-4 py-4 text-left transition-colors",
                    active
                      ? "border-brand bg-brand-soft/40 ring-2 ring-brand/20"
                      : "border-line bg-white hover:bg-canvas",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {channelBadge(id)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{MESSAGE_CHANNEL_LABELS[id]}</p>
                    <p className="mt-1 text-[13px] text-muted">{MESSAGE_CHANNEL_HINTS[id]}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {(step === "channel" || !hasMultipleUserFacingMessageChannels()) && whatsappNeedsConnection ? (
          <p className="mt-3 text-[13px] text-danger">
            WhatsApp bağlantısı kurulmamış.{" "}
            <Link href="/app/entegrasyonlar" className="font-medium text-brand hover:underline">
              Entegrasyonlar
            </Link>{" "}
            sayfasından bağlantı kurun.
          </p>
        ) : null}

        {step === "recipients" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{MESSAGE_CHANNEL_LABELS[channel]}</Badge>
              <Badge>
                {preview?.summary.recipientCount ?? 0} alıcı
              </Badge>
              <Badge tone="warning">
                {formatMoney(preview?.summary.totalRemainingAmount ?? 0)}
              </Badge>
              {preview ? (
                <Badge>
                  Telefonlu: {preview.summary.withPhoneCount} / Yok:{" "}
                  {preview.summary.withoutPhoneCount}
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-[10px] border border-line bg-canvas/40 px-3 py-3">
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
                  İlişki tipi
                </p>
                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={includeTenant}
                    onChange={(e) => setIncludeTenant(e.target.checked)}
                    className="size-4 rounded border-line"
                  />
                  Kiracı
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={includeOwner}
                    onChange={(e) => setIncludeOwner(e.target.checked)}
                    className="size-4 rounded border-line"
                  />
                  Mülk Sahibi
                </label>
                {relationTypes.length === 0 ? (
                  <p className="text-[12px] text-danger">En az bir ilişki tipi seçin.</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={(e) => setOverdueOnly(e.target.checked)}
                    className="size-4 rounded border-line"
                  />
                  Yalnızca gecikmiş borçlar
                </label>
                <Select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  aria-label="Bina"
                >
                  <option value="">Tüm binalar</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Kişi, daire veya telefon ara…"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-[13px] font-medium text-ink">Şablon</label>
                <Select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={templates.length === 0}
                >
                  {templates.length === 0 ? (
                    <option value="">Aktif şablon yok</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  )}
                </Select>
              </div>
              <Link
                href="/app/ayarlar"
                className="text-[13px] font-medium text-brand hover:underline sm:mb-2"
              >
                Şablonları Yönet
              </Link>
            </div>

            {whatsappNeedsApprovedTemplates ? (
              <p className="text-[13px] text-muted">
                Gönderim için onaylanmış WhatsApp şablonu bulunmuyor.{" "}
                <Link href="/app/whatsapp-sablonlari" className="font-medium text-brand hover:underline">
                  WhatsApp Şablonlarına Git
                </Link>
              </p>
            ) : null}

            {error ? <p className="text-[13px] text-danger">{error}</p> : null}
            {loading ? <p className="text-[13px] text-muted">Önizleme yükleniyor…</p> : null}

            <Table>
              <TableElement>
                <THead>
                  <TR>
                    <TH className="w-10">
                      <input
                        type="checkbox"
                        checked={allSelectableSelected}
                        disabled={selectableRecipients.length === 0}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        aria-label="Telefonu olanları seç"
                      />
                    </TH>
                    <TH>Kişi</TH>
                    <TH>Bina</TH>
                    <TH>Daire</TH>
                    <TH>Borç</TH>
                    <TH>Vade</TH>
                    <TH>Telefon</TH>
                    <TH>Önizle</TH>
                    <TH>Seçim</TH>
                  </TR>
                </THead>
                <TBody>
                  {(preview?.recipients ?? []).length === 0 && !loading ? (
                    <TR>
                      <TD colSpan={9} className="text-muted">
                        Seçilen filtrelere uygun alıcı bulunamadı.
                      </TD>
                    </TR>
                  ) : (
                    (preview?.recipients ?? []).map((row) => {
                      const key = recipientKey(row);
                      const checked = selected.has(key);
                      return (
                        <TR key={key} className={!row.hasPhone ? "opacity-70" : undefined}>
                          <TD>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!row.hasPhone}
                              onChange={(e) => toggleRow(row, e.target.checked)}
                              aria-label={`${row.personName} seç`}
                            />
                          </TD>
                          <TD>
                            <div>
                              <p className="font-medium">{row.personName}</p>
                              <p className="text-[12px] text-muted">
                                {RELATION_TYPE_LABELS[row.relationType]}
                              </p>
                            </div>
                          </TD>
                          <TD>{row.buildingName}</TD>
                          <TD>{row.apartmentNumber}</TD>
                          <TD>{formatMoney(row.totalRemainingAmount)}</TD>
                          <TD>{formatDateTr(row.oldestDueDate)}</TD>
                          <TD>
                            {row.hasPhone ? (
                              row.phone || row.normalizedPhone
                            ) : (
                              <span className="text-danger">Telefon yok</span>
                            )}
                          </TD>
                          <TD>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPreviewRow(row)}
                              aria-label="Mesaj önizle"
                            >
                              <Eye className="size-3.5" aria-hidden />
                              Önizle
                            </Button>
                          </TD>
                          <TD>
                            {row.hasPhone ? (checked ? "Seçili" : "—") : "—"}
                          </TD>
                        </TR>
                      );
                    })
                  )}
                </TBody>
              </TableElement>
            </Table>
            <p className="text-[12px] text-muted">
              {selected.size} kişi seçildi. Telefonu olmayanlar gönderime dahil edilemez.
            </p>
          </div>
        ) : null}

        {step === "result" && result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{MESSAGE_CHANNEL_LABELS[result.batch.channel]}</Badge>
              {result.batch.isMock ? <Badge tone="warning">Test gönderimi</Badge> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[10px] border border-line px-3 py-3">
                <p className="text-[12px] text-muted">Hazırlanan</p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {result.summary.preparedCount}
                </p>
              </div>
              <div className="rounded-[10px] border border-line px-3 py-3">
                <p className="text-[12px] text-muted">Gönderilen</p>
                <p className="mt-1 text-lg font-semibold text-success">
                  {result.summary.sentCount}
                </p>
              </div>
              <div className="rounded-[10px] border border-line px-3 py-3">
                <p className="text-[12px] text-muted">Başarısız</p>
                <p className="mt-1 text-lg font-semibold text-danger">
                  {result.summary.failedCount}
                </p>
              </div>
            </div>

            {failedMessages.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Başarısız mesajlar</h3>
                <Table>
                  <TableElement>
                    <THead>
                      <TR>
                        <TH>Kişi</TH>
                        <TH>Telefon</TH>
                        <TH>Durum</TH>
                        <TH>Hata</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {failedMessages.map((msg) => (
                        <TR key={msg.id}>
                          <TD>{msg.person?.fullName ?? "—"}</TD>
                          <TD>{msg.toPhone}</TD>
                          <TD>
                            <Badge tone="danger">{MESSAGE_STATUS_LABELS[msg.status]}</Badge>
                          </TD>
                          <TD className="max-w-[220px] truncate whitespace-normal text-[13px] text-muted">
                            {msg.errorMessage ?? "—"}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </TableElement>
                </Table>
              </div>
            ) : (
              <p className="text-[13px] text-muted">Tüm mesajlar başarıyla işlendi.</p>
            )}
          </div>
        ) : null}
      </FormModal>

      <Modal
        open={Boolean(previewRow)}
        title="Mesaj önizleme"
        description={
          previewRow
            ? `${previewRow.personName} · ${previewRow.buildingName} / ${previewRow.apartmentNumber}`
            : undefined
        }
        variant="detail"
        onClose={() => setPreviewRow(null)}
        footer={
          <Button variant="secondary" onClick={() => setPreviewRow(null)}>
            Kapat
          </Button>
        }
      >
        <pre className="whitespace-pre-wrap rounded-[10px] border border-line bg-canvas/50 p-3 text-[13px] leading-6 text-ink">
          {previewRow?.previewText || "—"}
        </pre>
      </Modal>
    </>
  );
}
