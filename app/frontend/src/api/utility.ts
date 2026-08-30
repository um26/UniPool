import { getToken } from "@/src/api/client";

const BASE = "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-utility";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error: any = new Error(data?.detail || response.statusText || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const POLICY_VERSION = "2026-08-30";

export const utilityApi = {
  health: async () => {
    const response = await fetch(`${BASE}/health`, { cache: "no-store" });
    return response.ok ? response.json() : null;
  },
  searchDirectory: (q: string) => request(`/directory?q=${encodeURIComponent(q)}`),
  inviteCircleByEmail: (circle_id: string, email: string) => request("/circle-invites", { method: "POST", body: JSON.stringify({ circle_id, email }) }),
  sendCircleInvite: (circle_id: string, email: string) => request("/circle-invites", { method: "POST", body: JSON.stringify({ circle_id, email, send_direct: true }) }),
  relations: () => request("/relations"),
  restrictUser: (userId: string) => request(`/relations/${encodeURIComponent(userId)}/restrict`, { method: "POST" }),
  unrestrictUser: (userId: string) => request(`/relations/${encodeURIComponent(userId)}/restrict`, { method: "DELETE" }),
  recordPolicyConsent: (source = "signup") => request("/policy-consent", { method: "POST", body: JSON.stringify({ terms_version: POLICY_VERSION, privacy_version: POLICY_VERSION, source }) }),
  policyConsent: () => request("/policy-consent"),
};
