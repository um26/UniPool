import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { loadLeaflet, geocode } from "@/src/utils/mapUtils";
import { api } from "@/src/api/client";

type Route = { from: string; to: string; count: number };
type HourBucket = { hour: number; count: number };

function fmtHour(h: number) {
  const period = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

export default function CampusHeatmap() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [resolvedCount, setResolvedCount] = useState(0);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [hourly, setHourly] = useState<HourBucket[]>([]);
  const [totalPools, setTotalPools] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.routeHeatmap();
        if (cancelled) return;
        setRoutes(data.routes || []);
        setHourly(data.hourly || []);
        setTotalPools(data.total_pools || 0);

        await loadLeaflet();
        if (cancelled || !window.L) return;

        if (!mapRef.current) {
          mapRef.current = window.L.map("heatmap-container", { attributionControl: true }).setView([22.9734, 78.6569], 5);
          window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapRef.current);
        }

        layersRef.current.forEach((l) => mapRef.current.removeLayer(l));
        layersRef.current = [];

        const routeList: Route[] = data.routes || [];
        const maxCount = Math.max(1, ...routeList.map((r) => r.count));
        const bounds: [number, number][] = [];

        for (const r of routeList) {
          if (cancelled) return;
          const [fromCoords, toCoords] = await Promise.all([geocode(r.from), geocode(r.to)]);
          if (!cancelled) await new Promise((res) => setTimeout(res, 250));

          if (fromCoords && toCoords && window.L && mapRef.current) {
            const intensity = r.count / maxCount;
            const weight = 2 + intensity * 10;
            const opacity = 0.25 + intensity * 0.6;

            const line = window.L.polyline([[fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]], {
              color: "#F57F17", weight, opacity, lineCap: "round",
            }).addTo(mapRef.current);
            line.bindPopup(`<strong>${r.from} → ${r.to}</strong><br/>${r.count} pool${r.count === 1 ? "" : "s"} posted`);
            layersRef.current.push(line);

            const glow = window.L.circleMarker([fromCoords.lat, fromCoords.lng], {
              radius: 4 + intensity * 8, color: "#F57F17", fillColor: "#F57F17", fillOpacity: 0.5, weight: 0,
            }).addTo(mapRef.current);
            layersRef.current.push(glow);

            bounds.push([fromCoords.lat, fromCoords.lng], [toCoords.lat, toCoords.lng]);
          }
          setResolvedCount((c) => c + 1);
        }

        if (bounds.length > 0 && mapRef.current) {
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.warn("Heatmap load failed", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const maxHourCount = Math.max(1, ...hourly.map((h) => h.count));

  if (Platform.OS !== "web") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Campus heatmap is available on the web app.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View nativeID="heatmap-container" style={{ flex: 1 }} />
        {status === "loading" && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color={colors.saffron} />
            <Text style={styles.overlayText}>Mapping {resolvedCount}/{routes.length} popular routes…</Text>
          </View>
        )}
        {status === "error" && (
          <View style={styles.overlay}>
            <Text style={styles.msg}>Couldn't load the heatmap right now.</Text>
          </View>
        )}
        {routes.length === 0 && status === "ready" && (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.msg}>Not enough pools posted yet to show trends.</Text>
          </View>
        )}
      </View>

      {hourly.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Popular travel times (IST)</Text>
          <Text style={styles.chartSub}>Across {totalPools} pool{totalPools === 1 ? "" : "s"} ever posted</Text>
          <View style={styles.barsRow}>
            {hourly.map((h) => (
              <View key={h.hour} style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(3, (h.count / maxHourCount) * 60), backgroundColor: h.count > 0 ? colors.saffron : colors.border },
                  ]}
                />
                {h.hour % 3 === 0 && <Text style={styles.barLabel}>{fmtHour(h.hour)}</Text>}
              </View>
            ))}
          </View>
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
    backgroundColor: colors.card, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  overlayText: { fontSize: FONT.sm, color: colors.muted, fontWeight: "600" },
  chartCard: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, padding: SPACING.lg },
  chartTitle: { fontSize: FONT.base, fontWeight: "800", color: colors.onSurface, fontFamily: FONT_DISPLAY },
  chartSub: { fontSize: 11, color: colors.muted, marginTop: 2, marginBottom: SPACING.md },
  barsRow: { flexDirection: "row", alignItems: "flex-end", height: 76, gap: 2 },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: 76 },
  bar: { width: "70%", borderRadius: 2, minHeight: 3 },
  barLabel: { fontSize: 8, color: colors.muted, marginTop: 3, fontWeight: "600" },
});
