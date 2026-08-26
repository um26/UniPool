import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme_context/ThemeContext";

export default function WebTopBar() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();

  if (Platform.OS !== "web") return null;

  const tap = (fn: () => void) => {
    Haptics.selectionAsync();
    fn();
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Pressable onPress={() => router.replace("/(tabs)" as any)} style={styles.brand} accessibilityLabel="Go to UniPool home">
        <View style={[styles.logo, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Ionicons name="car-sport" size={17} color={colors.saffron} />
        </View>
        <Text style={[styles.brandText, { color: colors.onSurface }]}>UniPool</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={() => tap(() => router.push("/post-request" as any))}
          style={[styles.action, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          accessibilityLabel="Post a trip"
        >
          <Ionicons name="add-circle-outline" size={17} color={colors.indigo} />
          <Text style={[styles.actionText, { color: colors.onSurface }]}>Post trip</Text>
        </Pressable>

        <Pressable
          onPress={() => tap(() => router.push("/(tabs)/games" as any))}
          style={[styles.action, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          accessibilityLabel="Open time-pass games"
        >
          <Ionicons name="game-controller-outline" size={17} color={colors.saffron} />
          <Text style={[styles.actionText, { color: colors.onSurface }]}>Time-pass</Text>
        </Pressable>

        <Pressable
          onPress={() => tap(toggleTheme)}
          style={[styles.iconAction, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={colors.indigo} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 54,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 50,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: "800" },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
