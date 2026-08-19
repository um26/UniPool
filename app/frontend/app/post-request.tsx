import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { api } from "@/src/api/client";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/** Extracts the IST wall-clock date/time components from a real UTC instant,
 *  regardless of what timezone the device itself is set to. */
function toISTParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

/** Treats the given date/time strings as an IST wall-clock moment and
 *  returns the equivalent UTC ISO string — independent of device timezone. */
function istPartsToUTCISO(date: string, time: string) {
  const asUTC = new Date(`${date}T${time}:00.000Z`).getTime();
  return new Date(asUTC - IST_OFFSET_MS).toISOString();
}

export default function PostRequestScreen() {
  const router = useRouter();
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
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const mine = await api.myPools();
        const pool = mine.find((p: any) => p.pool_id === edit);
        if (!pool) { Alert.alert("Not found", "This query no longer exists."); router.back(); return; }
        setFrom(pool.from_location);
        setTo(pool.to_location);
        const dt = new Date(pool.travel_datetime);
        const ist = toISTParts(dt);
        setDate(ist.date);
        setTime(ist.time);
        setGenderPref(pool.gender_preference || "any");
        setCompanions(pool.companions || 0);
        setLuggage(pool.luggage || "");
        setNotes(pool.notes || "");
      } catch (e: any) {
        Alert.alert("Error", e.message);
        router.back();
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [isEditing, edit]);

  const submit = async () => {
    if (!from.trim() || !to.trim()) return Alert.alert("Missing", "From & To are required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert("Invalid", "Date must be YYYY-MM-DD");
    if (!/^\d{2}:\d{2}$/.test(time)) return Alert.alert("Invalid", "Time must be HH:MM");
    const iso = istPartsToUTCISO(date, time);
    setSubmitting(true);
    try {
      const payload = {
        from_location: from.trim(),
        to_location: to.trim(),
        travel_datetime: iso,
        gender_preference: genderPref,
        companions,
        luggage: luggage.trim() || null,
        notes: notes.trim() || null,
      };
      if (isEditing) {
        await api.updatePool(edit as string, payload);
      } else {
        await api.createPool(payload);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert("Could not post", e.message || "Try again");
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="close-post" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.title}>{isEditing ? "Edit Pool" : "Post a Pool"}</Text>
          <View style={{ width: 26 }} />
        </View>

        {loadingExisting ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
            <ActivityIndicator color={COLORS.indigo} />
          </View>
        ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}>
          <Field label="From (city / area)" testID="input-from">
            <TextInput testID="from-input" value={from} onChangeText={setFrom} placeholder="e.g. IIT Delhi" style={styles.input} placeholderTextColor={COLORS.muted} />
          </Field>
          <Field label="To (city / area)" testID="input-to">
            <TextInput testID="to-input" value={to} onChangeText={setTo} placeholder="e.g. IGI Airport T3" style={styles.input} placeholderTextColor={COLORS.muted} />
          </Field>

          <View style={{ flexDirection: "row", gap: SPACING.md }}>
            <Field style={{ flex: 1 }} label="Date (IST)" testID="input-date">
              <TextInput testID="date-input" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} placeholderTextColor={COLORS.muted} />
            </Field>
            <Field style={{ flex: 1 }} label="Time (IST)" testID="input-time">
              <TextInput testID="time-input" value={time} onChangeText={setTime} placeholder="HH:MM" style={styles.input} placeholderTextColor={COLORS.muted} />
            </Field>
          </View>

          <Field label="Gender preference" testID="input-gender">
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              {(["any", "same"] as const).map((g) => (
                <Pressable
                  key={g}
                  testID={`gender-pref-${g}`}
                  onPress={() => { Haptics.selectionAsync(); setGenderPref(g); }}
                  style={[styles.segment, genderPref === g && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, genderPref === g && { color: "#fff" }]}>{g === "any" ? "Anyone" : "Same gender"}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Companions already with you (optional)" testID="input-companions">
            <View style={styles.stepper}>
              <Pressable testID="comp-minus" onPress={() => setCompanions(Math.max(0, companions - 1))} style={styles.stepBtn}><Ionicons name="remove" size={20} color={COLORS.onSurface} /></Pressable>
              <Text style={styles.stepVal}>{companions}</Text>
              <Pressable testID="comp-plus" onPress={() => setCompanions(Math.min(6, companions + 1))} style={styles.stepBtn}><Ionicons name="add" size={20} color={COLORS.onSurface} /></Pressable>
            </View>
          </Field>

          <Field label="Luggage (optional)" testID="input-luggage">
            <TextInput testID="luggage-input" value={luggage} onChangeText={setLuggage} placeholder="e.g. 1 large suitcase" style={styles.input} placeholderTextColor={COLORS.muted} />
          </Field>

          <Field label="Notes (optional)" testID="input-notes">
            <TextInput testID="notes-input" value={notes} onChangeText={setNotes} placeholder="Any details" style={[styles.input, { height: 80, textAlignVertical: "top" }]} multiline placeholderTextColor={COLORS.muted} />
          </Field>
        </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable testID="submit-pool" disabled={submitting || loadingExisting} onPress={submit} style={[styles.submit, (submitting || loadingExisting) && { opacity: 0.6 }]}>
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name={isEditing ? "checkmark" : "paper-plane"} size={18} color="#fff" />
                <Text style={styles.submitText}>{isEditing ? "Save Changes" : "Post Request"}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, testID, style }: any) {
  return (
    <View style={[{ marginBottom: SPACING.lg }, style]} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONT.xl, fontWeight: "800", color: COLORS.onSurface },
  label: { fontSize: FONT.sm, fontWeight: "700", color: COLORS.muted, marginBottom: 6, letterSpacing: 0.4 },
  input: { backgroundColor: "#fff", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.base, color: COLORS.onSurface },
  segment: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border },
  segmentActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  segmentText: { fontWeight: "700", color: COLORS.onSurface },
  stepper: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: "#fff", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface2 },
  stepVal: { fontSize: FONT.xl, fontWeight: "800", color: COLORS.onSurface, minWidth: 30, textAlign: "center" },
  footer: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.saffron, borderRadius: RADIUS.pill, paddingVertical: 16 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: FONT.lg },
});
