import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

const GAMES = [
  {
    testID: "game-rickshaw-rush-card",
    route: "/games/rickshaw-rush",
    icon: "flash" as const,
    tag: "ARCADE",
    title: "Rickshaw Rush",
    sub: "Dodge traffic, grab coins and survive rush hour.",
  },
  {
    testID: "game-trivia-card",
    route: "/games/trivia",
    icon: "bulb" as const,
    tag: "TRIVIA",
    title: "Travel Trivia",
    sub: "Fresh Bharat travel questions every round.",
  },
  {
    testID: "game-tap-plane-card",
    route: "/games/tap-plane",
    icon: "airplane" as const,
    tag: "QUICK TAP",
    title: "Tap-the-Plane",
    sub: "Catch the plane before it flies off screen.",
  },
  {
    testID: "game-memory-match-card",
    route: "/games/memory-match",
    icon: "grid" as const,
    tag: "MEMORY",
    title: "Memory Match",
    sub: "Flip travel icons, find pairs and beat your moves.",
  },
  {
    testID: "game-word-scramble-card",
    route: "/games/word-scramble",
    icon: "text" as const,
    tag: "SPEED ROUND",
    title: "Word Scramble",
    sub: "Unscramble Indian cities before time runs out.",
  },
];

export default function GamesHub() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const open = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>TIME-PASS</Text>
            <Text style={styles.title}>Play while you wait</Text>
            <Text style={styles.sub}>Zero heavy artwork, zero waiting — just tap and play.</Text>
          </View>
        </View>

        <Pressable testID={GAMES[0].testID} onPress={() => open(GAMES[0].route)} style={styles.heroCard}>
          <LinearGradient
            colors={isDark ? ["#17233A", "#2D2535", "#6B4518"] : [colors.indigo, "#4657C8", colors.saffron]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroIcon}><Ionicons name="flash" size={30} color="#fff" /></View>
          <Text style={styles.heroTag}>FEATURED · ARCADE</Text>
          <Text style={styles.heroTitle}>Rickshaw Rush</Text>
          <Text style={styles.heroSub}>Dodge traffic, grab coins and survive the chaos.</Text>
          <View style={styles.playPill}><Text style={styles.playPillText}>Play now</Text><Ionicons name="arrow-forward" size={15} color="#fff" /></View>
        </Pressable>

        <View style={styles.grid}>
          {GAMES.slice(1).map((game, index) => (
            <Pressable key={game.testID} testID={game.testID} onPress={() => open(game.route)} style={styles.card}>
              <View style={[styles.cardIcon, index % 2 === 1 && { backgroundColor: colors.cream }]}>
                <Ionicons name={game.icon} size={23} color={index % 2 === 1 ? colors.saffron : colors.indigo} />
              </View>
              <Text style={styles.tag}>{game.tag}</Text>
              <Text style={styles.cardTitle}>{game.title}</Text>
              <Text style={styles.cardSub}>{game.sub}</Text>
              <Ionicons name="arrow-forward-circle-outline" size={21} color={colors.indigo} style={{ marginTop: 12 }} />
            </Pressable>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="speedometer-outline" size={18} color={colors.saffron} />
          <Text style={styles.noteText}>The hub no longer downloads several full-width Unsplash images before it feels ready, so opening Time-pass is much lighter.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: SPACING.lg, paddingBottom: 130 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: FONT["2xl"], fontWeight: "900", color: colors.onSurface, fontFamily: FONT_DISPLAY, marginTop: 3 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  heroCard: { minHeight: 245, borderRadius: RADIUS.xl, overflow: "hidden", padding: 22, justifyContent: "flex-end", marginBottom: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "rgba(255,255,255,.14)", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  heroTag: { color: "rgba(255,255,255,.76)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  heroSub: { color: "rgba(255,255,255,.86)", fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 520 },
  playPill: { alignSelf: "flex-start", marginTop: 16, height: 36, borderRadius: 18, paddingHorizontal: 13, backgroundColor: "rgba(0,0,0,.22)", flexDirection: "row", alignItems: "center", gap: 6 },
  playPillText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { flexGrow: 1, flexBasis: 260, minHeight: 205, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  tag: { color: colors.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  cardTitle: { color: colors.onSurface, fontSize: FONT.lg, fontWeight: "900", marginTop: 4 },
  cardSub: { color: colors.muted, marginTop: 4, lineHeight: 18, fontSize: 12 },
  note: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: isDark ? colors.surface2 : colors.cream, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: 13, marginTop: 18 },
  noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
});
