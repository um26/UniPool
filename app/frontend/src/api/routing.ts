import { getToken } from "@/src/api/client";

const ROUTING_BASE = process.env.EXPO_PUBLIC_UNIPOOL_ROUTING_API || "https://jwodrevycbzlcukkoaps.supabase.co/functions/v1/unipool-routing";

type Coords = { lat: number; lng: number };
export type RoadRoute = {
  provider: "openrouteservice" | "osrm" | "osrm-browser-fallback" | string;
  distance_m: number;
  duration_s: number;
  coordinates: [number, number][];
};

const cache = new Map<string, Promise<RoadRoute>>();

function routeKey(from: Coords, to: Coords) {
  const point = (p: Coords) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  return `${point(from)}>${point(to)}`;
}

function validRoute(data: any): data is RoadRoute {
  return Boolean(
    data &&
    Number.isFinite(Number(data.distance_m)) &&
    Number.isFinite(Number(data.duration_s)) &&
    Array.isArray(data.coordinates) &&
    data.coordinates.length >= 2,
  );
}

async function proxyRoute(from: Coords, to: Coords): Promise<RoadRoute> {
  const token = await getToken();
  const response = await fetch(`${ROUTING_BASE}/route`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ from, to }),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok || !validRoute(data)) throw new Error(data?.detail || `Routing failed (${response.status})`);
  return {
    ...data,
    distance_m: Number(data.distance_m),
    duration_s: Number(data.duration_s),
    coordinates: data.coordinates.map((point: any) => [Number(point[0]), Number(point[1])] as [number, number]),
  };
}

async function browserOsrmRoute(from: Coords, to: Coords): Promise<RoadRoute> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, {
    headers: { Accept: "application/json" },
  });
  const data = await response.json();
  const route = data?.routes?.[0];
  if (!response.ok || !route?.geometry?.coordinates?.length) throw new Error("Road route unavailable");
  return {
    provider: "osrm-browser-fallback",
    distance_m: Number(route.distance || 0),
    duration_s: Number(route.duration || 0),
    coordinates: route.geometry.coordinates.map((point: number[]) => [Number(point[1]), Number(point[0])] as [number, number]),
  };
}

export function roadRoute(from: Coords, to: Coords): Promise<RoadRoute> {
  const key = routeKey(from, to);
  const existing = cache.get(key);
  if (existing) return existing;

  const pending = proxyRoute(from, to)
    .catch(() => browserOsrmRoute(from, to))
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, pending);
  return pending;
}

export async function routingHealth() {
  try {
    const response = await fetch(`${ROUTING_BASE}/health`, { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

export { ROUTING_BASE };
