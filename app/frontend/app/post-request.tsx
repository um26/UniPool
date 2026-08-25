import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISTParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return { date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`, time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}` };
}
function istPartsToUTCISO(date: string, time: string) {
  const asUTC = new Date(`${date}T${time}:00.000Z`).getTime();
  return new Date(asUTC - IST_OFFSET_MS).toISOString();
}

export default function PostRequestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditing = !!edit;
  const now = new Date();
  const defaultDate = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultIst = toISTParts(defaultDate);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(defaultIst.date);
  const [time, setTime] = useState(defaultIst.time);
  const [genderPref, setGenderPref] = useState<"any" | "same">("any");
  const [companions, setCompanions] = useState(0);
  const [luggage, setLuggage] = useState("");
  const [notes, setNotes] = useState("");
  const [tripMode, setTripMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const mine = await api.myPools();
        const pool = mine.find((p: any) => p.pool_id === edit);
        if (!pool) { Alert.alert("Not found", "This query no longer exists."); router.back(); return; }
        setFrom(pool.from_location); setTo(pool.to_location);
        const ist = toISTParts(new Date(pool.travel_datetime));
        setDate(ist.date); setTime(ist.time);
        setGenderPref(pool.gender_preference || "any"); setCompanions(pool.companions || 0); setLuggage(pool.luggage || ""); setNotes(pool.notes || "");
      } catch (e: any) { Alert.alert("Error", e.message); router.back(); }
      finally { setLoadingExisting(false); }
    })();
  }, [isEditing, edit]);

  const swapRoute = () => { setFrom(to); setTo(from); Haptics.selectionAsync(); };
  const applyDatePreset = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    const ist = toISTParts(d); setDate(ist.date);
    if (days === 0) setTime(toISTParts(new Date(Date.now() + 60 * 60 * 1000)).time);
    Haptics.selectionAsync();
  };

  const quality = useMemo(() => {
    let score = 0;
    if (from.trim()) score += 25;
    if (to.trim()) score += 25;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) score += 25;
    if (notes.trim() || luggage.trim() || companions > 0 || genderPref === "same") score += 15;
    if (tripMode) score += 10;
    return score;
  }, [from, to, date, time, notes, luggage, companions, genderPref, tripMode]);
  const qualityLabel = quality >= 90 ? "Excellent" : quality >= 70 ? "Strong" : quality >= 45 ? "Good" : "Add a few details";

  const submit = async () => {
    if (!from.trim() || !to.trim()) return Alert.alert("Missing", "From & To are required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return Alert.alert("Invalid time", "Use YYYY-MM-DD and HH:MM in IST.");
    const iso = istPartsToUTCISO(date, time);
    setSubmitting(true);
    try {
      const payload = { from_location: from.trim(), to_location: to.trim(), travel_datetime: iso, gender_preference: genderPref, companions, luggage: luggage.trim() || null, notes: notes.trim() || null };
      if (isEditing) await api.updatePool(edit as string, payload); else await api.createPool(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.back();
    } catch (e: any) { Alert.alert("Could not post", e.message || "Try again"); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="close-post" onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
          <View><Text style={styles.title}>{isEditing ? "Edit Pool" : "Plan your ride"}</Text><Text style={styles.subtitle}>Better details = better matches</Text></View>
          <View style={{ width: 26 }} />
        </View>

        {loadingExisting ? <View style={styles.loading}><ActivityIndicator color={colors.indigo} /></View> : (
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
            <View style={styles.qualityCard}>
              <View style={styles.qualityTop}><View><Text style={styles.qualityEyebrow}>MATCH QUALITY</Text><Text style={styles.qualityTitle}>{qualityLabel}</Text></View><Text style={styles.qualityScore}>{quality}%</Text></View>
              <View style={styles.qualityTrack}><View style={[styles.qualityFill, { width: `${quality}%` }]} /></View>
              <Text style={styles.qualityHint}>Add useful context so people can decide faster and the matching system has more signal.</Text>
            </View>

            <View style={styles.routeInputs}>
              <View style={{ flex: 1 }}>
                <Field label="From" styles={styles}><TextInput testID="from-input" value={from} onChangeText={setFrom} placeholder="e.g. Mahindra University" style={styles.input} placeholderTextColor={colors.muted} /></Field>
                <Field label="To" styles={styles}><TextInput testID="to-input" value={to} onChangeText={setTo} placeholder="e.g. RGI Airport" style={styles.input} placeholderTextColor={colors.muted} /></Field>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Swap from and to locations" testID="swap-route" onPress={swapRoute} style={styles.swapBtn}><Ionicons name="swap-vertical" size={19} color={colors.indigo} /></Pressable>
            </View>

            <Text style={styles.sectionHint}>When are you leaving?</Text>
            <View style={styles.presetRow}>
              {[0, 1, 2].map((days) => {
                const presetDate = toISTParts(new Date(Date.now() + days * 86400000)).date;
                return <Pressable key={days} onPress={() => applyDatePreset(days)} style={[styles.preset, date === presetDate && styles.presetActive]}><Text style={[styles.presetText, date === presetDate && styles.presetTextActive]}>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : "In 2 days"}</Text></Pressable>;
              })}
            </View>
            <View style={{ flexDirection: "row", gap: SPACING.md }}>
              <Field style={{ flex: 1 }} label="Date · IST" styles={styles}><TextInput testID="date-input" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} placeholderTextColor={colors.muted} /></Field>
              <Field style={{ flex: 1 }} label="Time · IST" styles={styles}><TextInput testID="time-input" value={time} onChangeText={setTime} placeholder="HH:MM" style={styles.input} placeholderTextColor={colors.muted} /></Field>
            </View>

            <Field label="Who should ride with you?" styles={styles}>
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                {(["any", "same"] as const).map((g) => <Pressable key={g} testID={`gender-pref-${g}`} onPress={() => { Haptics.selectionAsync(); setGenderPref(g); }} style={[styles.segment, genderPref === g && styles.segmentActive]}><Text style={[styles.segmentText, genderPref === g && { color: "#fff" }]}>{g === "any" ? "Anyone" : "Same gender"}</Text></Pressable>)}
              </View>
            </Field>

            <View style={styles.inlineRow}>
              <Field style={{ flex: 1 }} label="Companions" styles={styles}><View style={styles.stepper}><Pressable testID="comp-minus" onPress={() => setCompanions(Math.max(0, companions - 1))} style={styles.stepBtn}><Ionicons name="remove" size={20} color={colors.onSurface} /></Pressable><Text style={styles.stepVal}>{companions}</Text><Pressable testID="comp-plus" onPress={() => setCompanions(Math.min(6, companions + 1))} style={styles.stepBtn}><Ionicons name="add" size={20} color={colors.onSurface} /></Pressable></View></Field>
              <Field style={{ flex: 1 }} label="Luggage" styles={styles}><TextInput testID="luggage-input" value={luggage} onChangeText={setLuggage} placeholder="1 suitcase" style={styles.input} placeholderTextColor={colors.muted} /></Field>
            </View>

            <Pressable testID="trip-mode-toggle" onPress={() => { setTripMode((v) => !v); Haptics.selectionAsync(); }} style={[styles.tripCard, tripMode && styles.tripCardActive]}>
              <View style={[styles.tripIcon, tripMode && styles.tripIconActive]}><Ionicons name="navigate" size={18} color={tripMode ? "#fff" : colors.indigo} /></View>
              <View style={{ flex: 1 }}><Text style={styles.tripTitle}>Trip mode</Text><Text style={styles.tripSub}>{tripMode ? "On · prioritise practical, time-sensitive ride details." : "Optional · keep your trip tools focused when travelling."}</Text></View>
              <Ionicons name={tripMode ? "checkmark-circle" : "ellipse-outline"} size={22} color={tripMode ? colors.saffron : colors.muted} />
            </Pressable>

            <Field label="Notes for fellow travellers" styles={styles}>
              <TextInput testID="notes-input" value={notes} onChangeText={(v) => setNotes(v.slice(0, 240))} placeholder="Pickup landmark, luggage detail, flexibility…" style={[styles.input, { height: 84, textAlignVertical: "top" }]} multiline maxLength={240} placeholderTextColor={colors.muted} />
              <Text style={styles.counter}>{notes.length}/240</Text>
            </Field>
          </ScrollView>
        )}

        <View style={styles.footer}><Pressable testID="submit-pool" disabled={submitting || loadingExisting} onPress={submit} style={[styles.submit, (submitting || loadingExisting) && { opacity: 0.6 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <><Ionicons name={isEditing ? "checkmark" : "paper-plane"} size={18} color="#fff" /><Text style={styles.submitText}>{isEditing ? "Save Changes" : "Find my ride"}</Text></>}</Pressable></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, style, styles }: any) { return <View style={[{ marginBottom: SPACING.lg }, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: FONT.xl, fontWeight: "900", color: colors.onSurface, textAlign: "center" }, subtitle: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 2 },
  qualityCard: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 20 }, qualityTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, qualityEyebrow: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, qualityTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", marginTop: 3 }, qualityScore: { color: colors.saffron, fontSize: 22, fontWeight: "900" }, qualityTrack: { height: 7, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden", marginTop: 12 }, qualityFill: { height: "100%", backgroundColor: colors.saffron, borderRadius: 4 }, qualityHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  routeInputs: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm }, swapBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.lg },
  sectionHint: { color: colors.onSurface2, fontSize: 13, fontWeight: "800", marginBottom: 8 }, presetRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm }, preset: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }, presetActive: { backgroundColor: colors.indigo, borderColor: colors.indigo }, presetText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" }, presetTextActive: { color: "#fff" },
  inlineRow: { flexDirection: "row", gap: SPACING.md }, counter: { textAlign: "right", color: colors.muted, fontSize: 11, marginTop: 4 }, label: { fontSize: FONT.sm, fontWeight: "700", color: colors.muted, marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.base, color: colors.onSurface },
  segment: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, segmentActive: { backgroundColor: colors.indigo, borderColor: colors.indigo }, segmentText: { fontWeight: "700", color: colors.onSurface },
  stepper: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 4 }, stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 }, stepVal: { fontSize: FONT.xl, fontWeight: "800", color: colors.onSurface, minWidth: 30, textAlign: "center" },
  tripCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, padding: 14, marginBottom: 14 }, tripCardActive: { borderColor: colors.saffron, backgroundColor: colors.cream }, tripIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.card }, tripIconActive: { backgroundColor: colors.saffron }, tripTitle: { color: colors.onSurface, fontWeight: "900" }, tripSub: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  footer: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.saffron, borderRadius: RADIUS.pill, paddingVertical: 16 }, submitText: { color: "#fff", fontWeight: "900", fontSize: FONT.lg },
});
