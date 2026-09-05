const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

type LoginResponse = {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    isPlatformAdmin?: boolean;
    tenants?: Array<{
      id?: string;
      name: string;
      role?: string;
      permissions?: string[];
      allSites?: boolean;
      siteIds?: string[] | null;
    }>;
  };
};

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let message = "Giriş yapılamadı.";
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* boş */
    }
    throw new Error(message);
  }

  return (await response.json()) as LoginResponse;
}

export async function apiPeekActivation(token: string): Promise<{
  valid: boolean;
  reason?: string;
  fullName?: string;
  emailMasked?: string;
  expiresAt?: string;
}> {
  if (!token) return { valid: false, reason: "invalid" };
  // Token query string’de taşınmaz — yalnız POST body.
  const response = await fetch(`${API_URL}/api/auth/activation/peek`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { valid: false, reason: "invalid" };
  }
  return (await response.json()) as {
    valid: boolean;
    reason?: string;
    fullName?: string;
    emailMasked?: string;
    expiresAt?: string;
  };
}

export async function apiActivate(token: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ token, password }),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Hesap etkinleştirilemedi.";
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* boş */
    }
    throw new Error(message);
  }
}

export async function apiLogout(token: string): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}
