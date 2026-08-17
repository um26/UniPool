import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT } from "@/src/theme";

export default function RatingBadge({ avg, count }: { avg?: number | null; count?: number }) {
  if (!avg || !count) {
    return (
      <View style={styles.row}>
        <Ionicons name="star-outline" size={12} color={COLORS.muted} />
        <Text style={styles.newText}>New traveller</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={12} color={COLORS.saffron} />
      <Text style={styles.text}>{avg.toFixed(1)}</Text>
      <Text style={styles.count}>({count})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  text: { fontSize: FONT.sm, fontWeight: "700", color: COLORS.onSurface },
  count: { fontSize: FONT.sm, color: COLORS.muted },
  newText: { fontSize: FONT.sm, color: COLORS.muted, fontStyle: "italic" },
});
