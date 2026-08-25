import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

export default function GamesHub() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="game-controller" size={20} color={colors.saffron} /></View>
        <View>
          <Text style={styles.title}>Time-pass</Text>
          <Text style={styles.sub}>A little fun for the wait</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <View style={styles.introIcon}><Ionicons name="sparkles" size={18} color={colors.saffron} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Play while you wait</Text>
            <Text style={styles.introSub}>Beat your high score, climb the leaderboard, or learn something new.</Text>
          </View>
        </View>

        <Pressable testID="game-rickshaw-rush-card" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/games/rickshaw-rush"); }} style={[styles.card, styles.heroCard]}>
          <LinearGradient colors={isDark ? ["#15243A", "#1B304A", "#7A4D14"] : ["#263238", "#37474F", colors.saffron]} style={StyleSheet.absoluteFill} />
          <View style={styles.cardBody}>
            <View style={styles.tagRow}><Ionicons name="flash" size={14} color="#fff" /><Text style={styles.tag}>NEW · ARCADE</Text></View>
            <Text style={styles.cardTitle}>Rickshaw Rush</Text>
            <Text style={styles.cardSub}>Dodge traffic, grab coins, survive the chaos of rush hour.</Text>
          </View>
        </Pressable>

        <GameCard testID="game-trivia-card" onPress={() => router.push("/games/trivia")} image="https://images.unsplash.com/photo-1582217900003-2b19c0e3a7d0?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" gradient={isDark ? ["rgba(17,27,43,0.15)", "rgba(10,17,30,0.94)"] : ["rgba(26,35,126,0.05)", "rgba(26,35,126,0.85)"]} icon="bulb" tag="TRIVIA" title="Travel Trivia — Bharat Edition" sub="Fresh questions every round. Rails, wings & wanderlust." styles={styles} colors={colors} />
        <GameCard testID="game-tap-plane-card" onPress={() => router.push("/games/tap-plane")} image="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" gradient={isDark ? ["rgba(17,27,43,0.05)", "rgba(35,25,12,0.95)"] : ["rgba(255,153,51,0.1)", "rgba(176,92,0,0.85)"]} icon="airplane" tag="ARCADE" title="Tap-the-Plane" sub="Beat your best — tap the plane before it flies off." styles={styles} colors={colors} />
        <GameCard testID="game-memory-match-card" onPress={() => router.push("/games/memory-match")} image="https://images.unsplash.com/photo-1488646953014-85cb44e25828?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" gradient={isDark ? ["rgba(17,27,43,0.05)", "rgba(10,17,30,0.94)"] : ["rgba(26,35,126,0.05)", "rgba(26,35,126,0.85)"]} icon="grid" tag="MEMORY" title="Match the Travel Icons" sub="Flip cards, find pairs, beat your move count." styles={styles} colors={colors} />
        <GameCard testID="game-word-scramble-card" onPress={() => router.push("/games/word-scramble")} image="https://images.unsplash.com/photo-1524661135-423995f22d0b?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" gradient={isDark ? ["rgba(17,27,43,0.05)", "rgba(35,25,12,0.95)"] : ["rgba(255,153,51,0.1)", "rgba(176,92,0,0.85)"]} icon="text" tag="SPEED ROUND" title="Word Scramble" sub="Unscramble Indian cities and travel words before time runs out." styles={styles} colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}

function GameCard({ testID, onPress, image, gradient, icon, tag, title, sub, styles, colors }: any) {
  return (
    <Pressable testID={testID} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={styles.card}>
      <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      <View style={styles.cardBody}>
        <View style={styles.tagRow}><Ionicons name={icon} size={14} color="#fff" /><Text style={styles.tag}>{tag}</Text></View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { fontSize: FONT["2xl"], fontWeight: "800", color: colors.onSurface, fontFamily: FONT_DISPLAY },
  sub: { color: colors.muted, marginTop: 2 },
  introCard: { flexDirection: "row", gap: SPACING.md, alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg },
  introIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  introTitle: { color: colors.onSurface, fontWeight: "800", fontSize: FONT.base },
  introSub: { color: colors.muted, marginTop: 2, lineHeight: 18, fontSize: 12 },
  card: { height: 220, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: SPACING.lg, justifyContent: "flex-end", borderWidth: isDark ? 1 : 0, borderColor: colors.border, shadowColor: "#000", shadowOpacity: isDark ? 0.22 : 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  heroCard: { height: 240, shadowOpacity: isDark ? 0.3 : 0.2 },
  cardBody: { padding: SPACING.lg },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.38)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, alignSelf: "flex-start", marginBottom: SPACING.sm },
  tag: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  cardTitle: { color: "#fff", fontSize: FONT.xl, fontWeight: "800" },
  cardSub: { color: "rgba(255,255,255,0.92)", marginTop: 4, lineHeight: 19 },
});
