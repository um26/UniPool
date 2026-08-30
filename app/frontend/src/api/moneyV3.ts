import { getToken } from "@/src/api/client";

const MONEY_V3_BASE = process.env.EXPO_PUBLIC_UNIPOOL_MONEY_V3_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-money-v3";

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const response = await fetch(`${MONEY_V3_BASE}${path}`, {
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

export type BudgetRow = { category: string; limit_paise: number; spent_paise: number; remaining_paise: number; over_paise: number };
export type BudgetSummary = {
  month: string;
  budgets: BudgetRow[];
  spent_by_category: Record<string, number>;
  income_paise: number;
  expense_paise: number;
  total_budget_paise: number;
  remaining_budget_paise: number;
  safe_to_spend_per_day_paise: number;
  safe_to_spend_week_paise: number;
};

export type TripPreferences = {
  pool_id: string;
  user_id: string;
  time_flex_minutes: number;
  max_detour_km: number;
  cab_preference: string;
  quiet_ride: boolean;
  luggage_flexible: boolean;
};

export const moneyV3Api = {
  health: async () => {
    const response = await fetch(`${MONEY_V3_BASE}/health`, { cache: "no-store" });
    return response.ok ? response.json() : null;
  },
  budgets: (month?: string) => request(`/budgets${month ? `?month=${encodeURIComponent(month)}` : ""}`) as Promise<BudgetSummary>,
  setBudget: (category: string, limitPaise: number, month?: string) => request(`/budgets/${encodeURIComponent(category)}`, { method: "PUT", body: JSON.stringify({ limit_paise: Math.max(0, Math.round(limitPaise)), month }) }),
  deleteBudget: (category: string, month?: string) => request(`/budgets/${encodeURIComponent(category)}${month ? `?month=${encodeURIComponent(month)}` : ""}`, { method: "DELETE" }),
  tripPreferences: (poolId: string) => request(`/trips/${encodeURIComponent(poolId)}/preferences`) as Promise<TripPreferences>,
  setTripPreferences: (poolId: string, body: Partial<TripPreferences>) => request(`/trips/${encodeURIComponent(poolId)}/preferences`, { method: "PUT", body: JSON.stringify(body) }) as Promise<TripPreferences>,
  addTripFareToCircle: (poolId: string, circleId: string, body: { paid_by?: string; description?: string } = {}) => request(`/trips/${encodeURIComponent(poolId)}/circles/${encodeURIComponent(circleId)}/expense`, { method: "POST", body: JSON.stringify(body) }),
};

export { MONEY_V3_BASE };
