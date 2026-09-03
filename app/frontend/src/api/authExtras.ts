import { getToken } from "@/src/api/client";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

export type MicrosoftAuthConfig = {
  enabled: boolean;
  client_id?: string | null;
  tenant: string;
};

async function authReq(path: string, opts: RequestInit = {}) {
  if (!BASE) throw new Error("UniPool API is not configured");
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const error: any = new Error(data?.detail || res.statusText || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const authExtrasApi = {
  microsoftConfig: (): Promise<MicrosoftAuthConfig> => authReq("/auth/microsoft/config"),
  microsoftSignIn: (idToken: string, nonce: string) => authReq("/auth/microsoft", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken, nonce }),
  }),
  completeOnboarding: () => authReq("/auth/onboarding/complete", { method: "POST" }),
};
