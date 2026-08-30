import { getToken } from "@/src/api/client";

const CIRCLE_PLUS_BASE = process.env.EXPO_PUBLIC_UNIPOOL_CIRCLE_PLUS_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-circle-plus";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${CIRCLE_PLUS_BASE}${path}`, {
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

export type RecurringExpense = {
  id: string;
  circle_id: string;
  description: string;
  amount_paise: number;
  category?: string;
  participant_ids?: string[];
  frequency: "weekly" | "monthly";
  next_due_at: string;
  paid_by: string;
  notes?: string | null;
  active?: boolean;
};

export type CirclePoll = {
  id: string;
  circle_id: string;
  question: string;
  options: string[];
  counts: number[];
  my_vote?: number | null;
  closes_at?: string | null;
};

export const circlePlusApi = {
  health: async () => {
    const response = await fetch(`${CIRCLE_PLUS_BASE}/health`, { cache: "no-store" });
    return response.ok ? response.json() : null;
  },
  recurring: (circleId: string) => request(`/circles/${encodeURIComponent(circleId)}/recurring`) as Promise<RecurringExpense[]>,
  addRecurring: (circleId: string, body: any) => request(`/circles/${encodeURIComponent(circleId)}/recurring`, { method: "POST", body: JSON.stringify(body) }) as Promise<RecurringExpense>,
  deleteRecurring: (circleId: string, id: string) => request(`/circles/${encodeURIComponent(circleId)}/recurring/${encodeURIComponent(id)}`, { method: "DELETE" }),
  expenseComments: (circleId: string, expenseId: string) => request(`/circles/${encodeURIComponent(circleId)}/expenses/${encodeURIComponent(expenseId)}/comments`),
  addExpenseComment: (circleId: string, expenseId: string, body: string) => request(`/circles/${encodeURIComponent(circleId)}/expenses/${encodeURIComponent(expenseId)}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  remind: (circleId: string, userId: string, message?: string) => request(`/circles/${encodeURIComponent(circleId)}/remind`, { method: "POST", body: JSON.stringify({ user_id: userId, message }) }),
  ensureChat: (circleId: string) => request(`/circles/${encodeURIComponent(circleId)}/chat`, { method: "POST" }),
  polls: (circleId: string) => request(`/circles/${encodeURIComponent(circleId)}/polls`) as Promise<CirclePoll[]>,
  addPoll: (circleId: string, question: string, options: string[]) => request(`/circles/${encodeURIComponent(circleId)}/polls`, { method: "POST", body: JSON.stringify({ question, options }) }) as Promise<CirclePoll>,
  votePoll: (pollId: string, optionIndex: number) => request(`/circle-polls/${encodeURIComponent(pollId)}/vote`, { method: "POST", body: JSON.stringify({ option_index: optionIndex }) }),
  rides: (circleId: string) => request(`/circles/${encodeURIComponent(circleId)}/rides`),
  addRide: (circleId: string, poolId: string) => request(`/circles/${encodeURIComponent(circleId)}/rides`, { method: "POST", body: JSON.stringify({ pool_id: poolId }) }),
  deleteRide: (circleId: string, poolId: string) => request(`/circles/${encodeURIComponent(circleId)}/rides/${encodeURIComponent(poolId)}`, { method: "DELETE" }),
};

export { CIRCLE_PLUS_BASE };
