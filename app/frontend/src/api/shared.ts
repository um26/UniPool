import { getToken } from "@/src/api/client";

const SHARED_BASE = process.env.EXPO_PUBLIC_UNIPOOL_SHARED_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-shared";

async function sharedRequest(path: string, options: RequestInit = {}) {
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

export const sharedApi = {
  health: () => sharedRequest("/health"),
  sendMessage: (to_user_id: string, text: string, pool_id?: string) => sharedRequest("/messages", { method: "POST", body: JSON.stringify({ to_user_id, text, pool_id }) }),
  getThread: (otherUserId: string) => sharedRequest(`/messages/${encodeURIComponent(otherUserId)}`),
  listConversations: () => sharedRequest("/messages/conversations"),
  sendTyping: (to_user_id: string) => sharedRequest("/messages/typing", { method: "POST", body: JSON.stringify({ to_user_id }) }),
  getTyping: (otherUserId: string) => sharedRequest(`/messages/typing/${encodeURIComponent(otherUserId)}`),
  getPresence: (userId: string) => sharedRequest(`/users/${encodeURIComponent(userId)}/presence`),
  ensureTripChat: (poolId: string) => sharedRequest(`/messages/trip/ensure/${encodeURIComponent(poolId)}`, { method: "POST" }),
  getGroupThread: (conversationId: string) => sharedRequest(`/messages/group/${encodeURIComponent(conversationId)}`),
  sendGroupMessage: (conversationId: string, text: string) => sharedRequest(`/messages/group/${encodeURIComponent(conversationId)}`, { method: "POST", body: JSON.stringify({ text }) }),
};

export { SHARED_BASE };
