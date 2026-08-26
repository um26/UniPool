import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { FONT, RADIUS, SPACING } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

type Place = { name: string; clues: [string, string, string] };

const PLACES: Place[] = [
  { name: "Jaipur", clues: ["I am Rajasthan's capital.", "My old city is famous for a pink colour palette.", "Hawa Mahal is one of my best-known landmarks."] },
  { name: "Udaipur", clues: ["I am in southern Rajasthan.", "Lakes shape much of my postcard skyline.", "I am often called the City of Lakes."] },
  { name: "Jaisalmer", clues: ["I sit near the Thar Desert.", "Golden sandstone dominates my old city.", "My fort rises above a famous desert destination."] },
  { name: "Varanasi", clues: ["I am one of India's oldest continuously inhabited cities.", "My ghats line the Ganges.", "Dashashwamedh Ghat is famous for evening aarti."] },
  { name: "Amritsar", clues: ["I am in Punjab.", "A major India–Pakistan border ceremony is a short drive away.", "The Golden Temple is my best-known landmark."] },
  { name: "Kochi", clues: ["I am a major port city in Kerala.", "Fort Kochi is one of my historic quarters.", "Chinese fishing nets are a familiar sight here."] },
  { name: "Mysuru", clues: ["I am in Karnataka.", "I am strongly associated with Dasara celebrations.", "My royal palace is one of India's best-known palaces."] },
  { name: "Hampi", clues: ["I am a UNESCO World Heritage Site in Karnataka.", "Boulder-strewn ruins stretch around me.", "I was the heart of the Vijayanagara Empire."] },
  { name: "Darjeeling", clues: ["I am a hill destination in West Bengal.", "Tea estates cover my slopes.", "A famous Himalayan toy train reaches me."] },
  { name: "Gangtok", clues: ["I am a Himalayan state capital.", "I look toward the Kanchenjunga region.", "I am the capital of Sikkim."] },
  { name: "Srinagar", clues: ["I am in the Kashmir Valley.", "Houseboats are part of my travel identity.", "Dal Lake is my signature attraction."] },
  { name: "Leh", clues: ["I sit at high altitude in a cold desert region.", "Monasteries and dramatic mountain roads surround me.", "I am a major travel hub of Ladakh."] },
  { name: "Puducherry", clues: ["I am a Union Territory city on India's southeast coast.", "French colonial architecture shapes one of my quarters.", "Promenade Beach runs along my seafront."] },
  { name: "Agra", clues: ["I am in Uttar Pradesh.", "I sit on the Yamuna River.", "The Taj Mahal draws travellers to me."] },
  { name: "Rishikesh", clues: ["I am in Uttarakhand.", "Yoga retreats and river rafting both draw visitors.", "The Ganges flows through me near the Himalayan foothills."] },
  { name: "Ooty", clues: ["I am a hill station in Tamil Nadu.", "Tea gardens and cool weather are part of my appeal.", "The Nilgiri Mountain Railway reaches me."] },
  { name: "Munnar", clues: ["I am a hill destination in Kerala.", "Rolling tea plantations define much of my landscape.", "I lie in the Western Ghats."] },
  { name: "Shillong", clues: ["I am a northeastern state capital.", "Waterfalls and rolling hills surround me.", "I am the capital of Meghalaya."] },
  { name: "Goa", clues: ["I am India's smallest state by area.", "Portuguese heritage appears in my churches and old quarters.", "My beaches make me one of India's best-known holiday destinations."] },
  { name: "Mumbai", clues: ["I sit on India's west coast.", "Local trains are central to my daily movement.", "Marine Drive and the Gateway of India are iconic here."] },
];

const TOTAL_ROUNDS = 6;

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function makeRoundOptions(answer: Place) {
  const distractors = shuffled(PLACES.filter((place) => place.name !== answer.name)).slice(0, 3);
  return shuffled([answer.name, ...distractors.map((place) => place.name)]);
}

export default function DestinationDetective() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [places, setPlaces] = useState<Place[]>(() => shuffled(PLACES).slice(0, TOTAL_ROUNDS));
  const [index, setIndex] = useState(0);
  const [clueCount, setClueCount] = useState(1);
  const [options, setOptions] = useState<string[]>(() => makeRoundOptions(places[0]));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = places[index];

  const next = () => {
    if (index + 1 >= places.length) {
      setDone(true);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setClueCount(1);
    setPicked(null);
    setOptions(makeRoundOptions(places[nextIndex]));
  };

  const choose = (option: string) => {
    if (picked) return;
    setPicked(option);
    const correct = option === current.name;
    if (correct) {
      setScore((value) => value + (4 - clueCount));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(next, 1150);
  };

  const restart = () => {
    const fresh = shuffled(PLACES).slice(0, TOTAL_ROUNDS);
    setPlaces(fresh);
    setIndex(0);
    setClueCount(1);
    setOptions(makeRoundOptions(fresh[0]));
    setPicked(null);
    setScore(0);
    setDone(false);
  };

  if (done) {
    const max = TOTAL_ROUNDS * 3;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <View style={styles.detectiveIcon}><Ionicons name="search" size={38} color={colors.saffron} /></View>
          <Text style={styles.doneTitle}>{score} / {max}</Text>
          <Text style={styles.doneSub}>{score >= 15 ? "Sharp traveller. Very few clues needed." : score >= 10 ? "Good instincts — you know your destinations." : "Keep exploring. The clues get easier as you travel more."}</Text>
          <Pressable onPress={restart} style={styles.primary}><Text style={styles.primaryText}>New case</Text></Pressable>
          <Pressable onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>Back to Time-pass</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.progress}>CASE {index + 1} / {places.length}</Text>
        <Text style={styles.progress}>{score} pts</Text>
      </View>

      <View style={styles.clueCard}>
        <View style={styles.tagRow}><Ionicons name="location-outline" size={16} color={colors.saffron} /><Text style={styles.tag}>DESTINATION DETECTIVE</Text></View>
        <Text style={styles.prompt}>Where am I?</Text>
        <View style={styles.clues}>
          {current.clues.slice(0, clueCount).map((clue, clueIndex) => (
            <View key={clue} style={styles.clueRow}>
              <View style={styles.clueNumber}><Text style={styles.clueNumberText}>{clueIndex + 1}</Text></View>
              <Text style={styles.clueText}>{clue}</Text>
            </View>
          ))}
        </View>
        {clueCount < 3 && !picked && (
          <Pressable onPress={() => setClueCount((value) => Math.min(3, value + 1))} style={styles.reveal}>
            <Ionicons name="eye-outline" size={16} color={colors.onSurface} />
            <Text style={styles.revealText}>Reveal another clue · worth {3 - clueCount} pts after</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.options}>
        {options.map((option) => {
          const correct = picked !== null && option === current.name;
          const wrong = picked === option && option !== current.name;
          return (
            <Pressable key={option} onPress={() => choose(option)} style={[styles.option, correct && styles.correct, wrong && styles.wrong]}>
              <Text style={[styles.optionText, (correct || wrong) && { color: "#fff" }]}>{option}</Text>
              {correct && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
              {wrong && <Ionicons name="close-circle" size={20} color="#fff" />}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg },
  progress: { color: colors.muted, fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },
  clueCard: { marginHorizontal: SPACING.lg, borderRadius: RADIUS.xl, padding: SPACING.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  tag: { color: colors.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  prompt: { color: colors.onSurface, fontSize: FONT["2xl"], fontWeight: "900", marginTop: 10 },
  clues: { gap: 10, marginTop: 18 },
  clueRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  clueNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  clueNumberText: { color: colors.indigo, fontWeight: "900", fontSize: 11 },
  clueText: { flex: 1, color: colors.onSurface, fontSize: FONT.base, lineHeight: 22, fontWeight: "600" },
  reveal: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, borderRadius: RADIUS.pill, backgroundColor: colors.surface2, paddingVertical: 11, paddingHorizontal: 12 },
  revealText: { color: colors.onSurface, fontWeight: "800", fontSize: 11 },
  options: { padding: SPACING.lg, gap: 10 },
  option: { minHeight: 56, backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionText: { color: colors.onSurface, fontWeight: "800", fontSize: FONT.base },
  correct: { backgroundColor: colors.success, borderColor: colors.success },
  wrong: { backgroundColor: colors.error, borderColor: colors.error },
  doneWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
  detectiveIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  doneTitle: { color: colors.onSurface, fontSize: 36, fontWeight: "900", marginTop: 18 },
  doneSub: { color: colors.muted, textAlign: "center", maxWidth: 390, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  primary: { width: "100%", maxWidth: 400, backgroundColor: colors.indigo, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondary: { width: "100%", maxWidth: 400, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  secondaryText: { color: colors.onSurface, fontWeight: "800" },
});
