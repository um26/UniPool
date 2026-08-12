import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { api } from "@/src/api/client";

type Q = { q: string; options: string[]; answer: number };

export default function Trivia() {
  const router = useRouter();
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { api.trivia().then(setQs).catch(() => setQs([])); }, []);

  if (!qs.length) return <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View>;

  const current = qs[i];

  const pick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === current.answer) { setScore((s) => s + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => {
      if (i + 1 >= qs.length) setDone(true);
      else { setI(i + 1); setPicked(null); }
    }, 900);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <Ionicons name="trophy" size={64} color={COLORS.saffron} />
          <Text style={styles.doneTitle}>Score: {score} / {qs.length}</Text>
          <Text style={styles.doneSub}>{score === qs.length ? "Bharat Yatri, you know it all!" : score >= qs.length / 2 ? "Well travelled!" : "Try again — you'll ace it."}</Text>
          <Pressable testID="trivia-restart" onPress={() => { setDone(false); setI(0); setPicked(null); setScore(0); api.trivia().then(setQs); }} style={styles.btn}><Text style={styles.btnText}>Play again</Text></Pressable>
          <Pressable testID="trivia-back" onPress={() => router.back()} style={[styles.btn, styles.btnGhost]}><Text style={[styles.btnText, { color: COLORS.indigo }]}>Back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable testID="trivia-close" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={COLORS.onSurface} /></Pressable>
        <Text style={styles.progress}>{i + 1} / {qs.length}</Text>
        <Text style={styles.progress}>Score {score}</Text>
      </View>

      <View style={styles.qBox}>
        <Text style={styles.qNum}>Question {i + 1}</Text>
        <Text style={styles.q}>{current.q}</Text>
      </View>

      <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
        {current.options.map((opt, idx) => {
          const correct = picked !== null && idx === current.answer;
          const wrong = picked === idx && picked !== current.answer;
          return (
            <Pressable
              key={idx}
              testID={`trivia-opt-${idx}`}
              onPress={() => pick(idx)}
              style={[styles.opt, correct && styles.optCorrect, wrong && styles.optWrong]}
            >
              <Text style={[styles.optText, (correct || wrong) && { color: "#fff" }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg },
  progress: { color: COLORS.muted, fontWeight: "700" },
  qBox: { backgroundColor: COLORS.indigo, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, padding: SPACING.lg },
  qNum: { color: COLORS.saffron, fontWeight: "800", fontSize: FONT.sm, letterSpacing: 1 },
  q: { color: "#fff", fontSize: FONT.xl, fontWeight: "700", marginTop: 6 },
  opt: { backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  optCorrect: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  optWrong: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  optText: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: "600" },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  doneTitle: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, marginTop: SPACING.md },
  doneSub: { color: COLORS.muted, marginBottom: SPACING.xl, textAlign: "center" },
  btn: { backgroundColor: COLORS.indigo, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.pill, marginTop: SPACING.sm, alignSelf: "stretch", alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.indigo },
  btnText: { color: "#fff", fontWeight: "800" },
});
