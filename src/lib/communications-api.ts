import { apiRequest } from "@/lib/http";

export type MessageChannel = "WHATSAPP" | "SMS";
export type MessageRelationType = "TENANT" | "OWNER";
export type MessageStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "CANCELLED";

export type MessageTemplateWhatsAppSummary = {
  id: string;
  name: string;
  language: string;
  status: string;
  isStale: boolean;
  bodyVariableCount: number;
  sendable: boolean;
};

export type MessageTemplate = {
  id: string;
  name: string;
  channel: MessageChannel;
  body: string;
  whatsAppTemplateId: string | null;
  whatsAppParameterMapping: Record<string, string> | null;
  whatsAppTemplate: MessageTemplateWhatsAppSummary | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageTemplatePayload = {
  name: string;
  channel: MessageChannel;
  body: string;
  isActive?: boolean;
  whatsAppTemplateId?: string | null;
  whatsAppParameterMapping?: Record<string, string> | null;
};

export type DebtReminderRecipient = {
  personId: string;
  personName: string;
  phone: string | null;
  normalizedPhone: string | null;
  hasPhone: boolean;
  relationType: MessageRelationType;
  buildingId: string;
  buildingName: string;
  apartmentId: string;
  apartmentNumber: string;
  openDebtCount: number;
  totalRemainingAmount: string;
  oldestDueDate: string;
  debtDescription: string;
  previewText: string;
};

export type DebtReminderPreview = {
  channel: MessageChannel;
  siteName: string;
  templateId: string | null;
  recipients: DebtReminderRecipient[];
  summary: {
    recipientCount: number;
    withPhoneCount: number;
    withoutPhoneCount: number;
    totalRemainingAmount: string;
  };
};

export type DebtReminderPreviewParams = {
  channel?: MessageChannel;
  relationTypes?: MessageRelationType[];
  buildingId?: string;
  overdueOnly?: boolean;
  search?: string;
  templateId?: string;
};

export type DebtReminderSendPayload = {
  channel: MessageChannel;
  templateId: string;
  relationTypes: MessageRelationType[];
  buildingId?: string | null;
  overdueOnly?: boolean;
  recipients: Array<{ personId: string; apartmentId: string }>;
};

export type CommunicationMessage = {
  id: string;
  channel: MessageChannel;
  toPhone: string;
  body: string;
  status: MessageStatus;
  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  batchId: string | null;
  person: { id: string; fullName: string } | null;
  apartment: {
    id: string;
    number: string;
    building: { id: string; name: string };
  } | null;
  isMock: boolean;
};

export type CommunicationBatch = {
  id: string;
  channel: MessageChannel;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
  isMock?: boolean;
};

export type DebtReminderSendResult = {
  batch: CommunicationBatch & { isMock: boolean };
  messages: CommunicationMessage[];
  summary: {
    preparedCount: number;
    sentCount: number;
    failedCount: number;
  };
};

export type CommunicationMessageListParams = {
  channel?: MessageChannel;
  status?: MessageStatus;
  batchId?: string;
  page?: number;
  perPage?: number;
};

export type CommunicationMessageListResponse = {
  items: CommunicationMessage[];
  page: number;
  perPage: number;
  total: number;
};

export type IntegrationChannelStatus = {
  connected: boolean;
  provider?: string;
  label: string;
  isMock?: boolean;
  note?: string;
  status?: "READY" | "UNCONFIGURED" | "ERROR" | "INACTIVE" | string;
};

export type IntegrationsStatus = {
  whatsapp: IntegrationChannelStatus;
  sms: IntegrationChannelStatus;
  bank: IntegrationChannelStatus;
  email: IntegrationChannelStatus;
};

type Auth = { token: string; tenantId: string; siteId?: string | null };

export const MESSAGE_CHANNEL_LABELS: Record<MessageChannel, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  PENDING: "Bekliyor",
  SENT: "Gönderildi",
  DELIVERED: "Teslim Edildi",
  READ: "Okundu",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

export const MESSAGE_TEMPLATE_VARIABLES = [
  { key: "adSoyad", label: "Ad Soyad", sample: "Ayşe Yılmaz" },
  { key: "siteAdi", label: "Site Adı", sample: "Güneş Sitesi" },
  { key: "binaAdi", label: "Bina Adı", sample: "A Blok" },
  { key: "daireNo", label: "Daire No", sample: "12" },
  { key: "borcTutari", label: "Borç Tutarı", sample: "1.250,00 ₺" },
  { key: "vadeTarihi", label: "Vade Tarihi", sample: "15.03.2026" },
  { key: "borcAciklamasi", label: "Borç Açıklaması", sample: "Mart aidatı" },
] as const;

export function listMessageTemplates(
  auth: Auth,
  params: { channel?: MessageChannel; isActive?: boolean } = {},
) {
  const query = new URLSearchParams();
  if (params.channel) query.set("channel", params.channel);
  if (params.isActive !== undefined) query.set("isActive", String(params.isActive));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: MessageTemplate[] }>(
    `/api/communications/message-templates${suffix}`,
    auth,
  );
}

export function createMessageTemplate(auth: Auth, payload: MessageTemplatePayload) {
  return apiRequest<{ template: MessageTemplate }>("/api/communications/message-templates", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMessageTemplate(auth: Auth, id: string, payload: MessageTemplatePayload) {
  return apiRequest<{ template: MessageTemplate }>(`/api/communications/message-templates/${id}`, {
    ...auth,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function activateMessageTemplate(auth: Auth, id: string, isActive: boolean) {
  return apiRequest<{ template: MessageTemplate }>(
    `/api/communications/message-templates/${id}/activate`,
    {
      ...auth,
      method: "POST",
      body: JSON.stringify({ isActive }),
    },
  );
}

export function deleteMessageTemplate(auth: Auth, id: string) {
  return apiRequest<{ ok: boolean }>(`/api/communications/message-templates/${id}`, {
    ...auth,
    method: "DELETE",
  });
}

export function previewDebtReminders(auth: Auth, params: DebtReminderPreviewParams = {}) {
  const query = new URLSearchParams();
  if (params.channel) query.set("channel", params.channel);
  if (params.relationTypes?.length) query.set("relationTypes", params.relationTypes.join(","));
  if (params.buildingId) query.set("buildingId", params.buildingId);
  if (params.overdueOnly !== undefined) query.set("overdueOnly", String(params.overdueOnly));
  if (params.search) query.set("search", params.search);
  if (params.templateId) query.set("templateId", params.templateId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<DebtReminderPreview>(
    `/api/communications/debt-reminders/preview${suffix}`,
    auth,
  );
}

export function sendDebtReminders(
  auth: Auth,
  payload: DebtReminderSendPayload,
  idempotencyKey: string,
) {
  return apiRequest<DebtReminderSendResult>("/api/communications/debt-reminders/send", {
    ...auth,
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function listCommunicationMessages(auth: Auth, params: CommunicationMessageListParams = {}) {
  const query = new URLSearchParams();
  if (params.channel) query.set("channel", params.channel);
  if (params.status) query.set("status", params.status);
  if (params.batchId) query.set("batchId", params.batchId);
  if (params.page) query.set("page", String(params.page));
  if (params.perPage) query.set("perPage", String(params.perPage));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<CommunicationMessageListResponse>(
    `/api/communications/messages${suffix}`,
    auth,
  );
}

export function listCommunicationBatches(auth: Auth) {
  return apiRequest<{ items: CommunicationBatch[] }>("/api/communications/batches", auth);
}

export function getIntegrationsStatus(auth: Auth) {
  return apiRequest<IntegrationsStatus>("/api/communications/integrations/status", auth);
}

/** Ayarlar ekranı için örnek değişkenlerle şablon önizlemesi (gönderimde kullanılmaz). */
export function previewTemplateBodySample(body: string): string {
  return body.replace(/\{\{\s*([a-zA-ZğüşıöçĞÜŞİÖÇ]+)\s*\}\}/g, (_match, key: string) => {
    const found = MESSAGE_TEMPLATE_VARIABLES.find((item) => item.key === key);
    return found?.sample ?? "";
  });
}
