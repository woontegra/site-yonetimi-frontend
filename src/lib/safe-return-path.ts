/** Yalnızca uygulama içi dönüş yolu. Açık yönlendirme engellenir. */
export function safeAppReturnPath(value: string | null | undefined): string {
  if (!value) return "/app";
  if (!value.startsWith("/app")) return "/app";
  if (value.startsWith("//") || value.includes("://")) return "/app";
  if (value.includes("\\")) return "/app";
  return value;
}
