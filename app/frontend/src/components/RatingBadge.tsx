import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

export default function RatingBadge({ avg, count }: { avg?: number | null; count?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!avg || !count) {
    return (
      <View style={styles.row}>
        <Ionicons name="star-outline" size={12} color={colors.muted} />
        <Text style={styles.newText}>New traveller</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={12} color={colors.saffron} />
      <Text style={styles.text}>{avg.toFixed(1)}/10</Text>
      <Text style={styles.count}>({count})</Text>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  text: { fontSize: FONT.sm, fontWeight: "700", color: colors.onSurface },
  count: { fontSize: FONT.sm, color: colors.muted },
  newText: { fontSize: FONT.sm, color: colors.muted, fontStyle: "italic" },
});
