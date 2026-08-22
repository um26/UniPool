import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";

export default function GamesHub() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Time-pass</Text>
        <Text style={styles.sub}>A little fun for the wait</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}>
        <Pressable testID="game-rickshaw-rush-card" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/games/rickshaw-rush"); }} style={[styles.card, styles.heroCard]}>
          <LinearGradient colors={["#263238", "#37474F", COLORS.saffron]} style={StyleSheet.absoluteFill} />
          <View style={styles.cardBody}><View style={[styles.tagRow, { backgroundColor: "rgba(255,153,51,0.35)" }]}><Ionicons name="flash" size={14} color="#fff" /><Text style={styles.tag}>NEW · ARCADE</Text></View><Text style={styles.cardTitle}>Rickshaw Rush</Text><Text style={styles.cardSub}>Dodge traffic, grab coins, survive the chaos of rush hour.</Text></View>
        </Pressable>
        <Pressable testID="game-trivia-card" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/games/trivia"); }} style={styles.card}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1582217900003-2b19c0e3a7d0?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" }} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={["rgba(26,35,126,0.05)", "rgba(26,35,126,0.85)"]} style={StyleSheet.absoluteFill} /><View style={styles.cardBody}><View style={styles.tagRow}><Ionicons name="bulb" size={14} color={COLORS.cream} /><Text style={styles.tag}>TRIVIA</Text></View><Text style={styles.cardTitle}>Travel Trivia — Bharat Edition</Text><Text style={styles.cardSub}>5 quick questions. Rails, wings & wanderlust.</Text></View>
        </Pressable>
        <Pressable testID="game-tap-plane-card" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/games/tap-plane"); }} style={styles.card}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" }} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={["rgba(255,153,51,0.1)", "rgba(176,92,0,0.85)"]} style={StyleSheet.absoluteFill} /><View style={styles.cardBody}><View style={styles.tagRow}><Ionicons name="airplane" size={14} color={COLORS.cream} /><Text style={styles.tag}>ARCADE</Text></View><Text style={styles.cardTitle}>Tap-the-Plane</Text><Text style={styles.cardSub}>Beat your best — tap the plane before it flies off.</Text></View>
        </Pressable>
        <Pressable testID="game-memory-match-card" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/games/memory-match"); }} style={styles.card}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" }} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={["rgba(26,35,126,0.05)", "rgba(26,35,126,0.85)"]} style={StyleSheet.absoluteFill} /><View style={styles.cardBody}><View style={styles.tagRow}><Ionicons name="grid" size={14} color={COLORS.cream} /><Text style={styles.tag}>MEMORY</Text></View><Text style={styles.cardTitle}>Match the Travel Icons</Text><Text style={styles.cardSub}>Flip cards, find pairs, beat your move count.</Text></View>
        </Pressable>
        <Pressable testID="game-word-scramble-card" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/games/word-scramble"); }} style={styles.card}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85" }} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={["rgba(255,153,51,0.1)", "rgba(176,92,0,0.85)"]} style={StyleSheet.absoluteFill} /><View style={styles.cardBody}><View style={styles.tagRow}><Ionicons name="text" size={14} color={COLORS.cream} /><Text style={styles.tag}>SPEED ROUND</Text></View><Text style={styles.cardTitle}>Word Scramble</Text><Text style={styles.cardSub}>Unscramble Indian cities before time runs out.</Text></View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface }, header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md }, title: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, fontFamily: FONT_DISPLAY }, sub: { color: COLORS.muted, marginTop: 2 },
  card: { height: 220, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: SPACING.lg, justifyContent: "flex-end", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, heroCard: { height: 240, shadowOpacity: 0.25, shadowRadius: 18 }, cardBody: { padding: SPACING.lg }, tagRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, alignSelf: "flex-start", marginBottom: SPACING.sm }, tag: { color: COLORS.cream, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }, cardTitle: { color: "#fff", fontSize: FONT.xl, fontWeight: "800" }, cardSub: { color: "rgba(255,255,255,0.92)", marginTop: 4 },
});
