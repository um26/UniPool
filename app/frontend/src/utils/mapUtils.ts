declare global {
  interface Window {
    L?: any;
  }
}

// Module-level so it persists across remounts within the session — avoids
// re-hitting Nominatim (which asks for max ~1 request/sec) for locations
// we've already resolved.
const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};
let leafletLoadPromise: Promise<void> | null = null;

export function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load map library"));
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

export async function geocode(place: string): Promise<{ lat: number; lng: number } | null> {
  const key = place.trim().toLowerCase();
  if (key in geocodeCache) return geocodeCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place + ", India")}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    const result = data?.[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    geocodeCache[key] = result;
    return result;
  } catch {
    geocodeCache[key] = null;
    return null;
  }
}
