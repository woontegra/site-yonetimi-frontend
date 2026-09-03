"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listActiveSites, type SiteSummary } from "@/lib/sites-api";

const STORAGE_KEY_PREFIX = "sy_active_site";
const COOKIE_NAME = "sy_site_id";

/** Bootstrap tamamlanana kadar: loading. Sonra: noSites | ready. */
export type SiteBootstrapStatus = "loading" | "noSites" | "ready";

type ActiveSiteContextValue = {
  /** @deprecated Prefer `status`; true when status is noSites or ready. */
  ready: boolean;
  status: SiteBootstrapStatus;
  bootstrapError: string | null;
  sites: SiteSummary[];
  siteId: string | null;
  site: SiteSummary | null;
  hasSites: boolean;
  setSiteId: (id: string, options?: { syncRoute?: boolean }) => void;
  refreshSites: (options?: { preferSiteId?: string | null }) => Promise<void>;
};

const ActiveSiteContext = createContext<ActiveSiteContextValue | null>(null);

function storageKeyForTenant(tenantId: string | null): string {
  return tenantId ? `${STORAGE_KEY_PREFIX}:${tenantId}` : STORAGE_KEY_PREFIX;
}

function readStoredSiteId(tenantId: string | null): string | null {
  if (typeof window === "undefined") return null;
  const key = storageKeyForTenant(tenantId);
  try {
    const fromStorage = window.localStorage.getItem(key);
    if (fromStorage?.trim()) return fromStorage.trim();
    // Eski tek-key formatından oku (bir kez migrasyon)
    if (tenantId) {
      const legacy = window.localStorage.getItem(STORAGE_KEY_PREFIX);
      if (legacy?.trim()) return legacy.trim();
    }
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const fromCookie = match ? decodeURIComponent(match[1]).trim() : "";
  return fromCookie || null;
}

function persistSiteId(tenantId: string | null, id: string | null) {
  if (typeof window === "undefined") return;
  const key = storageKeyForTenant(tenantId);
  if (!id) {
    try {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(STORAGE_KEY_PREFIX);
    } catch {
      /* ignore */
    }
    document.cookie = `${COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  try {
    window.localStorage.setItem(key, id);
    // Eski key'i temizle — yanlış tenant'a sızmasın
    window.localStorage.removeItem(STORAGE_KEY_PREFIX);
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; SameSite=Lax; Max-Age=31536000`;
}

function resolveActiveSiteId(
  sites: SiteSummary[],
  tenantId: string | null,
  preferSiteId?: string | null,
): string | null {
  if (sites.length === 0) return null;
  if (preferSiteId && sites.some((s) => s.id === preferSiteId)) {
    return preferSiteId;
  }
  const stored = readStoredSiteId(tenantId);
  if (stored && sites.some((s) => s.id === stored)) {
    return stored;
  }
  return sites[0].id;
}

function normalizeAppPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Header’dan site değişince URL’i aktif siteyle hizala.
 * Site detayı → yeni sitenin detayı. Kayıt detayı → ilgili liste.
 */
function nextPathForSiteChange(pathname: string, newSiteId: string): string | null {
  const path = normalizeAppPath(pathname);

  const siteDetail = path.match(/^\/app\/siteler\/([^/]+)$/);
  if (siteDetail) {
    if (siteDetail[1] === newSiteId) return null;
    return `/app/siteler/${newSiteId}`;
  }

  const rules: Array<{ re: RegExp; to: string }> = [
    { re: /^\/app\/binalar\/[^/]+$/, to: "/app/binalar" },
    { re: /^\/app\/daireler\/[^/]+$/, to: "/app/daireler" },
    { re: /^\/app\/kisiler\/[^/]+$/, to: "/app/kisiler" },
    { re: /^\/app\/muhasebe\/borclar\/[^/]+$/, to: "/app/muhasebe/borclar" },
    { re: /^\/app\/muhasebe\/tahsilatlar\/[^/]+$/, to: "/app/muhasebe/tahsilatlar" },
    { re: /^\/app\/muhasebe\/giderler\/[^/]+$/, to: "/app/muhasebe" },
    { re: /^\/app\/muhasebe\/aidatlar\/[^/]+$/, to: "/app/muhasebe/aidatlar" },
    { re: /^\/app\/muhasebe\/bankalar\/[^/]+$/, to: "/app/muhasebe/bankalar" },
    { re: /^\/app\/misafirler\/ziyaretler\/[^/]+$/, to: "/app/misafirler" },
    { re: /^\/app\/misafirler\/[^/]+$/, to: "/app/misafirler" },
    { re: /^\/app\/calisanlar\/[^/]+$/, to: "/app/calisanlar" },
    { re: /^\/app\/tedarikciler\/[^/]+$/, to: "/app/tedarikciler" },
    { re: /^\/app\/demirbaslar\/[^/]+$/, to: "/app/demirbaslar" },
    { re: /^\/app\/duyurular\/[^/]+$/, to: "/app/duyurular" },
    { re: /^\/app\/bilgi-oneri\/[^/]+$/, to: "/app/bilgi-oneri" },
  ];
  for (const rule of rules) {
    if (rule.re.test(path)) return rule.to;
  }
  return null;
}

export function ActiveSiteProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, status: authStatus, token, tenantId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const pendingRouteRef = useRef<string | null>(null);

  const [status, setStatus] = useState<SiteBootstrapStatus>("loading");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [siteId, setSiteIdState] = useState<string | null>(null);
  const siteIdRef = useRef<string | null>(null);
  siteIdRef.current = siteId;

  const refreshSites = useCallback(async (options?: { preferSiteId?: string | null }) => {
    if (authStatus !== "authenticated" || !token || !tenantId) {
      setSites([]);
      setSiteIdState(null);
      setBootstrapError(null);
      setStatus("loading");
      return;
    }

    setBootstrapError(null);
    // Soft refresh: önceki ready/noSites'ı koru — onboarding flash yok.
    setStatus((prev) => (prev === "ready" || prev === "noSites" ? prev : "loading"));

    try {
      const result = await listActiveSites({ token, tenantId });
      const nextSites = result.items ?? [];
      const nextId = resolveActiveSiteId(nextSites, tenantId, options?.preferSiteId);

      setSites(nextSites);
      setSiteIdState(nextId);
      persistSiteId(tenantId, nextId);
      setStatus(nextSites.length === 0 ? "noSites" : "ready");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Aktif siteler yüklenemedi.";
      // Auth yönlendirmesi zaten http katmanında; burada yalnızca geçici ağ hatalarını göster.
      if (/sona erdi|geçersiz|süresi dolmuş/i.test(message)) {
        setBootstrapError(null);
        setStatus((prev) => (prev === "ready" || prev === "noSites" ? prev : "loading"));
        return;
      }
      setBootstrapError(message);
      setStatus((prev) => (prev === "ready" || prev === "noSites" ? prev : "loading"));
    }
  }, [authStatus, token, tenantId]);

  useEffect(() => {
    if (!authReady || authStatus !== "authenticated") return;
    setStatus("loading");
    setSites([]);
    setSiteIdState(null);
    setBootstrapError(null);
    const match = normalizeAppPath(pathnameRef.current).match(/^\/app\/siteler\/([^/]+)$/);
    void refreshSites({ preferSiteId: match?.[1] ?? null });
  }, [authReady, authStatus, refreshSites]);

  const setSiteId = useCallback(
    (id: string, options?: { syncRoute?: boolean }) => {
      if (!id || id === siteIdRef.current) return;
      if (!sites.some((s) => s.id === id)) return;

      const syncRoute = options?.syncRoute !== false;
      setSiteIdState(id);
      persistSiteId(tenantId, id);

      if (!syncRoute) return;

      const target = nextPathForSiteChange(pathnameRef.current, id);
      if (target && target !== normalizeAppPath(pathnameRef.current)) {
        pendingRouteRef.current = target;
        router.replace(target);
      }
    },
    [sites, tenantId, router],
  );

  useEffect(() => {
    const path = normalizeAppPath(pathname);
    if (pendingRouteRef.current) {
      if (path === pendingRouteRef.current) {
        pendingRouteRef.current = null;
      }
      return;
    }

    const match = path.match(/^\/app\/siteler\/([^/]+)$/);
    if (!match) return;
    const urlSiteId = match[1];
    if (!urlSiteId || urlSiteId === siteIdRef.current) return;
    if (!sites.some((s) => s.id === urlSiteId)) return;

    setSiteIdState(urlSiteId);
    persistSiteId(tenantId, urlSiteId);
  }, [pathname, sites, tenantId]);

  const site = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId],
  );

  const ready = status === "noSites" || status === "ready";
  const hasSites = sites.length > 0 && status === "ready";

  const value = useMemo(
    () => ({
      ready,
      status,
      bootstrapError,
      sites,
      siteId: status === "ready" ? siteId : null,
      site: status === "ready" ? site : null,
      hasSites,
      setSiteId,
      refreshSites,
    }),
    [ready, status, bootstrapError, sites, siteId, site, hasSites, setSiteId, refreshSites],
  );

  return <ActiveSiteContext.Provider value={value}>{children}</ActiveSiteContext.Provider>;
}

export function useActiveSite(): ActiveSiteContextValue {
  const context = useContext(ActiveSiteContext);
  if (!context) {
    throw new Error("useActiveSite, ActiveSiteProvider içinde kullanılmalıdır.");
  }
  return context;
}

/** Operasyonel API çağrıları için token + tenant + site. */
export function useApiAuth(options?: { requireSite?: boolean }) {
  const { ready: authReady, token, tenantId } = useAuth();
  const { status, siteId } = useActiveSite();
  const requireSite = options?.requireSite !== false;

  return useMemo(() => {
    if (!authReady || !token || !tenantId) return null;
    if (requireSite) {
      // Active site hazır olmadan site-scoped istek yok (X-Site-Id undefined engeli).
      if (status !== "ready" || !siteId) return null;
      return { token, tenantId, siteId };
    }
    return { token, tenantId, siteId: status === "ready" ? siteId : null };
  }, [authReady, token, tenantId, status, siteId, requireSite]);
}

/** Platform admin API çağrıları. Tenant/site header göndermez. */
export function useAdminAuth() {
  const { ready, token, user } = useAuth();
  return useMemo(() => {
    if (!ready || !token || !user.isPlatformAdmin) return null;
    return { token };
  }, [ready, token, user.isPlatformAdmin]);
}
