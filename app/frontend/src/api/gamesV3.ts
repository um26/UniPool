import { getToken } from "@/src/api/client";

const GAMES_BASE = process.env.EXPO_PUBLIC_UNIPOOL_GAMES_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-games";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${GAMES_BASE}${path}`, {
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

export const gamesV3Api = {
  summary: () => request("/summary"),
  leaderboard: (game?: string) => request(`/leaderboard${game ? `?game=${encodeURIComponent(game)}` : ""}`),
  record: (gameKey: string, score: number, completed = true) => request("/progress", { method: "POST", body: JSON.stringify({ game_key: gameKey, score, completed }) }),
};

export { GAMES_BASE };
