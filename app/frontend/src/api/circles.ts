import { getToken } from "@/src/api/client";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

async function request(path: string, options: RequestInit = {}) {
  if (!BASE) throw new Error("UniPool API is not configured");
  const token = await getToken();
  const response = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.detail || response.statusText || `Request failed (${response.status})`);
  return data;
}

export const circlesApi = {
  dashboard: () => request("/expense-dashboard"),
  list: () => request("/expense-groups"),
  get: (groupId: string) => request(`/expense-groups/${groupId}`),
  create: (body: any) => request("/expense-groups", { method: "POST", body: JSON.stringify(body) }),
  join: (invite_code: string) => request("/expense-groups/join", { method: "POST", body: JSON.stringify({ invite_code }) }),
  addMember: (groupId: string, user_id: string) => request(`/expense-groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ user_id }) }),
  addExpense: (groupId: string, body: any) => request(`/expense-groups/${groupId}/expenses`, { method: "POST", body: JSON.stringify(body) }),
  deleteExpense: (groupId: string, expenseId: string) => request(`/expense-groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" }),
  settle: (groupId: string, body: any) => request(`/expense-groups/${groupId}/settlements`, { method: "POST", body: JSON.stringify(body) }),
};
