import { getToken } from "@/src/api/client";

const SHARED_BASE = process.env.EXPO_PUBLIC_UNIPOOL_SHARED_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-shared";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${SHARED_BASE}${path}`, {
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
    error.data = data;
    throw error;
  }
  return data;
}

async function capability() {
  try {
    const response = await fetch(`${SHARED_BASE}/health`, { cache: "no-store" });
    const data = response.ok ? await response.json() : null;
    return {
      available: Boolean(response.ok && data?.circles_version),
      version: data?.circles_version || null,
      backend_version: data?.version || null,
      status: data?.status || (response.ok ? "ok" : "degraded"),
    };
  } catch {
    return { available: false, version: null, status: "offline" };
  }
}

export const circlesApi = {
  capability,
  dashboard: () => request("/expense-dashboard"),
  list: () => request("/expense-groups"),
  get: (groupId: string) => request(`/expense-groups/${groupId}`),
  create: (body: any) => request("/expense-groups", { method: "POST", body: JSON.stringify(body) }),
  join: (invite_code: string) => request("/expense-groups/join", { method: "POST", body: JSON.stringify({ invite_code }) }),
  addMember: (groupId: string, user_id: string) => request(`/expense-groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ user_id }) }),
  addExpense: (groupId: string, body: any) => request(`/expense-groups/${groupId}/expenses`, { method: "POST", body: JSON.stringify(body) }),
  deleteExpense: (groupId: string, expenseId: string) => request(`/expense-groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" }),
  settle: (groupId: string, body: any) => request(`/expense-groups/${groupId}/settlements`, { method: "POST", body: JSON.stringify(body) }),

  personalDashboard: (month?: string) => request(`/personal-finance/dashboard${month ? `?month=${encodeURIComponent(month)}` : ""}`),
  personalTransactions: (month?: string, limit = 100) => request(`/personal-transactions?limit=${limit}${month ? `&month=${encodeURIComponent(month)}` : ""}`),
  addPersonalTransaction: (body: any) => request("/personal-transactions", { method: "POST", body: JSON.stringify(body) }),
  updatePersonalTransaction: (transactionId: string, body: any) => request(`/personal-transactions/${transactionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePersonalTransaction: (transactionId: string) => request(`/personal-transactions/${transactionId}`, { method: "DELETE" }),
};
