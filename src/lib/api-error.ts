import { ApiError } from "@/lib/http-core";

export type NormalizedApiError = {
  status: number;
  code?: string;
  title: string;
  userMessage: string;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
  requestId?: string;
  /** Caller already showed a toast — skip global handlers. */
  handled?: boolean;
};

const CODE_MESSAGES: Record<string, { title: string; message: string }> = {
  AUTH_SESSION_EXPIRED: {
    title: "Oturum sona erdi",
    message: "Oturumunuz sona erdi. Lütfen yeniden giriş yapın.",
  },
  FORBIDDEN: {
    title: "Yetki yok",
    message: "Bu işlemi yapmaya yetkiniz bulunmuyor.",
  },
  RECORD_NOT_FOUND: {
    title: "Kayıt bulunamadı",
    message: "İstenen kayıt bulunamadı veya artık mevcut değil.",
  },
  VALIDATION_ERROR: {
    title: "Eksik bilgiler",
    message: "Lütfen işaretli alanları kontrol edin.",
  },
  DUPLICATE_DUES: {
    title: "Aidat zaten var",
    message: "Bu dönem için aidat tanımı zaten oluşturulmuş.",
  },
  DUES_PERIOD_EXISTS: {
    title: "Aidat zaten var",
    message: "Bu dönem için aidat tanımı zaten oluşturulmuş.",
  },
  HAS_DEPENDENCIES: {
    title: "Bağlı kayıtlar var",
    message: "Bu kayıt bağlı veriler nedeniyle silinemez.",
  },
  PAYMENT_ALREADY_CANCELLED: {
    title: "Tahsilat iptal",
    message: "Bu tahsilat zaten iptal edilmiş.",
  },
  BANK_IMPORT_DUPLICATE: {
    title: "Mükerrer ekstre",
    message: "Bu banka hareketleri daha önce içe aktarılmış.",
  },
  PDF_PARSE_FAILED: {
    title: "PDF okunamadı",
    message: "PDF okundu ancak banka hareketleri belirlenemedi.",
  },
  TENANT_DELETE_PROTECTED: {
    title: "Silme engellendi",
    message: "Bu tenant korumalı olduğu için silinemez.",
  },
  INTERNAL_ERROR: {
    title: "Sunucu hatası",
    message: "İşlem sırasında beklenmeyen bir hata oluştu. Lütfen yeniden deneyin.",
  },
  ABORTED: {
    title: "İşlem iptal",
    message: "İşlem iptal edildi.",
  },
};

function looksLikeTechnicalNoise(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("prisma") ||
    m.includes("axios") ||
    m.includes("failed to fetch") ||
    m.includes("econnrefused") ||
    m.includes("stack") ||
    m.includes("at object.") ||
    m.includes("sql") ||
    m.includes("jwt") ||
    m.includes("bearer ") ||
    /\/api\//.test(message) ||
    /[A-Z]:\\/.test(message) ||
    message.length > 280
  );
}

function fieldErrorsFromDetails(details: unknown): Record<string, string> | undefined {
  if (!details || typeof details !== "object") return undefined;
  const record = details as Record<string, unknown>;
  if (record.fieldErrors && typeof record.fieldErrors === "object") {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(record.fieldErrors as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
      else if (Array.isArray(value) && typeof value[0] === "string") out[key] = value[0];
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

const PREFER_SERVER_MESSAGE = new Set([
  "DUES_PERIOD_EXISTS",
  "DUPLICATE_DUES",
  "HAS_DEPENDENCIES",
  "BANK_IMPORT_DUPLICATE",
  "PDF_PARSE_FAILED",
  "VALIDATION_ERROR",
  "PAYMENT_ALREADY_CANCELLED",
  "TENANT_DELETE_PROTECTED",
]);

export function normalizeApiError(
  error: unknown,
  fallbackMessage = "İşlem tamamlanamadı.",
): NormalizedApiError {
  if (error instanceof ApiError) {
    const byCode = error.code ? CODE_MESSAGES[error.code] : undefined;
    let title = byCode?.title ?? "İşlem başarısız";
    let userMessage = byCode?.message ?? fallbackMessage;

    if (
      error.message &&
      !looksLikeTechnicalNoise(error.message) &&
      (!byCode || (error.code != null && PREFER_SERVER_MESSAGE.has(error.code)))
    ) {
      userMessage = error.message;
    }

    if (!byCode) {
      if (error.status === 401) {
        title = "Oturum sona erdi";
        userMessage = "Oturumunuz sona erdi. Lütfen yeniden giriş yapın.";
      } else if (error.status === 403) {
        title = "Yetki yok";
        userMessage = "Bu işlemi yapmaya yetkiniz bulunmuyor.";
      } else if (error.status === 404) {
        title = "Kayıt bulunamadı";
        userMessage = "İstenen kayıt bulunamadı veya artık mevcut değil.";
      } else if (error.status === 409) {
        title = "Çakışma";
        userMessage = looksLikeTechnicalNoise(error.message)
          ? "Bu işlem mevcut kayıtlarla çakışıyor."
          : error.message;
      } else if (error.status === 422 || error.status === 400) {
        title = "Eksik bilgiler";
        userMessage = looksLikeTechnicalNoise(error.message)
          ? "Lütfen formdaki eksik alanları kontrol edin."
          : error.message;
      } else if (error.status === 0) {
        title = "Bağlantı hatası";
        userMessage = looksLikeTechnicalNoise(error.message)
          ? "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip yeniden deneyin."
          : error.message;
      } else if (error.status >= 500) {
        title = "Sunucu hatası";
        userMessage = "İşlem sırasında beklenmeyen bir hata oluştu. Lütfen yeniden deneyin.";
      } else if (looksLikeTechnicalNoise(userMessage)) {
        userMessage = fallbackMessage;
      }
    } else if (looksLikeTechnicalNoise(userMessage)) {
      userMessage = byCode.message;
    } else if (error.status >= 500 && error.code === "INTERNAL_ERROR") {
      userMessage = byCode.message;
    }

    const details = error.details as { requestId?: string } | undefined;
    return {
      status: error.status,
      code: error.code,
      title,
      userMessage,
      fieldErrors: fieldErrorsFromDetails(error.details),
      retryable: error.status === 0 || error.status >= 500 || error.status === 408 || error.status === 429,
      requestId: details?.requestId,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      status: 0,
      code: "ABORTED",
      title: "İşlem iptal",
      userMessage: "İşlem iptal edildi.",
      retryable: false,
    };
  }

  if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
    return {
      status: 0,
      title: "Zaman aşımı",
      userMessage: "İşlem beklenen sürede tamamlanamadı.",
      retryable: true,
    };
  }

  return {
    status: 0,
    title: "İşlem başarısız",
    userMessage: fallbackMessage,
    retryable: true,
  };
}

/** Mark an error as already toasted so callers/global handlers skip duplicates. */
export function markErrorHandled(error: unknown): void {
  if (error && typeof error === "object") {
    (error as { handled?: boolean }).handled = true;
  }
}

export function isErrorHandled(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { handled?: boolean }).handled);
}
