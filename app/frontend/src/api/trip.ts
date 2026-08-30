import { getToken } from "@/src/api/client";

const TRIP_BASE = process.env.EXPO_PUBLIC_UNIPOOL_TRIP_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-trip";

async function tripRequest(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${TRIP_BASE}${path}`, {
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

export type TripStage = "planning" | "matching" | "confirmed" | "meeting" | "travelling" | "completed" | "cancelled";

export type TripState = {
  pool_id: string;
  owner_user_id?: string;
  stage: TripStage;
  final_fare_paise?: number | null;
  fare_note?: string | null;
  member_count?: number;
  estimated_share_paise?: number | null;
  updated_at?: string;
};

export type TripLiveMember = {
  pool_id: string;
  user_id: string;
  status?: string | null;
  name?: string;
  picture?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_active?: boolean;
  location_expires_at?: string | null;
  updated_at?: string;
};

export const tripApi = {
  health: async () => {
    const response = await fetch(`${TRIP_BASE}/health`, { cache: "no-store" });
    return response.ok ? response.json() : null;
  },
  state: (poolId: string) => tripRequest(`/trips/${encodeURIComponent(poolId)}/state`) as Promise<TripState>,
  updateState: (poolId: string, stage: TripStage) => tripRequest(`/trips/${encodeURIComponent(poolId)}/state`, { method: "PATCH", body: JSON.stringify({ stage }) }) as Promise<TripState>,
  setFare: (poolId: string, amountPaise: number, note?: string) => tripRequest(`/trips/${encodeURIComponent(poolId)}/fare`, { method: "PATCH", body: JSON.stringify({ amount_paise: Math.round(amountPaise), note: note || null }) }) as Promise<TripState>,
  live: (poolId: string) => tripRequest(`/trips/${encodeURIComponent(poolId)}/live`) as Promise<TripLiveMember[]>,
  updateLive: (poolId: string, body: { status: string; latitude?: number; longitude?: number; share_minutes?: number }) => tripRequest(`/trips/${encodeURIComponent(poolId)}/live`, { method: "POST", body: JSON.stringify(body) }) as Promise<TripLiveMember>,
  stopLiveLocation: (poolId: string) => tripRequest(`/trips/${encodeURIComponent(poolId)}/live`, { method: "DELETE" }),
};

export { TRIP_BASE };
