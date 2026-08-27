import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

type Journey = {
  pool_id: string;
  from_location: string;
  to_location: string;
  travel_datetime: string;
  phase?: string;
  countdown_minutes?: number;
  is_owner?: boolean;
  seats?: { total: number; occupied: number; available: number };
  meeting_point?: { label?: string } | null;
  fare?: { amount?: number; currency?: string; per_person?: number } | null;
};
type SavedRoute = { saved_route_id: string; label: string; from_location: string; to_location: string; alerts_enabled: boolean; active_rides?: number };
type RecurringRoute = { template_id: string; from_location: string; to_location: string; weekday: number; hour: number; minute: number; active: boolean };
type RouteInsight = { route_key: string; from_location: string; to_location: string; trips_120d: number; peak_hour?: number | null; saved?: boolean };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function when(iso: string) { return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }); }
function phaseLabel(value?: string) { return (value || "planning").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function timeLabel(hour: number, minute = 0) { const d = new Date(); d.setHours(hour, minute, 0, 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function ExploreScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const loadedOnce = useRef(false);
  const [loading, setLoading] = useState(true);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [recurring, setRecurring] = useState<RecurringRoute[]>([]);
  const [insights, setInsights] = useState<RouteInsight[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [digest, setDigest] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveFrom, setSaveFrom] = useState("Mahindra University");
  const [saveTo, setSaveTo] = useState("Rajiv Gandhi International Airport");
  const [savingRoute, setSavingRoute] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [repeatFrom, setRepeatFrom] = useState("Mahindra University");
  const [repeatTo, setRepeatTo] = useState("Rajiv Gandhi International Airport");
  const [weekday, setWeekday] = useState(4);
  const [repeatTime, setRepeatTime] = useState("18:00");
  const [savingRepeat, setSavingRepeat] = useState(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      api.upcomingJourneys(),
      api.savedRoutes(),
      api.recurringRoutes(),
      api.routeInsights(),
      api.travelDigest(),
      api.diagnostics(),
    ]);
    const val = (i: number, fallback: any) => results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<any>).value : fallback;
    setJourneys(val(0, []));
    setSaved(val(1, []));
    setRecurring(val(2, []));
    setInsights(val(3, []));
    setDigest(val(4, null));
    setDiagnostics(val(5, null));
    if (results.every((r) => r.status === "rejected")) setError("Couldn't refresh mobility data. Tap to retry.");
    loadedOnce.current = true;
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const go = (path: string) => { Haptics.selectionAsync(); router.push(path as any); };
  const nextJourney = journeys[0];

  const saveRoute = async () => {
    if (!saveFrom.trim() || !saveTo.trim()) return;
    setSavingRoute(true);
    try {
      await api.saveRoute({ from_location: saveFrom.trim(), to_location: saveTo.trim(), alerts_enabled: true, time_window_minutes: 180 });
      api.recordEvent("saved_route_create", { from: saveFrom.trim(), to: saveTo.trim() }).catch(() => {});
      setShowSave(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e: any) { Alert.alert("Couldn't save route", e.message || "Try again"); }
    finally { setSavingRoute(false); }
  };

  const addRecurring = async () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(repeatTime.trim());
    if (!repeatFrom.trim() || !repeatTo.trim() || !match) return Alert.alert("Check the time", "Use HH:MM, for example 18:00.");
    setSavingRepeat(true);
    try {
      await api.createRecurringRoute({ from_location: repeatFrom.trim(), to_location: repeatTo.trim(), weekday, hour: Number(match[1]), minute: Number(match[2]), total_seats: 4, companions: 0, gender_preference: "any", active: true });
      api.recordEvent("recurring_route_create", { weekday }).catch(() => {});
      setShowRecurring(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e: any) { Alert.alert("Couldn't create recurring ride", e.message || "Try again"); }
    finally { setSavingRepeat(false); }
  };

  const removeSaved = async (id: string) => {
    try { await api.deleteSavedRoute(id); setSaved((items) => items.filter((item) => item.saved_route_id !== id)); }
    catch (e: any) { Alert.alert("Couldn't remove route", e.message); }
  };
  const toggleRecurring = async (route: RecurringRoute) => {
    try { await api.updateRecurringRoute(route.template_id, { active: !route.active }); await load(); }
    catch (e: any) { Alert.alert("Couldn't update recurring ride", e.message); }
  };

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>EXPLORE</Text>
          <Text style={styles.title}>Your mobility hub</Text>
          <Text style={styles.subtitle}>Upcoming travel, route alerts, recurring rides, trust context and useful tools — without cluttering Home.</Text>
        </View>
        <Pressable onPress={() => go("/post-request")} style={styles.postButton}><Ionicons name="add" size={18} color="#fff" /><Text style={styles.postButtonText}>Post trip</Text></Pressable>
      </View>

      {loading && !loadedOnce.current ? <View style={styles.loadingCard}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Loading your travel network…</Text></View> : error ? <Pressable onPress={load} style={styles.infoCard}><Ionicons name="refresh" size={20} color={colors.indigo} /><Text style={styles.cardTitle}>{error}</Text></Pressable> : null}

      <Section title="Next journey" sub={nextJourney ? "Everything important for your next real ride." : "Your confirmed/upcoming rides will appear here."}>
        {nextJourney ? <Pressable onPress={() => go(`/pool/${nextJourney.pool_id}`)} style={styles.heroTrip}>
          <View style={styles.heroTop}><View style={styles.phasePill}><View style={styles.liveDot} /><Text style={styles.phaseText}>{phaseLabel(nextJourney.phase)}</Text></View><Text style={styles.when}>{when(nextJourney.travel_datetime)}</Text></View>
          <Text numberOfLines={1} style={styles.routeBig}>{nextJourney.from_location}</Text>
          <View style={styles.routeArrow}><View style={styles.routeLine} /><Ionicons name="arrow-forward" size={16} color={colors.saffron} /></View>
          <Text numberOfLines={1} style={styles.routeBig}>{nextJourney.to_location}</Text>
          <View style={styles.statRow}>
            <MiniStat icon="people" text={nextJourney.seats ? `${nextJourney.seats.available} seats left` : "Seat details"} colors={colors} />
            <MiniStat icon="location" text={nextJourney.meeting_point?.label || "Set meeting point"} colors={colors} />
            <MiniStat icon="cash" text={nextJourney.fare?.per_person ? `₹${nextJourney.fare.per_person}/person` : "Add fare"} colors={colors} />
          </View>
          <View style={styles.openRow}><Text style={styles.openText}>Open Trip Command Centre</Text><Ionicons name="arrow-forward-circle" size={22} color={colors.indigo} /></View>
        </Pressable> : <Pressable onPress={() => go("/post-request")} style={styles.emptyCard}><Ionicons name="navigate-outline" size={24} color={colors.indigo} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>No upcoming journey</Text><Text style={styles.cardSub}>Post a trip and UniPool will match, notify and coordinate it.</Text></View><Ionicons name="add-circle" size={25} color={colors.saffron} /></Pressable>}
      </Section>

      <Section title="Your travel network" sub="Reliability, completed rides and the people/context you have built through UniPool.">
        <Pressable onPress={() => go("/network")} style={styles.networkCard}>
          <View style={styles.networkIcon}><Ionicons name="git-network-outline" size={24} color={colors.indigo} /></View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Travel history & reliability</Text><Text style={styles.cardSub}>See your reliability score, completed journeys and past co-travellers. Search any student to see mutual context.</Text></View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      </Section>

      <Section title="Saved routes" sub="Follow corridors you care about. UniPool alerts you when a relevant ride appears." action="Add route" onAction={() => setShowSave((v) => !v)}>
        {showSave && <View style={styles.formCard}><TextInput value={saveFrom} onChangeText={setSaveFrom} placeholder="From" placeholderTextColor={colors.muted} style={styles.input} /><Ionicons name="arrow-down" size={16} color={colors.muted} /><TextInput value={saveTo} onChangeText={setSaveTo} placeholder="To" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={savingRoute} onPress={saveRoute} style={styles.primaryBtn}>{savingRoute ? <ActivityIndicator color="#fff" /> : <><Ionicons name="notifications" size={16} color="#fff" /><Text style={styles.primaryBtnText}>Save + alert me</Text></>}</Pressable></View>}
        {saved.length === 0 && !showSave ? <Text style={styles.muted}>No saved routes yet.</Text> : null}
        <View style={styles.stack}>{saved.map((route) => <View key={route.saved_route_id} style={styles.routeCard}><View style={{ flex: 1 }}><View style={styles.routeCardTop}><Text numberOfLines={1} style={styles.cardTitle}>{route.label}</Text><View style={styles.alertPill}><Ionicons name="notifications" size={12} color={colors.success} /><Text style={styles.alertText}>ON</Text></View></View><Text style={styles.cardSub}>{route.active_rides || 0} upcoming ride{route.active_rides === 1 ? "" : "s"} on this corridor</Text></View><Pressable onPress={() => removeSaved(route.saved_route_id)} hitSlop={10}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable></View>)}</View>
      </Section>

      <Section title="Recurring journeys" sub="For the routes you repeat every week." action="Add weekly" onAction={() => setShowRecurring((v) => !v)}>
        {showRecurring && <View style={styles.formCard}><TextInput value={repeatFrom} onChangeText={setRepeatFrom} placeholder="From" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={repeatTo} onChangeText={setRepeatTo} placeholder="To" placeholderTextColor={colors.muted} style={styles.input} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{WEEKDAYS.map((day, index) => <Pressable key={day} onPress={() => setWeekday(index)} style={[styles.dayChip, weekday === index && styles.dayChipActive]}><Text style={[styles.dayText, weekday === index && { color: "#fff" }]}>{day}</Text></Pressable>)}</ScrollView><TextInput value={repeatTime} onChangeText={setRepeatTime} placeholder="18:00" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={savingRepeat} onPress={addRecurring} style={styles.primaryBtn}>{savingRepeat ? <ActivityIndicator color="#fff" /> : <><Ionicons name="repeat" size={16} color="#fff" /><Text style={styles.primaryBtnText}>Create recurring ride</Text></>}</Pressable></View>}
        <View style={styles.stack}>{recurring.map((route) => <Pressable key={route.template_id} onPress={() => toggleRecurring(route)} style={[styles.routeCard, !route.active && { opacity: .58 }]}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{route.from_location} → {route.to_location}</Text><Text style={styles.cardSub}>{WEEKDAYS[route.weekday]} · {timeLabel(route.hour, route.minute)} · {route.active ? "Auto-posting enabled" : "Paused"}</Text></View><Ionicons name={route.active ? "pause-circle-outline" : "play-circle-outline"} size={22} color={colors.indigo} /></Pressable>)}</View>
      </Section>

      <Section title="Route intelligence" sub="Patterns from recent UniPool travel activity.">
        <View style={styles.toolGrid}>{insights.slice(0, 4).map((item) => <View key={item.route_key} style={styles.insightCard}><Ionicons name="analytics" size={19} color={colors.saffron} /><Text numberOfLines={2} style={styles.cardTitle}>{item.from_location} → {item.to_location}</Text><Text style={styles.cardSub}>{item.trips_120d} trips · {item.peak_hour == null ? "building a pattern" : `peak around ${timeLabel(item.peak_hour)}`}</Text></View>)}{insights.length === 0 ? <Text style={styles.muted}>Route trends will appear as the network grows.</Text> : null}</View>
      </Section>

      <Section title="Useful right now">
        <View style={styles.toolGrid}>
          <Tool icon="search-outline" title="Find a ride" sub="Browse matching journeys" onPress={() => go("/(tabs)")} colors={colors} styles={styles} />
          <Tool icon="flame-outline" title="Route demand" sub="See busy corridors" onPress={() => go("/heatmap")} colors={colors} styles={styles} accent />
          <Tool icon="chatbubbles-outline" title="Trip chats" sub="Coordinate journeys" onPress={() => go("/(tabs)/messages")} colors={colors} styles={styles} />
          <Tool icon="shield-checkmark-outline" title="Student ID" sub="Identity and trust" onPress={() => go("/(tabs)/profile")} colors={colors} styles={styles} />
        </View>
      </Section>

      <Section title="Time-pass" sub="Travel knowledge and word games — no random arcade clutter." action="See all" onAction={() => go("/(tabs)/games")}>
        <Pressable onPress={() => go("/games/daily-challenge")} style={styles.dailyShortcut}><View style={styles.dailyIcon}><Ionicons name="sparkles" size={19} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Today's UniPool Challenge</Text><Text style={styles.cardSub}>One shared travel question and a daily streak.</Text></View><Ionicons name="arrow-forward-circle" size={21} color={colors.indigo} /></Pressable>
        <View style={styles.gameRow}>
          <GameShortcut icon="bulb" title="Travel Trivia" onPress={() => go("/games/trivia")} colors={colors} styles={styles} />
          <GameShortcut icon="text" title="Word Scramble" onPress={() => go("/games/word-scramble")} colors={colors} styles={styles} />
          <GameShortcut icon="airplane" title="Airport Codes" onPress={() => go("/games/airport-codes")} colors={colors} styles={styles} />
          <GameShortcut icon="search" title="Destination Detective" onPress={() => go("/games/destination-detective")} colors={colors} styles={styles} />
          <GameShortcut icon="ticket" title="Travel Reveal" onPress={() => go("/games/travel-reveal")} colors={colors} styles={styles} />
        </View>
      </Section>

      <View style={styles.bottomGrid}>
        <View style={styles.digestCard}><Text style={styles.eyebrow}>NETWORK DIGEST</Text><Text style={styles.cardTitle}>{digest?.open_trips_next_7d ?? "—"} open trips in the next 7 days</Text><Text style={styles.cardSub}>{saved.length ? `${saved.length} route alert${saved.length === 1 ? "" : "s"} watching for opportunities.` : "Save a route to make this personal."}</Text></View>
        <View style={styles.digestCard}><Text style={styles.eyebrow}>SYSTEM</Text><Text style={styles.cardTitle}>{diagnostics?.status === "ok" ? "All systems healthy" : diagnostics ? "Backend degraded" : "Checking health"}</Text><Text style={styles.cardSub}>{diagnostics ? `${diagnostics.database_latency_ms} ms database · Mobility ${diagnostics.mobility_version}` : "Diagnostics load quietly in the background."}</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Section({ title, sub, action, onAction, children }: any) { const { colors } = useTheme(); return <View style={{ marginBottom: 27 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 11 }}><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "900" }}>{title}</Text>{sub ? <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{sub}</Text> : null}</View>{action ? <Pressable onPress={onAction}><Text style={{ color: colors.indigo, fontSize: 12, fontWeight: "900" }}>{action}</Text></Pressable> : null}</View>{children}</View>; }
function MiniStat({ icon, text, colors }: any) { return <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}><Ionicons name={icon} size={13} color={colors.muted} /><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: "700", flexShrink: 1 }}>{text}</Text></View>; }
function Tool({ icon, title, sub, onPress, colors, styles, accent = false }: any) { return <Pressable onPress={onPress} style={styles.toolCard}><View style={[styles.toolIcon, accent && { backgroundColor: colors.cream }]}><Ionicons name={icon} size={20} color={accent ? colors.saffron : colors.indigo} /></View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub}>{sub}</Text></Pressable>; }
function GameShortcut({ icon, title, onPress, colors, styles }: any) { return <Pressable onPress={onPress} style={styles.gameCard}><View style={styles.gameIcon}><Ionicons name={icon} size={20} color={colors.saffron} /></View><Text style={styles.gameTitle}>{title}</Text><Ionicons name="arrow-forward" size={16} color={colors.indigo} /></Pressable>; }

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: SPACING.lg, paddingBottom: 130 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 28 },
  eyebrow: { color: colors.saffron, fontWeight: "900", fontSize: 9, letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "900", fontFamily: FONT_DISPLAY, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 620 },
  postButton: { minHeight: 42, borderRadius: 21, paddingHorizontal: 15, backgroundColor: colors.indigo, flexDirection: "row", alignItems: "center", gap: 6 },
  postButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  loadingCard: { minHeight: 110, borderRadius: RADIUS.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 },
  infoCard: { minHeight: 70, borderRadius: RADIUS.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  heroTrip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 15 },
  phasePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface2, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  phaseText: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: .5 },
  when: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  routeBig: { color: colors.onSurface, fontSize: 18, fontWeight: "900", fontFamily: FONT_DISPLAY },
  routeArrow: { flexDirection: "row", alignItems: "center", gap: 8, height: 27 },
  routeLine: { flex: 1, height: 1, backgroundColor: colors.border },
  statRow: { flexDirection: "row", gap: 14, flexWrap: "wrap", marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13 },
  openRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  openText: { color: colors.indigo, fontSize: 11, fontWeight: "900" },
  emptyCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 15 },
  networkCard: { minHeight: 110, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 14 },
  networkIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  formCard: { backgroundColor: colors.surface2, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 9, marginBottom: 10 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: colors.onSurface, fontSize: 12 },
  primaryBtn: { minHeight: 42, borderRadius: 21, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, paddingHorizontal: 14 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  stack: { gap: 8 },
  routeCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 13 },
  routeCardTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  alertPill: { flexDirection: "row", gap: 3, alignItems: "center", backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  alertText: { color: colors.success, fontWeight: "900", fontSize: 8 },
  dayChip: { borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 7 },
  dayChipActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  dayText: { color: colors.onSurface, fontWeight: "800", fontSize: 10 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: { flexGrow: 1, flexBasis: 190, minHeight: 120, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  toolIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  insightCard: { flexGrow: 1, flexBasis: 205, minHeight: 105, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 13, gap: 7 },
  dailyShortcut: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: isDark ? colors.surface2 : colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 12, marginBottom: 9 },
  dailyIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  gameRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  gameCard: { flexGrow: 1, flexBasis: 150, minHeight: 110, backgroundColor: isDark ? colors.surface2 : colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 13, justifyContent: "space-between" },
  gameIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  gameTitle: { color: colors.onSurface, fontWeight: "900", fontSize: 12, marginVertical: 8 },
  bottomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  digestCard: { flexGrow: 1, flexBasis: 260, minHeight: 105, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900" },
  cardSub: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  muted: { color: colors.muted, fontSize: 11 },
});