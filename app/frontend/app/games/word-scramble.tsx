import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { api } from "@/src/api/client";
import LeaderboardModal from "@/src/components/LeaderboardModal";

const WORDS = [
  "MUMBAI", "DELHI", "JAIPUR", "GOA", "KOLKATA", "CHENNAI",
  "SHIMLA", "MANALI", "AGRA", "PUNE", "SURAT", "INDORE",
  "RICKSHAW", "PLATFORM", "LUGGAGE", "TICKET", "JOURNEY", "HIGHWAY",
];

const ROUND_SECONDS = 15;
const TOTAL_ROUNDS = 8;

function scramble(word: string): string {
  let letters = word.split("");
  let attempt = word;
  let guard = 0;
  while (attempt === word && guard < 10) {
    letters = [...letters].sort(() => Math.random() - 0.5);
    attempt = letters.join("");
    guard++;
  }
  return attempt;
}

function pickWords(): string[] {
  return [...WORDS]
    .map((w) => ({ w, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, TOTAL_ROUNDS)
    .map((x) => x.w);
}

export default function WordScramble() {
  const router = useRouter();
  const [words] = useState<string[]>(() => pickWords());
  const [round, setRound] = useState(0);
  const [scrambled, setScrambled] = useState(() => scramble(words[0]));
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  useEffect(() => {
    if (done) api.submitScore("word-scramble", score).catch(() => {});
  }, [done]);

  const current = words[round];

  const nextRound = useCallback(() => {
    setFeedback(null);
    setGuess("");
    if (round + 1 >= TOTAL_ROUNDS) {
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      const nextIdx = round + 1;
      setRound(nextIdx);
      setScrambled(scramble(words[nextIdx]));
      setTimeLeft(ROUND_SECONDS);
    }
  }, [round, words]);

  useEffect(() => {
    if (done || feedback) return;
    if (timeLeft <= 0) {
      setFeedback("wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(nextRound, 900);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, done, feedback, nextRound]);

  const submit = () => {
    if (feedback) return;
    const correct = guess.trim().toUpperCase() === current;
    if (correct) {
      setScore((s) => s + Math.max(1, Math.ceil(timeLeft / 3)));
      setFeedback("correct");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setFeedback("wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(nextRound, 900);
  };

  const restart = () => {
    const fresh = pickWords();
    words.splice(0, words.length, ...fresh);
    setRound(0);
    setScrambled(scramble(fresh[0]));
    setGuess("");
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setFeedback(null);
    setDone(false);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <Ionicons name="ribbon" size={64} color={COLORS.saffron} />
          <Text style={styles.doneTitle}>Score: {score}</Text>
          <Text style={styles.doneSub}>
            {score >= TOTAL_ROUNDS * 4 ? "Word wizard!" : score >= TOTAL_ROUNDS * 2 ? "Nicely done!" : "Give it another shot!"}
          </Text>
          <Pressable testID="scramble-restart" onPress={restart} style={styles.btn}><Text style={styles.btnText}>Play again</Text></Pressable>
          <Pressable testID="scramble-leaderboard" onPress={() => setShowBoard(true)} style={{ marginTop: SPACING.sm }}>
            <Text style={{ color: COLORS.indigo, fontWeight: "700", textDecorationLine: "underline" }}>View leaderboard</Text>
          </Pressable>
          <Pressable testID="scramble-back" onPress={() => router.back()} style={[styles.btn, styles.btnGhost]}><Text style={[styles.btnText, { color: COLORS.indigo }]}>Back</Text></Pressable>
        </View>
        <LeaderboardModal visible={showBoard} onClose={() => setShowBoard(false)} game="word-scramble" gameLabel="Word Scramble" unit="pts" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable testID="scramble-close" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.progress}>{round + 1} / {TOTAL_ROUNDS}</Text>
        <View style={styles.timerPill}>
          <Ionicons name="time" size={14} color={timeLeft <= 5 ? COLORS.error : COLORS.indigo} />
          <Text style={[styles.timerText, timeLeft <= 5 && { color: COLORS.error }]}>{timeLeft}s</Text>
        </View>
      </View>

      <Text style={styles.scoreText}>Score: {score}</Text>
      <Text style={styles.hint}>Unscramble this Indian travel word</Text>

      <View style={styles.letterRow}>
        {scrambled.split("").map((letter, i) => (
          <View key={i} style={styles.letterBox}>
            <Text style={styles.letterText}>{letter}</Text>
          </View>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          testID="scramble-input"
          value={guess}
          onChangeText={setGuess}
          onSubmitEditing={submit}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Your answer"
          placeholderTextColor={COLORS.muted}
          style={[
            styles.input,
            feedback === "correct" && { borderColor: COLORS.success, backgroundColor: "#E8F9F0" },
            feedback === "wrong" && { borderColor: COLORS.error, backgroundColor: "#FDEDED" },
          ]}
          editable={!feedback}
        />
        <Pressable testID="scramble-submit" onPress={submit} disabled={!!feedback || !guess.trim()} style={[styles.submitBtn, (!!feedback || !guess.trim()) && { opacity: 0.5 }]}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </Pressable>
      </View>

      {feedback === "wrong" && <Text style={styles.answerReveal}>Answer: {current}</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg },
  progress: { color: COLORS.muted, fontWeight: "700" },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surface2, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  timerText: { fontWeight: "800", color: COLORS.indigo },
  scoreText: { textAlign: "center", color: COLORS.muted, fontWeight: "700" },
  hint: { textAlign: "center", fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface, marginTop: SPACING.lg },
  letterRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  letterBox: { width: 44, height: 52, borderRadius: RADIUS.sm, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" },
  letterText: { color: COLORS.cream, fontSize: FONT.xl, fontWeight: "800" },
  inputRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginTop: SPACING.xxl },
  input: { flex: 1, backgroundColor: "#fff", borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface, letterSpacing: 1 },
  submitBtn: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.saffron, alignItems: "center", justifyContent: "center" },
  answerReveal: { textAlign: "center", color: COLORS.error, marginTop: SPACING.md, fontWeight: "700" },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  doneTitle: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, marginTop: SPACING.md },
  doneSub: { color: COLORS.muted, marginBottom: SPACING.xl, textAlign: "center" },
  btn: { backgroundColor: COLORS.indigo, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.pill, marginTop: SPACING.sm, alignSelf: "stretch", alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.indigo },
  btnText: { color: "#fff", fontWeight: "800" },
});
