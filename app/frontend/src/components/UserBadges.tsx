import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

export type Badge = { id: string; label: string; icon: string };

const BADGE_COLORS: Record<string, string> = {
  verified: "#1976D2",
  top_rated: "#B8860B",
  frequent: "#D84315",
};

const BADGE_BG: Record<string, string> = {
  verified: "rgba(25,118,210,0.1)",
  top_rated: "rgba(184,134,11,0.1)",
  frequent: "rgba(216,67,21,0.1)",
};

/** Small icon+label pills — e.g. "Verified Student", "Top Rated". Renders
 *  nothing if there are no badges, so it's always safe to drop in. */
export default function UserBadges({ badges, compact = false }: { badges?: Badge[] | null; compact?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!badges || badges.length === 0) return null;
  return (
    <View style={styles.row}>
      {badges.map((b) => (
        <View
          key={b.id}
          style={[styles.chip, { backgroundColor: BADGE_BG[b.id] || colors.surface }]}
          testID={`badge-${b.id}`}
        >
          <Ionicons name={b.icon as any} size={compact ? 10 : 12} color={BADGE_COLORS[b.id] || colors.muted} />
          {!compact && (
            <Text style={[styles.text, { color: BADGE_COLORS[b.id] || colors.muted }]}>{b.label}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 3 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: "700" },
});
