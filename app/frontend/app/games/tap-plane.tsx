import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from "react-native-reanimated";

import { SPACING, RADIUS, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";
import LeaderboardModal from "@/src/components/LeaderboardModal";

const { width, height } = Dimensions.get("window");
const AREA_HEIGHT = Math.min(560, height * 0.62);
const PLANE = 64;

export default function TapPlane() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const x = useSharedValue(0); const y = useSharedValue(0);
  const [running, setRunning] = useState(false); const [score, setScore] = useState(0); const [best, setBest] = useState(0); const [timeLeft, setTimeLeft] = useState(30); const [showBoard, setShowBoard] = useState(false);
  const timerRef = useRef<any>(null); const submittedRef = useRef(false);

  const spawn = () => {
    const maxX = width - PLANE - 32; const maxY = AREA_HEIGHT - PLANE - 16;
    x.value = withTiming(Math.random() * maxX, { duration: 0 }); y.value = withTiming(Math.random() * maxY, { duration: 0 });
  };
  const start = () => {
    setScore(0); setTimeLeft(30); setRunning(true); submittedRef.current = false; spawn();
    timerRef.current = setInterval(() => setTimeLeft((t) => { if (t <= 1) { clearInterval(timerRef.current); setRunning(false); setBest((b) => Math.max(b, score)); return 0; } return t - 1; }), 1000);
  };
  useEffect(() => { if (!running && score > 0 && !submittedRef.current) { submittedRef.current = true; setBest((b) => Math.max(b, score)); api.submitScore("tap-plane", score).catch(() => {}); } }, [running, score]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); cancelAnimation(x); cancelAnimation(y); }, []);
  const tap = () => { if (!running) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setScore((s) => s + 1); spawn(); };
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={isDark ? [colors.surface2, colors.surface3] : ["#0D47A1", colors.indigo]} style={styles.header}>
        <Pressable testID="plane-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color="#fff" /></Pressable>
        <View style={{ flexDirection: "row", gap: SPACING.lg }}>
          <View style={styles.stat}><Ionicons name="star" size={14} color={colors.saffron} /><Text style={styles.statText}>{score}</Text></View>
          <View style={styles.stat}><Ionicons name="time" size={14} color={colors.cream} /><Text style={styles.statText}>{timeLeft}s</Text></View>
          <Pressable testID="plane-leaderboard" onPress={() => setShowBoard(true)} style={styles.stat}><Ionicons name="trophy" size={14} color={colors.cream} /><Text style={styles.statText}>{best}</Text></Pressable>
        </View>
      </LinearGradient>
      <View style={styles.arena}>
        <LinearGradient colors={isDark ? ["#101C2D", "#172A43", "#203C5A"] : ["#E3F2FD", "#BBDEFB", "#90CAF9"]} style={StyleSheet.absoluteFill} />
        {[...Array(6)].map((_, i) => <View key={i} style={[styles.cloud, { top: (i * 90) % AREA_HEIGHT, left: (i * 60 + 20) % (width - 60) }]} />)}
        {running && <Animated.View style={[{ position: "absolute" }, style]}><Pressable testID="tap-plane" onPress={tap} style={styles.plane}><Ionicons name="airplane" size={44} color={colors.indigo} /></Pressable></Animated.View>}
        {!running && <View style={styles.overlay}><Ionicons name="airplane" size={64} color={colors.indigo} /><Text style={styles.overlayTitle}>{timeLeft === 30 ? "Tap-the-Plane" : `Time up! Score ${score}`}</Text><Text style={styles.overlaySub}>Tap as many planes as you can in 30 seconds.</Text><Pressable testID="plane-start" onPress={start} style={styles.startBtn}><Text style={styles.startText}>{timeLeft === 30 ? "Start" : "Play again"}</Text></Pressable>{timeLeft !== 30 && <Pressable testID="plane-view-leaderboard" onPress={() => setShowBoard(true)} style={{ marginTop: SPACING.md }}><Text style={styles.link}>View leaderboard</Text></Pressable>}</View>}
      </View>
      <LeaderboardModal visible={showBoard} onClose={() => setShowBoard(false)} game="tap-plane" gameLabel="Tap-the-Plane" unit="taps" />
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  statText: { color: "#fff", fontWeight: "800" },
  arena: { height: AREA_HEIGHT, margin: SPACING.lg, borderRadius: RADIUS.lg, overflow: "hidden", borderWidth: 2, borderColor: colors.borderStrong },
  cloud: { position: "absolute", width: 60, height: 20, borderRadius: 20, backgroundColor: isDark ? "rgba(160,190,225,0.14)" : "rgba(255,255,255,0.7)" },
  plane: { width: PLANE, height: PLANE, borderRadius: PLANE / 2, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, backgroundColor: isDark ? "rgba(7,14,25,0.68)" : "rgba(227,242,253,0.6)" },
  overlayTitle: { fontSize: FONT.xl, fontWeight: "800", color: colors.onSurface, marginTop: SPACING.md },
  overlaySub: { color: colors.muted, marginTop: 4, textAlign: "center", marginBottom: SPACING.lg },
  startBtn: { backgroundColor: colors.saffron, paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADIUS.pill },
  startText: { color: "#fff", fontWeight: "800", fontSize: FONT.lg },
  link: { color: colors.indigo, fontWeight: "700", textDecorationLine: "underline" },
});
