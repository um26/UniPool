import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
const TOKEN_KEY = "unipool.session_token";

type CacheEntry = { at: number; data: any };

let tokenMemory: string | null | undefined;
let tokenLoad: Promise<string | null> | null = null;
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();
let wakePromise: Promise<void> | null = null;
let lastWakeAt = 0;

export async function getToken(): Promise<string | null> {
  if (tokenMemory !== undefined) return tokenMemory;
  if (!tokenLoad) {
    tokenLoad = storage.secureGet(TOKEN_KEY, null).then((value) => {
      tokenMemory = (value as string | null) || null;
      return tokenMemory;
    }).finally(() => { tokenLoad = null; });
  }
  return tokenLoad;
}

export async function setToken(token: string | null) {
  tokenMemory = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

function clearReadCache() {
  responseCache.clear();
}

async function req(path: string, opts: RequestInit = {}, cacheMs = 0) {
  if (!BASE) throw new Error("UniPool API is not configured");
  const method = (opts.method || "GET").toUpperCase();
  const cacheKey = `${method}:${path}`;

  if (method === "GET" && cacheMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cacheMs) return cached.data;
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }

  const run = (async () => {
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

    if (method === "GET" && cacheMs > 0) {
      responseCache.set(cacheKey, { at: Date.now(), data });
    }
    return data;
  })();

  if (method === "GET" && cacheMs > 0) {
    inflight.set(cacheKey, run);
    run.finally(() => inflight.delete(cacheKey));
  }
  return run;
}

async function mutate(path: string, opts: RequestInit) {
  const data = await req(path, opts);
  clearReadCache();
  return data;
}

async function wakeBackend() {
  if (!BASE) return;
  if (wakePromise) return wakePromise;
  if (Date.now() - lastWakeAt < 30000) return;
  lastWakeAt = Date.now();

  wakePromise = (async () => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
    try {
      await fetch(BASE, {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  })().finally(() => { wakePromise = null; });

  return wakePromise;
}

// Establish the network path to the API early on web. This does not block UI.
if (typeof document !== "undefined" && BASE) {
  try {
    const origin = new URL(BASE).origin;
    if (!document.querySelector(`link[data-unipool-preconnect="${origin}"]`)) {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.setAttribute("data-unipool-preconnect", origin);
      document.head.appendChild(link);
    }
  } catch {}
}

export const api = {
  wakeBackend,
  googleSignIn: (id_token: string) => req("/auth/google", { method: "POST", body: JSON.stringify({ id_token }) }),
  emailSignup: (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) =>
    mutate("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name, username, turnstile_token: turnstileToken }) }),
  emailLogin: (identifier: string, password: string, turnstileToken?: string | null) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password, turnstile_token: turnstileToken }) }),
  me: () => req("/auth/me"),
  logout: () => mutate("/auth/logout", { method: "POST" }),
  updateProfile: (patch: any) => mutate("/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  listPools: () => req("/pools", {}, 10000),
  routeHeatmap: () => req("/analytics/route-heatmap", {}, 30000),
  myPools: () => req("/pools/mine", {}, 10000),
  myMatches: () => req("/pools/matches", {}, 8000),
  createPool: (body: any) => mutate("/pools", { method: "POST", body: JSON.stringify(body) }),
  updatePool: (id: string, body: any) => mutate(`/pools/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  closePool: (id: string) => mutate(`/pools/${id}/close`, { method: "PATCH" }),
  reopenPool: (id: string) => mutate(`/pools/${id}/reopen`, { method: "PATCH" }),
  deletePool: (id: string) => mutate(`/pools/${id}`, { method: "DELETE" }),
  trivia: () => req("/trivia", {}, 60000),
  adminStats: () => req("/admin/stats", {}, 10000),
  adminPools: () => req("/admin/pools", {}, 5000),
  adminDeletePool: (id: string) => mutate(`/admin/pools/${id}`, { method: "DELETE" }),
  sendMessage: (to_user_id: string, text: string, pool_id?: string) =>
    mutate("/messages", { method: "POST", body: JSON.stringify({ to_user_id, text, pool_id }) }),
  getThread: (otherUserId: string) => req(`/messages/${otherUserId}`, {}, 2500),
  listConversations: () => req("/messages/conversations", {}, 5000),
  sendTyping: (to_user_id: string) => req("/messages/typing", { method: "POST", body: JSON.stringify({ to_user_id }) }),
  getTyping: (otherUserId: string) => req(`/messages/typing/${otherUserId}`),
  getPresence: (userId: string) => req(`/users/${userId}/presence`, {}, 3000),
  getVapidKey: () => req("/push/vapid-public-key", {}, 60000),
  pushSubscribe: (sub: { endpoint: string; keys: any }) => mutate("/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  pushUnsubscribe: (endpoint: string) => mutate("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
  submitScore: (game: string, score: number) => mutate("/games/score", { method: "POST", body: JSON.stringify({ game, score }) }),
  getLeaderboard: (game: string) => req(`/games/leaderboard/${game}`, {}, 5000),
  submitRating: (rated_user_id: string, stars: number, comment?: string, pool_id?: string) =>
    mutate("/ratings", { method: "POST", body: JSON.stringify({ rated_user_id, stars, comment, pool_id }) }),
  getUserRatings: (userId: string) => req(`/ratings/user/${userId}`, {}, 10000),
  canRate: (userId: string) => req(`/ratings/can-rate/${userId}`, {}, 5000),
  requestToJoin: (poolId: string) => mutate(`/pools/${poolId}/requests`, { method: "POST" }),
  listPoolRequests: (poolId: string) => req(`/pools/${poolId}/requests`, {}, 5000),
  incomingRequests: () => req("/requests/incoming", {}, 5000),
  myRequests: () => req("/requests/mine", {}, 5000),
  acceptRequest: (requestId: string) => mutate(`/requests/${requestId}/accept`, { method: "PATCH" }),
  declineRequest: (requestId: string) => mutate(`/requests/${requestId}/decline`, { method: "PATCH" }),
  cancelRequest: (requestId: string) => mutate(`/requests/${requestId}`, { method: "DELETE" }),
  confirmedMatches: () => req("/matches/confirmed", {}, 8000),
  removeTraveler: (poolId: string, travelerUserId: string) => mutate(`/pools/${poolId}/travelers/${travelerUserId}`, { method: "DELETE" }),
  getPool: (poolId: string) => req(`/pools/${poolId}`, {}, 8000),
  blockUser: (userId: string) => mutate(`/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => mutate(`/users/${userId}/block`, { method: "DELETE" }),
  listBlocked: () => req("/users/me/blocked", {}, 10000),
  submitReport: (reportedUserId: string, reason: string, details?: string, poolId?: string) =>
    mutate("/reports", { method: "POST", body: JSON.stringify({ reported_user_id: reportedUserId, reason, details, pool_id: poolId }) }),
  verifyCollegeIdStart: (collegeEmail: string) => mutate("/profile/verify-college-id/start", { method: "POST", body: JSON.stringify({ college_email: collegeEmail }) }),
  verifyCollegeIdConfirm: (code: string) => mutate("/profile/verify-college-id/confirm", { method: "POST", body: JSON.stringify({ code }) }),
  ensureTripChat: (poolId: string) => mutate(`/messages/trip/ensure/${poolId}`, { method: "POST" }),
  getGroupThread: (conversationId: string) => req(`/messages/group/${conversationId}`, {}, 2500),
  sendGroupMessage: (conversationId: string, text: string) =>
    mutate(`/messages/group/${conversationId}`, { method: "POST", body: JSON.stringify({ text }) }),
};
