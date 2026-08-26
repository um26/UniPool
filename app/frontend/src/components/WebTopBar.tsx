import React from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme_context/ThemeContext";

const NAV = [
  { label: "Home", icon: "home-outline" as const, path: "/(tabs)", match: "/" },
  { label: "Matches", icon: "people-outline" as const, path: "/(tabs)/matches", match: "/matches" },
  { label: "Explore", icon: "compass-outline" as const, path: "/(tabs)/plan", match: "/plan" },
  { label: "Chats", icon: "chatbubble-outline" as const, path: "/(tabs)/messages", match: "/messages" },
  { label: "Profile", icon: "person-outline" as const, path: "/(tabs)/profile", match: "/profile" },
];

export default function WebTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { colors, isDark, toggleTheme } = useTheme();

  if (Platform.OS !== "web") return null;

  const desktop = width >= 820;
  const showActionText = width >= 660;
  const showBrandText = width >= 470;

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
        {showBrandText ? <Text style={[styles.brandText, { color: colors.onSurface }]}>UniPool</Text> : null}
      </Pressable>

      {desktop ? (
        <View style={[styles.nav, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          {NAV.map((item) => {
            const active = pathname === item.match;
            return (
              <Pressable
                key={item.label}
                onPress={() => tap(() => router.replace(item.path as any))}
                style={[styles.navItem, active && { backgroundColor: colors.card, borderColor: colors.border }]}
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={item.icon} size={15} color={active ? colors.indigo : colors.muted} />
                <Text style={[styles.navText, { color: active ? colors.onSurface : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : <View style={{ flex: 1 }} />}

      <View style={styles.actions}>
        <Pressable
          onPress={() => tap(() => router.push("/post-request" as any))}
          style={[styles.action, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          accessibilityLabel="Post a trip"
        >
          <Ionicons name="add-circle-outline" size={17} color={colors.indigo} />
          {showActionText ? <Text style={[styles.actionText, { color: colors.onSurface }]}>Post trip</Text> : null}
        </Pressable>

        <Pressable
          onPress={() => tap(() => router.push("/(tabs)/games" as any))}
          style={[styles.action, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          accessibilityLabel="Open time-pass games"
        >
          <Ionicons name="game-controller-outline" size={17} color={colors.saffron} />
          {showActionText ? <Text style={[styles.actionText, { color: colors.onSurface }]}>Time-pass</Text> : null}
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
    gap: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 50,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, minWidth: 44 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: 19,
    borderWidth: 1,
    marginHorizontal: "auto",
  },
  navItem: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  navText: { fontSize: 11, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
