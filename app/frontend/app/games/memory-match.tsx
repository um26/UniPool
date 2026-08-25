import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from "react-native-reanimated";

import { SPACING, RADIUS, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";
import LeaderboardModal from "@/src/components/LeaderboardModal";

const ICONS = ["car-sport", "airplane", "boat", "bicycle", "compass", "map"] as const;
type IconName = (typeof ICONS)[number];
type Card = { id: number; icon: IconName; flipped: boolean; matched: boolean };

function buildDeck(): Card[] {
  const pairs = [...ICONS, ...ICONS];
  const shuffled = pairs.map((icon) => ({ icon, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map((x) => x.icon);
  return shuffled.map((icon, id) => ({ id, icon, flipped: false, matched: false }));
}

export default function MemoryMatch() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cards, setCards] = useState<Card[]>(() => buildDeck());
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (cards.every((c) => c.matched)) {
      setRunning(false); setWon(true); setBest((b) => (b === null ? moves : Math.min(b, moves)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      api.submitScore("memory-match", moves).catch(() => {});
    }
  }, [cards]);

  const flip = (id: number) => {
    if (lockRef.current || won) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    const next = cards.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    setCards(next);
    const nowSelected = [...selected, id];
    setSelected(nowSelected);
    Haptics.selectionAsync();
    if (nowSelected.length === 2) {
      lockRef.current = true; setMoves((m) => m + 1);
      const [a, b] = nowSelected;
      const cardA = next.find((c) => c.id === a)!; const cardB = next.find((c) => c.id === b)!;
      if (cardA.icon === cardB.icon) {
        setTimeout(() => { setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c))); setSelected([]); lockRef.current = false; }, 350);
      } else {
        setTimeout(() => { setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c))); setSelected([]); lockRef.current = false; }, 700);
      }
    }
  };

  const restart = () => { setCards(buildDeck()); setSelected([]); setMoves(0); setSeconds(0); setRunning(true); setWon(false); lockRef.current = false; };
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0"); const ss = String(seconds % 60).padStart(2, "0");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable testID="memory-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <View style={{ flexDirection: "row", gap: SPACING.lg }}>
          <View style={styles.stat}><Ionicons name="footsteps" size={14} color={colors.indigo} /><Text style={styles.statText}>{moves}</Text></View>
          <View style={styles.stat}><Ionicons name="time" size={14} color={colors.indigo} /><Text style={styles.statText}>{mm}:{ss}</Text></View>
        </View>
      </View>
      <Text style={styles.title}>Match the Travel Icons</Text>
      <Text style={styles.sub}>Find all 6 pairs in as few moves as possible</Text>
      <View style={styles.grid}>{cards.map((c) => <FlipCard key={c.id} card={c} onPress={() => flip(c.id)} colors={colors} styles={styles} />)}</View>
      {won && (
        <View style={styles.winOverlay}>
          <View style={styles.winCard}>
            <Ionicons name="trophy" size={48} color={colors.saffron} />
            <Text style={styles.winTitle}>Solved in {moves} moves!</Text>
            <Text style={styles.winSub}>{mm}:{ss} · Best: {best} moves</Text>
            <Pressable testID="memory-restart" onPress={restart} style={styles.playAgainBtn}><Text style={styles.playAgainText}>Play again</Text></Pressable>
            <Pressable testID="memory-leaderboard" onPress={() => setShowBoard(true)} style={{ marginTop: SPACING.md }}><Text style={styles.link}>View leaderboard</Text></Pressable>
          </View>
        </View>
      )}
      <LeaderboardModal visible={showBoard} onClose={() => setShowBoard(false)} game="memory-match" gameLabel="Match the Travel Icons" unit="moves" />
    </SafeAreaView>
  );
}

function FlipCard({ card, onPress, colors, styles }: { card: Card; onPress: () => void; colors: any; styles: any }) {
  const scale = useSharedValue(1); const revealed = card.flipped || card.matched;
  useEffect(() => { scale.value = withSequence(withTiming(0.85, { duration: 90 }), withSpring(1)); }, [revealed]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Pressable testID={`card-${card.id}`} onPress={onPress} style={styles.cardSlot}><Animated.View style={[styles.card, revealed ? styles.cardFront : styles.cardBack, card.matched && styles.cardMatched, animated]}>{revealed ? <Ionicons name={card.icon as any} size={30} color={card.matched ? colors.success : colors.indigo} /> : <Ionicons name="help" size={22} color={colors.cream} />}</Animated.View></Pressable>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  statText: { color: colors.onSurface, fontWeight: "800" },
  title: { fontSize: FONT.xl, fontWeight: "800", color: colors.onSurface, textAlign: "center", marginTop: SPACING.sm },
  sub: { color: colors.muted, textAlign: "center", marginTop: 4, marginBottom: SPACING.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingHorizontal: SPACING.md, gap: SPACING.sm },
  cardSlot: { width: "27%", aspectRatio: 1, margin: "1.5%" },
  card: { flex: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  cardBack: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  cardFront: { backgroundColor: colors.card, borderColor: colors.border },
  cardMatched: { backgroundColor: colors.surface2, borderColor: colors.success },
  winOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  winCard: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: "center", width: "100%", borderWidth: 1, borderColor: colors.border },
  winTitle: { fontSize: FONT.xl, fontWeight: "800", color: colors.onSurface, marginTop: SPACING.md },
  winSub: { color: colors.muted, marginTop: 4, marginBottom: SPACING.lg },
  playAgainBtn: { backgroundColor: colors.saffron, borderRadius: RADIUS.pill, paddingHorizontal: 28, paddingVertical: 14 },
  playAgainText: { color: "#fff", fontWeight: "800", fontSize: FONT.lg },
  link: { color: colors.indigo, fontWeight: "700", textDecorationLine: "underline" },
});
