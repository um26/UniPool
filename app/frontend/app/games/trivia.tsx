import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

type Q = { q: string; options: string[]; answer: number };

export default function Trivia() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const loadQuestions = useMemo(() => () => api.trivia().then(setQs).catch(() => setQs([])), []);
  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  if (!qs.length) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.indigo} /><Text style={styles.loadingText}>Finding fresh questions…</Text></View></SafeAreaView>;

  const current = qs[i];

  const pick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === current.answer) { setScore((s) => s + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => {
      if (i + 1 >= qs.length) setDone(true);
      else { setI(i + 1); setPicked(null); }
    }, 850);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <View style={styles.trophy}><Ionicons name="trophy" size={42} color={colors.saffron} /></View>
          <Text style={styles.doneTitle}>Score: {score} / {qs.length}</Text>
          <Text style={styles.doneSub}>{score === qs.length ? "Bharat Yatri, you know it all!" : score >= qs.length / 2 ? "Well travelled!" : "Try again — you'll ace it."}</Text>
          <Pressable onPress={() => { setDone(false); setI(0); setPicked(null); setScore(0); loadQuestions(); }} style={styles.btn}><Text style={styles.btnText}>Fresh round</Text></Pressable>
          <Pressable onPress={() => router.back()} style={[styles.btn, styles.btnGhost]}><Text style={[styles.btnText, { color: colors.indigo }]}>Back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.progress}>{i + 1} / {qs.length}</Text>
        <Text style={styles.progress}>Score {score}</Text>
      </View>

      <View style={styles.qBox}>
        <View style={styles.qTop}><Text style={styles.qNum}>QUESTION {i + 1}</Text><Ionicons name="sparkles" size={16} color={colors.saffron} /></View>
        <Text style={styles.q}>{current.q}</Text>
      </View>

      <View style={styles.options}>
        {current.options.map((opt, idx) => {
          const correct = picked !== null && idx === current.answer;
          const wrong = picked === idx && picked !== current.answer;
          return (
            <Pressable key={idx} onPress={() => pick(idx)} style={[styles.opt, correct && styles.optCorrect, wrong && styles.optWrong]}>
              <View style={[styles.optionIndex, { borderColor: correct || wrong ? "rgba(255,255,255,0.45)" : colors.border }]}><Text style={[styles.optionIndexText, { color: correct || wrong ? "#fff" : colors.muted }]}>{String.fromCharCode(65 + idx)}</Text></View>
              <Text style={[styles.optText, (correct || wrong) && { color: "#fff" }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 8 },
  loadingText: { color: colors.muted, fontSize: FONT.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg },
  progress: { color: colors.muted, fontWeight: "700" },
  qBox: { backgroundColor: colors.indigo, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, padding: SPACING.lg, shadowColor: colors.indigo, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  qTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qNum: { color: colors.saffron, fontWeight: "900", fontSize: FONT.sm, letterSpacing: 1.2 },
  q: { color: "#fff", fontSize: FONT.xl, fontWeight: "700", marginTop: 8, lineHeight: 28 },
  options: { padding: SPACING.lg, gap: SPACING.md },
  opt: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: colors.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: colors.border, minHeight: 58 },
  optCorrect: { backgroundColor: colors.success, borderColor: colors.success },
  optWrong: { backgroundColor: colors.error, borderColor: colors.error },
  optionIndex: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  optionIndexText: { fontWeight: "800", fontSize: 12 },
  optText: { flex: 1, fontSize: FONT.base, color: colors.onSurface, fontWeight: "600" },
  trophy: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  doneTitle: { fontSize: FONT["2xl"], fontWeight: "800", color: colors.onSurface, marginTop: SPACING.lg },
  doneSub: { color: colors.muted, marginBottom: SPACING.xl, textAlign: "center", marginTop: 5 },
  btn: { backgroundColor: colors.indigo, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.pill, marginTop: SPACING.sm, alignSelf: "stretch", alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.indigo },
  btnText: { color: "#fff", fontWeight: "800" },
});
