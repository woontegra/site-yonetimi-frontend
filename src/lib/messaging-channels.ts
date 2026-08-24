import type { MessageChannel } from "@/lib/communications-api";

/**
 * Kullanıcı arayüzünde SMS kanalını gösterir.
 * API tipleri, geçmiş kayıtlar ve backend enum’ları değişmez.
 * Yeniden açmak için `true` yapın.
 */
export const SMS_FEATURE_ENABLED = false;

export const DEFAULT_MESSAGE_CHANNEL: MessageChannel = "WHATSAPP";

export const USER_FACING_MESSAGE_CHANNELS: MessageChannel[] = SMS_FEATURE_ENABLED
  ? ["WHATSAPP", "SMS"]
  : ["WHATSAPP"];

export function isSmsFeatureEnabled(): boolean {
  return SMS_FEATURE_ENABLED;
}

export function isUserFacingMessageChannel(channel: MessageChannel): boolean {
  return USER_FACING_MESSAGE_CHANNELS.includes(channel);
}

export function hasMultipleUserFacingMessageChannels(): boolean {
  return USER_FACING_MESSAGE_CHANNELS.length > 1;
}

export const MESSAGE_CHANNEL_HINTS: Record<MessageChannel, string> = {
  WHATSAPP: "WhatsApp üzerinden bilgilendirme",
  SMS: "SMS ile kısa hatırlatma",
};
