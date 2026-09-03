"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { refreshAccessTokenSingleFlight } from "@/lib/auth-refresh";
import {
  isAccessTokenExpired,
  readSession,
  subscribeSession,
  writeSession,
  type SessionUser,
} from "@/lib/session";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  ready: boolean;
  status: AuthStatus;
  user: SessionUser;
  token: string | null;
  tenantId: string | null;
};

const fallbackUser: SessionUser = {
  id: "preview",
  email: "yonetici@site.com",
  fullName: "Yönetici",
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isPublicAuthPath(path: string): boolean {
  return path.startsWith("/giris") || path.startsWith("/login") || path.startsWith("/aktivasyon");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<SessionUser>(fallbackUser);
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const applySession = useCallback(() => {
    const session = readSession();
    if (session?.token && session.user.id !== "preview") {
      setUser(session.user);
      setToken(session.token);
      setTenantId(session.user.tenantId ?? null);
      setStatus("authenticated");
      return true;
    }
    setUser(fallbackUser);
    setToken(null);
    setTenantId(null);
    setStatus("unauthenticated");
    return false;
  }, []);

  const hydrate = useCallback(async () => {
    setStatus("checking");
    try {
      if (typeof window === "undefined") {
        setStatus("unauthenticated");
        return;
      }

      const path = window.location.pathname;
      const existing = readSession();

      if (isPublicAuthPath(path)) {
        if (existing?.token && existing.user.id !== "preview") {
          setUser(existing.user);
          setToken(existing.token);
          setTenantId(existing.user.tenantId ?? null);
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
        return;
      }

      if (!existing?.token || existing.user.id === "preview") {
        setStatus("unauthenticated");
        return;
      }

      setUser(existing.user);
      setToken(existing.token);
      setTenantId(existing.user.tenantId ?? null);

      if (isAccessTokenExpired(existing.token)) {
        const refreshed = await refreshAccessTokenSingleFlight();
        if (refreshed.ok) {
          applySession();
          return;
        }
        if (refreshed.reason === "network" || refreshed.reason === "server") {
          // Geçici hata: mevcut access ile devam etmeyi dene (kısa süre).
          setStatus("authenticated");
          return;
        }
        setStatus("unauthenticated");
        return;
      }

      setStatus("authenticated");
    } catch {
      applySession();
    }
  }, [applySession]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    return subscribeSession(() => {
      const session = readSession();
      if (session?.token && session.user.id !== "preview") {
        setUser(session.user);
        setToken(session.token);
        setTenantId(session.user.tenantId ?? null);
        setStatus("authenticated");
      } else if (status !== "checking") {
        setUser(fallbackUser);
        setToken(null);
        setTenantId(null);
        setStatus("unauthenticated");
      }
    });
  }, [status]);

  const value = useMemo(
    () => ({
      ready: status !== "checking",
      status,
      user,
      token,
      tenantId,
    }),
    [status, user, token, tenantId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }
  return context;
}

/** Geliştirme önizleme oturumu — production /app bootstrap'ta kullanılmaz. */
export function persistDevPreviewSession(session: {
  token: string;
  refreshToken?: string;
  user: SessionUser;
}): void {
  writeSession(session);
}
