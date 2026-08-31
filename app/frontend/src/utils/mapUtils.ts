declare global {
  interface Window {
    L?: any;
  }
}

type Coordinates = { lat: number; lng: number };

const KNOWN_LOCATION_ALIASES: Record<string, Coordinates> = {
  rgia: { lat: 17.2403, lng: 78.4294 },
  "rgi airport": { lat: 17.2403, lng: 78.4294 },
  "rajiv gandhi airport": { lat: 17.2403, lng: 78.4294 },
  "rajiv gandhi international airport": { lat: 17.2403, lng: 78.4294 },
  "hyderabad airport": { lat: 17.2403, lng: 78.4294 },
  "hyderabad international airport": { lat: 17.2403, lng: 78.4294 },
  "hyd airport": { lat: 17.2403, lng: 78.4294 },
  "hyd rajiv gandhi international airport": { lat: 17.2403, lng: 78.4294 },
};

function locationKey(place: string): string {
  return place.trim().toLowerCase().replace(/[.,()]/g, " ").replace(/\s+/g, " ").trim();
}

function knownLocation(place: string): Coordinates | null {
  const key = locationKey(place);
  if (KNOWN_LOCATION_ALIASES[key]) return KNOWN_LOCATION_ALIASES[key];
  if (/\brgia\b/.test(key)) return KNOWN_LOCATION_ALIASES.rgia;
  if (/rajiv gandhi.*(?:international )?airport/.test(key)) return KNOWN_LOCATION_ALIASES.rgia;
  if (/hyderabad.*(?:international )?airport/.test(key)) return KNOWN_LOCATION_ALIASES.rgia;
  return null;
}

const geocodeCache: Record<string, Coordinates | null> = {};
let leafletLoadPromise: Promise<void> | null = null;
let routingMachineLoadPromise: Promise<void> | null = null;

function ensureStylesheet(id: string, href: string) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const css = document.createElement("link");
  css.id = id;
  css.rel = "stylesheet";
  css.href = href;
  document.head.appendChild(css);
}

export function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    ensureStylesheet("unipool-leaflet-css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    const existing = document.getElementById("unipool-leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load map library")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "unipool-leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load map library"));
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

export async function loadLeafletRoutingMachine(): Promise<void> {
  if (typeof window === "undefined") return;
  await loadLeaflet();
  if (window.L?.Routing?.control) return;
  if (routingMachineLoadPromise) return routingMachineLoadPromise;

  routingMachineLoadPromise = new Promise((resolve, reject) => {
    ensureStylesheet("unipool-lrm-css", "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css");

    if (!document.getElementById("unipool-lrm-hide-style")) {
      const style = document.createElement("style");
      style.id = "unipool-lrm-hide-style";
      style.textContent = ".leaflet-routing-container{display:none!important}.leaflet-routing-alt{display:none!important}";
      document.head.appendChild(style);
    }

    const existing = document.getElementById("unipool-lrm-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load route renderer")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "unipool-lrm-js";
    script.src = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load route renderer"));
    document.head.appendChild(script);
  });

  return routingMachineLoadPromise;
}

export async function geocode(place: string): Promise<Coordinates | null> {
  const key = locationKey(place);
  if (!key) return null;
  if (key in geocodeCache) return geocodeCache[key];

  const known = knownLocation(place);
  if (known) {
    geocodeCache[key] = known;
    return known;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place + ", India")}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
    const data = await res.json();
    const result = data?.[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
    geocodeCache[key] = result;
    return result;
  } catch {
    geocodeCache[key] = null;
    return null;
  }
}
