import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "unipool.session_token";

export async function getToken(): Promise<string | null> {
  return (await storage.secureGet(TOKEN_KEY, null)) as string | null;
}

export async function setToken(token: string | null) {
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

async function req(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err: any = new Error(data?.detail || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  googleSignIn: (id_token: string) => req("/auth/google", { method: "POST", body: JSON.stringify({ id_token }) }),
  me: () => req("/auth/me"),
  logout: () => req("/auth/logout", { method: "POST" }),
  updateProfile: (patch: any) => req("/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  listPools: () => req("/pools"),
  myPools: () => req("/pools/mine"),
  myMatches: () => req("/pools/matches"),
  createPool: (body: any) => req("/pools", { method: "POST", body: JSON.stringify(body) }),
  closePool: (id: string) => req(`/pools/${id}/close`, { method: "PATCH" }),
  reopenPool: (id: string) => req(`/pools/${id}/reopen`, { method: "PATCH" }),
  deletePool: (id: string) => req(`/pools/${id}`, { method: "DELETE" }),
  trivia: () => req("/trivia"),
  adminStats: () => req("/admin/stats"),
  adminPools: () => req("/admin/pools"),
  adminDeletePool: (id: string) => req(`/admin/pools/${id}`, { method: "DELETE" }),
};
