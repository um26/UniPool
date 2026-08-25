import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
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
  emailSignup: (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) =>
    req("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name, username, turnstile_token: turnstileToken }) }),
  emailLogin: (identifier: string, password: string, turnstileToken?: string | null) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password, turnstile_token: turnstileToken }) }),
  me: () => req("/auth/me"),
  logout: () => req("/auth/logout", { method: "POST" }),
  updateProfile: (patch: any) => req("/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  listPools: () => req("/pools"),
  routeHeatmap: () => req("/analytics/route-heatmap"),
  myPools: () => req("/pools/mine"),
  myMatches: () => req("/pools/matches"),
  createPool: (body: any) => req("/pools", { method: "POST", body: JSON.stringify(body) }),
  updatePool: (id: string, body: any) => req(`/pools/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  closePool: (id: string) => req(`/pools/${id}/close`, { method: "PATCH" }),
  reopenPool: (id: string) => req(`/pools/${id}/reopen`, { method: "PATCH" }),
  deletePool: (id: string) => req(`/pools/${id}`, { method: "DELETE" }),
  trivia: () => req("/trivia"),
  adminStats: () => req("/admin/stats"),
  adminPools: () => req("/admin/pools"),
  adminDeletePool: (id: string) => req(`/admin/pools/${id}`, { method: "DELETE" }),
  sendMessage: (to_user_id: string, text: string, pool_id?: string) =>
    req("/messages", { method: "POST", body: JSON.stringify({ to_user_id, text, pool_id }) }),
  getThread: (otherUserId: string) => req(`/messages/${otherUserId}`),
  listConversations: () => req("/messages/conversations"),
  sendTyping: (to_user_id: string) => req("/messages/typing", { method: "POST", body: JSON.stringify({ to_user_id }) }),
  getTyping: (otherUserId: string) => req(`/messages/typing/${otherUserId}`),
  getPresence: (userId: string) => req(`/users/${userId}/presence`),
  getVapidKey: () => req("/push/vapid-public-key"),
  pushSubscribe: (sub: { endpoint: string; keys: any }) => req("/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  pushUnsubscribe: (endpoint: string) => req("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
  submitScore: (game: string, score: number) => req("/games/score", { method: "POST", body: JSON.stringify({ game, score }) }),
  getLeaderboard: (game: string) => req(`/games/leaderboard/${game}`),
  submitRating: (rated_user_id: string, stars: number, comment?: string, pool_id?: string) =>
    req("/ratings", { method: "POST", body: JSON.stringify({ rated_user_id, stars, comment, pool_id }) }),
  getUserRatings: (userId: string) => req(`/ratings/user/${userId}`),
  canRate: (userId: string) => req(`/ratings/can-rate/${userId}`),
  requestToJoin: (poolId: string) => req(`/pools/${poolId}/requests`, { method: "POST" }),
  listPoolRequests: (poolId: string) => req(`/pools/${poolId}/requests`),
  incomingRequests: () => req("/requests/incoming"),
  myRequests: () => req("/requests/mine"),
  acceptRequest: (requestId: string) => req(`/requests/${requestId}/accept`, { method: "PATCH" }),
  declineRequest: (requestId: string) => req(`/requests/${requestId}/decline`, { method: "PATCH" }),
  cancelRequest: (requestId: string) => req(`/requests/${requestId}`, { method: "DELETE" }),
  confirmedMatches: () => req("/matches/confirmed"),
  removeTraveler: (poolId: string, travelerUserId: string) => req(`/pools/${poolId}/travelers/${travelerUserId}`, { method: "DELETE" }),
  getPool: (poolId: string) => req(`/pools/${poolId}`),
  blockUser: (userId: string) => req(`/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => req(`/users/${userId}/block`, { method: "DELETE" }),
  listBlocked: () => req("/users/me/blocked"),
  submitReport: (reportedUserId: string, reason: string, details?: string, poolId?: string) =>
    req("/reports", { method: "POST", body: JSON.stringify({ reported_user_id: reportedUserId, reason, details, pool_id: poolId }) }),
  verifyCollegeIdStart: (collegeEmail: string) => req("/profile/verify-college-id/start", { method: "POST", body: JSON.stringify({ college_email: collegeEmail }) }),
  verifyCollegeIdConfirm: (code: string) => req("/profile/verify-college-id/confirm", { method: "POST", body: JSON.stringify({ code })),
  getGroupThread: (conversationId: string) => req(`/messages/group/${conversationId}`),
  sendGroupMessage: (conversationId: string, text: string) =>
    req(`/messages/group/${conversationId}`, { method: "POST", body: JSON.stringify({ text })),
};
