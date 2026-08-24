export function mapLoginError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Bağlantı kurulamadı. Lütfen tekrar deneyin.";
  }
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|network|bağlanılamadı|timeout/i.test(message)) {
    return "Bağlantı kurulamadı. Lütfen tekrar deneyin.";
  }
  if (/etkinleştir/i.test(message)) {
    return "Hesabınız henüz etkinleştirilmemiş.";
  }
  return "E-posta veya şifre hatalı.";
}
