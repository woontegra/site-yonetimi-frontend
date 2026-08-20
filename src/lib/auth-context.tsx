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
import { fetchPreviewSession } from "@/lib/buildings-api";
import { readSession, writeSession, type SessionUser } from "@/lib/session";

type AuthContextValue = {
  ready: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser>(fallbackUser);
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const hydrate = useCallback(async () => {
    try {
      const session = await fetchPreviewSession();
      const nextUser: SessionUser = {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        tenantId: session.user.tenants?.[0]?.id,
        tenantName: session.user.tenants?.[0]?.name,
      };
      writeSession({ token: session.token, user: nextUser });
      setUser(nextUser);
      setToken(session.token);
      setTenantId(nextUser.tenantId ?? null);
    } catch {
      const existing = readSession();
      if (existing?.token && existing.user.tenantId) {
        setUser(existing.user);
        setToken(existing.token);
        setTenantId(existing.user.tenantId);
      } else {
        setUser(fallbackUser);
        setToken(null);
        setTenantId(null);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo(
    () => ({ ready, user, token, tenantId }),
    [ready, user, token, tenantId],
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
