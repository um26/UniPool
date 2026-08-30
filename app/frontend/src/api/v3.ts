import { getToken } from "@/src/api/client";

const ROOT = "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1";

type Options = RequestInit & { body?: any };

async function edge(slug: string, path: string, options: Options = {}) {
  const token = await getToken();
  const init: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };
  if (options.body !== undefined && typeof options.body !== "string") init.body = JSON.stringify(options.body);
  const response = await fetch(`${ROOT}/${slug}${path}`, init);
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

export const peopleApi = {
  health: () => edge("unipool-people", "/health"),
  search: (q: string) => edge("unipool-people", `/search?q=${encodeURIComponent(q)}`),
  saved: () => edge("unipool-people", "/saved"),
  save: (userId: string) => edge("unipool-people", `/saved/${encodeURIComponent(userId)}`, { method: "POST" }),
  unsave: (userId: string) => edge("unipool-people", `/saved/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  trustedContacts: () => edge("unipool-people", "/trusted-contacts"),
  addTrustedContact: (body: { name: string; email?: string; phone?: string }) => edge("unipool-people", "/trusted-contacts", { method: "POST", body }),
  deleteTrustedContact: (id: string) => edge("unipool-people", `/trusted-contacts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  notifications: (limit = 50) => edge("unipool-people", `/notifications?limit=${limit}`),
  readNotification: (id: string) => edge("unipool-people", `/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  readAllNotifications: () => edge("unipool-people", "/notifications/read-all", { method: "POST" }),
  campusEvents: () => edge("unipool-people", "/campus-events"),
  campusHome: () => edge("unipool-people", "/campus-home"),
};

export const tripV3Api = {
  health: () => edge("unipool-trip", "/health"),
  routeWatches: () => edge("unipool-trip", "/route-watches"),
  saveRouteWatch: (body: any) => edge("unipool-trip", "/route-watches", { method: "POST", body }),
  deleteRouteWatch: (id: string) => edge("unipool-trip", `/route-watches/${encodeURIComponent(id)}`, { method: "DELETE" }),
  publishRoute: (body: any) => edge("unipool-trip", "/route-watches/publish", { method: "POST", body }),
  state: (poolId: string) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/state`),
  setStage: (poolId: string, stage: string) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/state`, { method: "PATCH", body: { stage } }),
  setFare: (poolId: string, amount_paise: number, note?: string) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/fare`, { method: "PATCH", body: { amount_paise, note } }),
  live: (poolId: string) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/live`),
  updateLive: (poolId: string, body: any) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/live`, { method: "POST", body }),
  stopLocation: (poolId: string) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/live`, { method: "DELETE" }),
  polls: (poolId: string) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/polls`),
  createPoll: (poolId: string, body: any) => edge("unipool-trip", `/trips/${encodeURIComponent(poolId)}/polls`, { method: "POST", body }),
  votePoll: (pollId: string, option_index: number) => edge("unipool-trip", `/polls/${encodeURIComponent(pollId)}/vote`, { method: "POST", body: { option_index } }),
};

export const routeAlertsApi = {
  health: () => edge("unipool-route-alerts", "/health"),
  sync: () => edge("unipool-route-alerts", "/sync", { method: "POST" }),
};

export const circlePlusApi = {
  health: () => edge("unipool-circle-plus", "/health"),
  recurring: (circleId: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/recurring`),
  createRecurring: (circleId: string, body: any) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/recurring`, { method: "POST", body }),
  deleteRecurring: (circleId: string, id: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/recurring/${encodeURIComponent(id)}`, { method: "DELETE" }),
  comments: (circleId: string, expenseId: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/expenses/${encodeURIComponent(expenseId)}/comments`),
  addComment: (circleId: string, expenseId: string, body: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/expenses/${encodeURIComponent(expenseId)}/comments`, { method: "POST", body: { body } }),
  remind: (circleId: string, user_id: string, message?: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/remind`, { method: "POST", body: { user_id, message } }),
  ensureChat: (circleId: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/chat`, { method: "POST" }),
  polls: (circleId: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/polls`),
  createPoll: (circleId: string, body: any) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/polls`, { method: "POST", body }),
  votePoll: (pollId: string, option_index: number) => edge("unipool-circle-plus", `/circle-polls/${encodeURIComponent(pollId)}/vote`, { method: "POST", body: { option_index } }),
  rides: (circleId: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/rides`),
  linkRide: (circleId: string, pool_id: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/rides`, { method: "POST", body: { pool_id } }),
  unlinkRide: (circleId: string, poolId: string) => edge("unipool-circle-plus", `/circles/${encodeURIComponent(circleId)}/rides/${encodeURIComponent(poolId)}`, { method: "DELETE" }),
};

export const gamesV3Api = {
  health: () => edge("unipool-games", "/health"),
  submitProgress: (game_key: string, score: number, completed = true) => edge("unipool-games", "/progress", { method: "POST", body: { game_key, score, completed } }),
  summary: () => edge("unipool-games", "/summary"),
  leaderboard: (game = "") => edge("unipool-games", `/leaderboard${game ? `?game=${encodeURIComponent(game)}` : ""}`),
};
