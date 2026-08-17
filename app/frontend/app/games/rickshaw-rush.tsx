import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from "react-native-reanimated";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { api } from "@/src/api/client";
import LeaderboardModal from "@/src/components/LeaderboardModal";

const { width: SCREEN_W } = Dimensions.get("window");
const ROAD_W = Math.min(SCREEN_W - SPACING.lg * 2, 420);
const LANES = 3;
const LANE_W = ROAD_W / LANES;
const ROAD_H = 520;
const RICKSHAW_Y = ROAD_H - 96;
const RICKSHAW_SIZE = 52;
const TICK_MS = 40;

type Obj = { id: number; lane: number; y: number; kind: "hazard" | "coin"; icon: string; color: string };

const HAZARDS = [
  { icon: "car", color: "#455A64" },
  { icon: "bus", color: "#37474F" },
  { icon: "paw", color: "#6D4C41" },
];

let objId = 0;

export default function RickshawRush() {
  const router = useRouter();
  const [lane, setLane] = useState(1);
  const [objects, setObjects] = useState<Obj[]>([]);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [best, setBest] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  const laneX = useSharedValue(LANE_W); // lane 1 (middle) initial x offset
  const speedRef = useRef(6);
  const spawnCooldownRef = useRef(0);
  const tickCountRef = useRef(0);
  const laneRef = useRef(1);
  const runningRef = useRef(false);
  const bump = useSharedValue(1);

  useEffect(() => { laneRef.current = lane; }, [lane]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const moveLane = useCallback((dir: -1 | 1) => {
    if (!runningRef.current) return;
    const next = Math.min(LANES - 1, Math.max(0, laneRef.current + dir));
    if (next === laneRef.current) return;
    setLane(next);
    laneX.value = withSpring(next * LANE_W, { damping: 16, stiffness: 180 });
    Haptics.selectionAsync();
  }, []);

  const endGame = useCallback(() => {
    setRunning(false);
    setGameOver(true);
    setBest((b) => Math.max(b, score));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    api.submitScore("rickshaw-rush", score).catch(() => {});
  }, [score]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      tickCountRef.current += 1;

      // difficulty ramps with survival time
      speedRef.current = Math.min(16, 6 + tickCountRef.current / 220);

      setObjects((prev) => {
        let next = prev
          .map((o) => ({ ...o, y: o.y + speedRef.current }))
          .filter((o) => o.y < ROAD_H + 60);

        // collision check against rickshaw band
        const hitBandTop = RICKSHAW_Y - 10;
        const hitBandBottom = RICKSHAW_Y + RICKSHAW_SIZE - 10;
        const survivors: Obj[] = [];
        for (const o of next) {
          const inBand = o.y + 40 > hitBandTop && o.y < hitBandBottom;
          if (inBand && o.lane === laneRef.current) {
            if (o.kind === "coin") {
              setCoins((c) => c + 1);
              setScore((s) => s + 5);
              bump.value = withTiming(1.25, { duration: 90 }, () => {
                bump.value = withTiming(1, { duration: 140 });
              });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              continue; // consumed
            } else {
              survivors.push(o);
              // defer game over to outside the updater
              setTimeout(() => endGame(), 0);
              continue;
            }
          }
          survivors.push(o);
        }
        return survivors;
      });

      setScore((s) => (runningRef.current ? s + 1 : s));

      spawnCooldownRef.current -= 1;
      if (spawnCooldownRef.current <= 0) {
        const minGap = Math.max(14, 34 - Math.floor(tickCountRef.current / 150));
        spawnCooldownRef.current = minGap + Math.floor(Math.random() * 10);
        const isCoin = Math.random() < 0.32;
        const h = HAZARDS[Math.floor(Math.random() * HAZARDS.length)];
        setObjects((prev) => [
          ...prev,
          {
            id: objId++,
            lane: Math.floor(Math.random() * LANES),
            y: -40,
            kind: isCoin ? "coin" : "hazard",
            icon: isCoin ? "cash" : h.icon,
            color: isCoin ? COLORS.saffron : h.color,
          },
        ]);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [running, endGame]);

  const start = () => {
    setObjects([]);
    setScore(0);
    setCoins(0);
    setLane(1);
    laneX.value = LANE_W;
    speedRef.current = 6;
    tickCountRef.current = 0;
    spawnCooldownRef.current = 20;
    setGameOver(false);
    setRunning(true);
  };

  const rickshawStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: laneX.value }, { scale: bump.value }],
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable testID="rickshaw-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: SPACING.md }}>
          <View style={styles.stat}><Ionicons name="speedometer" size={14} color={COLORS.indigo} /><Text style={styles.statText}>{score}</Text></View>
          <View style={styles.stat}><Ionicons name="logo-usd" size={14} color={COLORS.saffron} /><Text style={styles.statText}>{coins}</Text></View>
          <View style={styles.stat}><Ionicons name="trophy" size={14} color={COLORS.indigo} /><Text style={styles.statText}>{best}</Text></View>
        </View>
      </View>

      <Text style={styles.title}>Rickshaw Rush</Text>
      <Text style={styles.sub}>Swipe lanes, dodge traffic, grab the ₹ coins</Text>

      <View style={styles.roadWrap}>
        <View style={[styles.road, { width: ROAD_W, height: ROAD_H }]}>
          <LinearGradient colors={["#37474F", "#263238"]} style={StyleSheet.absoluteFill} />
          {/* lane dividers */}
          {[1, 2].map((i) => (
            <View key={i} style={[styles.laneDivider, { left: i * LANE_W - 1 }]} />
          ))}

          {objects.map((o) => (
            <View
              key={o.id}
              style={[
                styles.obj,
                {
                  left: o.lane * LANE_W + LANE_W / 2 - 22,
                  top: o.y,
                  backgroundColor: o.kind === "coin" ? "#FFF3D6" : o.color,
                  borderColor: o.kind === "coin" ? COLORS.saffron : "rgba(0,0,0,0.25)",
                },
              ]}
            >
              <Ionicons name={o.icon as any} size={22} color={o.kind === "coin" ? COLORS.saffron : "#fff"} />
            </View>
          ))}

          <Animated.View style={[styles.rickshaw, { top: RICKSHAW_Y }, rickshawStyle]}>
            <Ionicons name="car-sport" size={30} color={COLORS.indigo} />
          </Animated.View>

          {/* tap zones */}
          {!gameOver && (
            <>
              <Pressable testID="lane-left" onPress={() => moveLane(-1)} style={styles.tapZoneLeft} />
              <Pressable testID="lane-right" onPress={() => moveLane(1)} style={styles.tapZoneRight} />
            </>
          )}

          {!running && !gameOver && (
            <View style={styles.overlay}>
              <Ionicons name="car-sport" size={56} color={COLORS.saffron} />
              <Text style={styles.overlayTitle}>Ready to ride?</Text>
              <Text style={styles.overlaySub}>Tap left/right side of the road to switch lanes</Text>
              <Pressable testID="rickshaw-start" onPress={start} style={styles.startBtn}>
                <Text style={styles.startText}>Start</Text>
              </Pressable>
            </View>
          )}

          {gameOver && (
            <View style={styles.overlay}>
              <Ionicons name="flash" size={56} color={COLORS.error} />
              <Text style={styles.overlayTitle}>Crashed! Score {score}</Text>
              <Text style={styles.overlaySub}>{coins} coins collected · Best {best}</Text>
              <Pressable testID="rickshaw-restart" onPress={start} style={styles.startBtn}>
                <Text style={styles.startText}>Ride again</Text>
              </Pressable>
              <Pressable testID="rickshaw-leaderboard" onPress={() => setShowBoard(true)} style={{ marginTop: SPACING.md }}>
                <Text style={{ color: "#fff", fontWeight: "700", textDecorationLine: "underline" }}>View leaderboard</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <LeaderboardModal visible={showBoard} onClose={() => setShowBoard(false)} game="rickshaw-rush" gameLabel="Rickshaw Rush" unit="pts" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surface2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  statText: { color: COLORS.onSurface, fontWeight: "800" },
  title: { fontSize: FONT.xl, fontWeight: "800", color: COLORS.onSurface, textAlign: "center" },
  sub: { color: COLORS.muted, textAlign: "center", marginTop: 4, marginBottom: SPACING.md },
  roadWrap: { flex: 1, alignItems: "center" },
  road: { borderRadius: RADIUS.lg, overflow: "hidden", position: "relative", borderWidth: 3, borderColor: "#1A2327" },
  laneDivider: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.15)" },
  obj: { position: "absolute", width: 44, height: 40, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  rickshaw: { position: "absolute", width: RICKSHAW_SIZE, height: RICKSHAW_SIZE, borderRadius: RADIUS.md, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center", left: 0, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  tapZoneLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%" },
  tapZoneRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,25,30,0.82)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  overlayTitle: { color: "#fff", fontSize: FONT.xl, fontWeight: "800", marginTop: SPACING.md, textAlign: "center" },
  overlaySub: { color: "rgba(255,255,255,0.8)", marginTop: 4, marginBottom: SPACING.lg, textAlign: "center" },
  startBtn: { backgroundColor: COLORS.saffron, paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADIUS.pill },
  startText: { color: "#fff", fontWeight: "800", fontSize: FONT.lg },
});
