import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { SPACING, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import CampusHeatmap from "@/src/components/CampusHeatmap";

export default function HeatmapScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="heatmap-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.title}>Campus Heatmap</Text>
          <Text style={styles.subtitle}>Popular routes & times, anonymized</Text>
        </View>
        <Ionicons name="flame" size={20} color={colors.saffron} />
      </View>
      <CampusHeatmap />
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card,
  },
  title: { fontSize: FONT.lg, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 11, color: colors.muted, marginTop: 1 },
});
