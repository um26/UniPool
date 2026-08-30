import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/theme_context/ThemeContext";
import { RADIUS } from "@/src/theme";

const ITEMS = [
  { label: "People", sub: "Find students", icon: "people-outline" as const, route: "/people" },
  { label: "Circles", sub: "Friends + debts", icon: "wallet-outline" as const, route: "/circles" },
  { label: "Personal Money", sub: "Spend + income", icon: "stats-chart-outline" as const, route: "/circles/personal" },
  { label: "Time-pass", sub: "Games + streak", icon: "game-controller-outline" as const, route: "/(tabs)/games" },
];

export default function CampusUtilityStrip() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.shell, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <View style={styles.intro}><Text style={styles.eyebrow}>CAMPUS</Text><Text style={styles.introText}>Useful even when you aren't travelling</Text></View>
      {ITEMS.map((item) => <Pressable key={item.label} onPress={() => router.push(item.route as any)} style={({ pressed }) => [styles.item, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: .7 }]}>
        <View style={[styles.icon, { backgroundColor: colors.surface2 }]}><Ionicons name={item.icon} size={17} color={item.label === "Circles" ? colors.saffron : colors.indigo} /></View>
        <View><Text style={[styles.label, { color: colors.onSurface }]}>{item.label}</Text><Text style={[styles.sub, { color: colors.muted }]}>{item.sub}</Text></View>
      </Pressable>)}
    </ScrollView>
  </View>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  shell: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: 18, paddingVertical: 9, alignItems: "center", gap: 8 },
  intro: { minWidth: 180, paddingRight: 7 }, eyebrow: { color: colors.saffron, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 }, introText: { color: colors.muted, fontSize: 9, marginTop: 2 },
  item: { minWidth: 145, height: 48, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 9 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, label: { fontSize: 10, fontWeight: "900" }, sub: { fontSize: 8, marginTop: 1 },
});