import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORS_KEY = Deno.env.get("OPENROUTESERVICE_API_KEY") || "";
const RENDER_BASE = "https://unipool-backend-owb9.onrender.com";
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function fail(detail: string, status = 400) { return json({ detail }, status); }
function nowIso() { return new Date().toISOString(); }
async function readBody(req: Request) { try { return await req.json(); } catch { return {}; } }
async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function requireUniPoolUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw { status: 401, detail: "Missing authorization header" };
  const token = auth.slice(7).trim();
  if (!token) throw { status: 401, detail: "Missing session token" };
  const tokenHash = await sha256(token);
  const { data: cached } = await db.from("unipool_session_cache").select("user_id,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (cached && new Date(cached.expires_at).getTime() > Date.now()) return String(cached.user_id);

  let response: Response | null = null;
  try {
    response = await fetchWithTimeout(`${RENDER_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store" }, 10000);
  } catch {}
  if (!response) throw { status: 503, detail: "UniPool session verification is temporarily unavailable" };
  if (!response.ok) throw { status: response.status === 401 ? 401 : 503, detail: response.status === 401 ? "Session expired" : "UniPool session verification failed" };
  const user = await response.json();
  await db.from("unipool_session_cache").upsert({
    token_hash: tokenHash,
    user_id: user.user_id,
    user_name: user.name || "Student",
    user_email: user.email || null,
    user_picture: user.picture || null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    validated_at: nowIso(),
  });
  return String(user.user_id);
}

type Point = { lat: number; lng: number };
function point(value: any): Point | null {
  const lat = Number(value?.lat); const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
function normalizeCoordinates(coords: any[]): [number, number][] {
  return (coords || []).map((p: any) => [Number(p[1]), Number(p[0])] as [number, number]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

async function routeWithOrs(from: Point, to: Point) {
  if (!ORS_KEY) return null;
  const response = await fetchWithTimeout("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
    method: "POST",
    headers: { Authorization: ORS_KEY, "Content-Type": "application/json", Accept: "application/geo+json,application/json" },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const feature = data?.features?.[0];
  const summary = feature?.properties?.summary;
  const coordinates = normalizeCoordinates(feature?.geometry?.coordinates || []);
  if (coordinates.length < 2 || !Number.isFinite(Number(summary?.distance)) || !Number.isFinite(Number(summary?.duration))) return null;
  return { provider: "openrouteservice", distance_m: Number(summary.distance), duration_s: Number(summary.duration), coordinates };
}

async function routeWithOsrm(from: Point, to: Point) {
  const encoded = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const response = await fetchWithTimeout(`https://router.project-osrm.org/route/v1/driving/${encoded}?overview=full&geometries=geojson&steps=false`, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  const route = data?.routes?.[0];
  const coordinates = normalizeCoordinates(route?.geometry?.coordinates || []);
  if (coordinates.length < 2 || !Number.isFinite(Number(route?.distance)) || !Number.isFinite(Number(route?.duration))) return null;
  return { provider: "osrm", distance_m: Number(route.distance), duration_s: Number(route.duration), coordinates };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const marker = "/unipool-routing";
  const index = url.pathname.indexOf(marker);
  const path = index >= 0 ? (url.pathname.slice(index + marker.length) || "/") : url.pathname;
  try {
    if (path === "/health" && req.method === "GET") return json({ status: "ok", version: "routing-1.0", openrouteservice_configured: Boolean(ORS_KEY), primary_provider: ORS_KEY ? "openrouteservice" : "osrm", renderer: "leaflet-routing-machine" });
    await requireUniPoolUser(req);
    if (path === "/route" && req.method === "POST") {
      const payload = await readBody(req);
      const from = point(payload.from); const to = point(payload.to);
      if (!from || !to) return fail("Valid pickup and drop coordinates are required");
      let route = null;
      try { route = await routeWithOrs(from, to); } catch (error) { console.warn("OpenRouteService route failed", error); }
      if (!route) {
        try { route = await routeWithOsrm(from, to); } catch (error) { console.warn("OSRM route failed", error); }
      }
      if (!route) return fail("Road route is temporarily unavailable", 503);
      return json(route);
    }
    return fail("Not Found", 404);
  } catch (error: any) {
    console.error(error);
    return fail(error?.detail || error?.message || "Unexpected routing error", Number(error?.status || 500));
  }
});
