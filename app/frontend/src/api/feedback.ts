import { getToken } from "@/src/api/client";

const FEEDBACK_BASE = process.env.EXPO_PUBLIC_UNIPOOL_FEEDBACK_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-feedback";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${FEEDBACK_BASE}${path}`, {
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

export type FeedbackSummary = { user_id: string; count: number; punctuality: number | null; coordination: number | null; behaviour: number | null; overall: number | null };

export const feedbackApi = {
  summary: (userId: string) => request(`/feedback/summary/${encodeURIComponent(userId)}`) as Promise<FeedbackSummary>,
  submit: (body: { pool_id: string; rated_user_id: string; punctuality: number; coordination: number; behaviour: number; note?: string }) => request("/feedback", { method: "POST", body: JSON.stringify(body) }),
};

export { FEEDBACK_BASE };
