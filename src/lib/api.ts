const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

type LoginResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenants?: Array<{ name: string }>;
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

export async function apiLogout(token: string): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}
