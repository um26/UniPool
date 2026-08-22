import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { SPACING, RADIUS, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { loadLeaflet, geocode } from "@/src/utils/mapUtils";

type Pool = {
  pool_id: string;
  user_name: string;
  from_location: string;
  to_location: string;
  user_rating_avg?: number | null;
};

export default function PoolMapView({ pools }: { pools: Pool[] }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;

    (async () => {
      try {
        await loadLeaflet();
        if (cancelled || !window.L) return;

        if (!mapRef.current) {
          mapRef.current = window.L.map("pool-map-container", { attributionControl: true }).setView([22.9734, 78.6569], 5);
          window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapRef.current);
        }

        // clear old markers
        markersRef.current.forEach((m) => mapRef.current.removeLayer(m));
        markersRef.current = [];
        setResolvedCount(0);

        const uniquePools = pools.slice(0, 15); // two geocodes per pool now — keep Nominatim usage sane
        const bounds: [number, number][] = [];

        for (const pool of uniquePools) {
          if (cancelled) return;
          const [fromCoords, toCoords] = await Promise.all([geocode(pool.from_location), geocode(pool.to_location)]);
          if (!cancelled) await new Promise((r) => setTimeout(r, 250)); // Nominatim's ~1 req/sec policy

          if (fromCoords && window.L && mapRef.current) {
            const ratingText = pool.user_rating_avg ? `★ ${pool.user_rating_avg}/10` : "New traveller";
            const fromMarker = window.L.circleMarker([fromCoords.lat, fromCoords.lng], {
              radius: 8, color: "#F57F17", fillColor: "#F57F17", fillOpacity: 0.9, weight: 2,
            }).addTo(mapRef.current);
            fromMarker.bindPopup(
              `<strong>${pool.user_name}</strong><br/>${pool.from_location} → ${pool.to_location}<br/><span style="color:#888">${ratingText}</span>`
            );
            markersRef.current.push(fromMarker);
            bounds.push([fromCoords.lat, fromCoords.lng]);

            if (toCoords) {
              const toMarker = window.L.circleMarker([toCoords.lat, toCoords.lng], {
                radius: 6, color: "#3949AB", fillColor: "#3949AB", fillOpacity: 0.9, weight: 2,
              }).addTo(mapRef.current);
              toMarker.bindPopup(`<strong>Drop:</strong> ${pool.to_location}`);
              markersRef.current.push(toMarker);
              bounds.push([toCoords.lat, toCoords.lng]);

              const line = window.L.polyline([[fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]], {
                color: "#3949AB", weight: 2, opacity: 0.55, dashArray: "6 6",
              }).addTo(mapRef.current);
              markersRef.current.push(line);
            }
          }
          setResolvedCount((c) => c + 1);
        }

        if (bounds.length > 0 && mapRef.current) {
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.warn("Map load failed", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [pools]);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Map view is available on the web app.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View nativeID="pool-map-container" style={{ flex: 1 }} />
      {status === "loading" && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.indigo} />
          <Text style={styles.overlayText}>Locating {resolvedCount}/{Math.min(pools.length, 15)} routes…</Text>
        </View>
      )}
      {status === "error" && (
        <View style={styles.overlay}>
          <Text style={styles.msg}>Couldn't load the map right now.</Text>
        </View>
      )}
      {pools.length === 0 && status === "ready" && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.msg}>No pools to show on the map yet.</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  msg: { color: colors.muted, textAlign: "center" },
  overlay: {
    position: "absolute", top: SPACING.md, alignSelf: "center",
    backgroundColor: "#fff", borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  overlayText: { fontSize: FONT.sm, color: colors.muted, fontWeight: "600" },
});
