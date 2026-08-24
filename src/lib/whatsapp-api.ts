import { apiRequest } from "@/lib/http";



type Auth = { token: string; tenantId: string; siteId?: string | null };



export type WhatsAppConnectionStatus = "DISCONNECTED" | "CONNECTED" | "ERROR";



export type WhatsAppTemplateStatus =

  | "DRAFT"

  | "PENDING"

  | "APPROVED"

  | "REJECTED"

  | "PAUSED"

  | "DISABLED"

  | "UNKNOWN";



export type WhatsAppTemplateSource = "META_SYNC" | "LIBRARY" | "CUSTOM";



export type WhatsAppParameterField =

  | "adSoyad"

  | "siteAdi"

  | "binaAdi"

  | "daireNo"

  | "borcTutari"

  | "vadeTarihi"

  | "borcAciklamasi";



export type WhatsAppIntegration = {

  id: string;

  wabaId?: string;

  phoneNumberId?: string;

  businessPhone: string | null;

  displayPhoneNumber: string | null;

  verifiedName: string | null;

  accessTokenMasked?: string;

  apiVersion: string;

  isActive: boolean;

  connectionStatus: WhatsAppConnectionStatus;

  lastCheckedAt: string | null;

  lastError: string | null;

  createdAt: string;

  updatedAt: string;

};



export type WhatsAppTemplate = {

  id: string;

  metaTemplateId: string | null;

  name: string;

  language: string;

  category: string | null;

  status: WhatsAppTemplateStatus;

  isStale: boolean;

  lastSyncedAt: string;

  bodyVariableCount: number;

  sendable: boolean;

  hasHeaderVariables: boolean;

  hasDynamicUrlButtonVariables: boolean;

};



export type WhatsAppLibraryItem = {

  key: string;

  displayName: string;

  description: string;

  language: string;

  category: string;

  suggestedMetaName: string;

  bodyText: string;

  parameterMapping: Record<string, WhatsAppParameterField>;

  variableLabels: Record<string, string>;

};



export type WhatsAppTemplateMineItem = {

  id: string;

  displayName: string;

  name: string;

  language: string;

  category: string | null;

  status: WhatsAppTemplateStatus;

  statusLabel: string;

  source: WhatsAppTemplateSource;

  bodyText: string | null;

  parameterMapping: Record<string, string> | null;

  rejectionReason: string | null;

  submittedAt: string | null;

  lastSyncedAt: string;

  sendable: boolean;

  libraryKey: string | null;

  metaTemplateId: string | null;

  messageTemplateId: string | null;

  messageTemplateCount: number;

};



export type WhatsAppTemplateDraftPayload = {

  displayName: string;

  name?: string;

  language: string;

  category: string;

  bodyText: string;

  parameterMapping: Record<string, string>;

};



export const WHATSAPP_CONNECTION_STATUS_LABELS: Record<WhatsAppConnectionStatus, string> = {

  DISCONNECTED: "Bağlı Değil",

  CONNECTED: "Bağlı",

  ERROR: "Hata",

};



export const WHATSAPP_TEMPLATE_STATUS_LABELS: Record<WhatsAppTemplateStatus, string> = {

  DRAFT: "Taslak",

  PENDING: "İncelemede",

  APPROVED: "Onaylandı",

  REJECTED: "Reddedildi",

  PAUSED: "Duraklatıldı",

  DISABLED: "Devre Dışı",

  UNKNOWN: "Bilinmiyor",

};



export const WHATSAPP_TEMPLATE_CATEGORY_LABELS: Record<string, string> = {

  UTILITY: "Bilgilendirme",

  MARKETING: "Pazarlama",

  AUTHENTICATION: "Doğrulama",

};



const TR_CHAR_MAP: Record<string, string> = {

  ç: "c",

  Ç: "c",

  ğ: "g",

  Ğ: "g",

  ı: "i",

  İ: "i",

  ö: "o",

  Ö: "o",

  ş: "s",

  Ş: "s",

  ü: "u",

  Ü: "u",

};



export function normalizeMetaTemplateName(display: string): string {

  let normalized = display

    .trim()

    .split("")

    .map((char) => TR_CHAR_MAP[char] ?? char)

    .join("")

    .toLowerCase();

  normalized = normalized.replace(/[^a-z0-9]+/g, "_");

  normalized = normalized.replace(/^_+|_+$/g, "").replace(/_+/g, "_");

  if (!normalized) return "template";

  return normalized.slice(0, 512);

}



export function countBodyVariables(bodyText: string): number {

  const matches = bodyText.match(/\{\{\d+\}\}/g);

  if (!matches) return 0;

  const nums = matches.map((m) => Number(m.replace(/[{}]/g, "")));

  return Math.max(0, ...nums, 0);

}



export function getWhatsAppIntegration(auth: Auth) {

  return apiRequest<{ integration: WhatsAppIntegration | null }>(

    "/api/integrations/whatsapp",

    auth,

  );

}



export function connectWhatsApp(

  auth: Auth,

  payload: { wabaId: string; phoneNumberId: string; accessToken: string },

) {

  return apiRequest<{ integration: WhatsAppIntegration }>(

    "/api/integrations/whatsapp/connect",

    {

      ...auth,

      method: "POST",

      body: JSON.stringify(payload),

    },

  );

}



export function testWhatsAppConnection(auth: Auth) {

  return apiRequest<{ integration: WhatsAppIntegration }>("/api/integrations/whatsapp/test", {

    ...auth,

    method: "POST",

  });

}



export function disconnectWhatsApp(auth: Auth) {

  return apiRequest<{ ok: boolean }>("/api/integrations/whatsapp", {

    ...auth,

    method: "DELETE",

  });

}



export type WhatsAppTemplateListResponse = {

  items: WhatsAppTemplate[];

  syncedAt: string | null;

};



export function syncWhatsAppTemplates(auth: Auth) {

  return apiRequest<WhatsAppTemplateListResponse>(

    "/api/integrations/whatsapp/templates/sync",

    {

      ...auth,

      method: "POST",

    },

  );

}



export function listWhatsAppTemplates(

  auth: Auth,

  params: { status?: WhatsAppTemplateStatus; language?: string; search?: string } = {},

) {

  const query = new URLSearchParams();

  if (params.status) query.set("status", params.status);

  if (params.language) query.set("language", params.language);

  if (params.search) query.set("search", params.search);

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return apiRequest<WhatsAppTemplateListResponse>(

    `/api/integrations/whatsapp/templates${suffix}`,

    auth,

  );

}



export function listWhatsAppTemplateLibrary(auth: Auth) {

  return apiRequest<{ items: WhatsAppLibraryItem[] }>(

    "/api/integrations/whatsapp/templates/library",

    auth,

  );

}



export function listMyWhatsAppTemplates(auth: Auth) {

  return apiRequest<{ items: WhatsAppTemplateMineItem[] }>(

    "/api/integrations/whatsapp/templates/mine",

    auth,

  );

}



export function createWhatsAppTemplateFromLibrary(auth: Auth, libraryKey: string) {

  return apiRequest<{ item: WhatsAppTemplateMineItem }>(

    "/api/integrations/whatsapp/templates/from-library",

    {

      ...auth,

      method: "POST",

      body: JSON.stringify({ libraryKey }),

    },

  );

}



export function createCustomWhatsAppTemplate(auth: Auth, payload: WhatsAppTemplateDraftPayload) {

  return apiRequest<{ item: WhatsAppTemplateMineItem }>(

    "/api/integrations/whatsapp/templates/custom",

    {

      ...auth,

      method: "POST",

      body: JSON.stringify(payload),

    },

  );

}



export function updateWhatsAppTemplateDraft(

  auth: Auth,

  id: string,

  payload: Partial<WhatsAppTemplateDraftPayload>,

) {

  return apiRequest<{ item: WhatsAppTemplateMineItem }>(

    `/api/integrations/whatsapp/templates/${id}`,

    {

      ...auth,

      method: "PATCH",

      body: JSON.stringify(payload),

    },

  );

}



export function deleteWhatsAppTemplateDraft(auth: Auth, id: string) {

  return apiRequest<{ ok: boolean }>(`/api/integrations/whatsapp/templates/${id}`, {

    ...auth,

    method: "DELETE",

  });

}



export function submitWhatsAppTemplateToMeta(auth: Auth, id: string) {

  return apiRequest<{ item: WhatsAppTemplateMineItem; message: string }>(

    `/api/integrations/whatsapp/templates/${id}/submit`,

    {

      ...auth,

      method: "POST",

    },

  );

}



export function duplicateWhatsAppTemplate(auth: Auth, id: string) {

  return apiRequest<{ item: WhatsAppTemplateMineItem }>(

    `/api/integrations/whatsapp/templates/${id}/duplicate`,

    {

      ...auth,

      method: "POST",

    },

  );

}


