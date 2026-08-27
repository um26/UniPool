import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, FRONTEND_VERSION } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { usePushNotifications } from "@/src/hooks/use-push-notifications";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { FONT_DISPLAY, RADIUS, SPACING } from "@/src/theme";

type Prefs = { push_enabled: boolean; email_enabled: boolean; categories: Record<string, boolean> };
type Pickup = { pickup_point_id: string; label: string; address?: string | null; notes?: string | null; lat: number; lng: number };

const CATEGORY_LABELS: Record<string, { title: string; sub: string; icon: keyof typeof Ionicons.glyphMap }> = {
  match: { title: "Matches", sub: "Strong new journey matches", icon: "people-outline" },
  request: { title: "Ride requests", sub: "Requests, accepts and waitlist changes", icon: "person-add-outline" },
  trip: { title: "Trip updates", sub: "Meeting point, reminders and traveller status", icon: "navigate-outline" },
  chat: { title: "Trip messages", sub: "Messages from your trip groups", icon: "chatbubble-outline" },
  saved_route: { title: "Saved route alerts", sub: "New rides on routes you follow", icon: "notifications-outline" },
  rating: { title: "Ratings", sub: "Post-trip rating reminders", icon: "star-outline" },
  digest: { title: "Travel digest", sub: "Occasional network summaries", icon: "calendar-outline" },
  games: { title: "Time-pass", sub: "Daily challenge and game updates", icon: "game-controller-outline" },
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const push = usePushNotifications();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPickup, setShowPickup] = useState(false);
  const [label, setLabel] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([api.notificationPreferences(), api.pickupPoints(), api.listBlocked(), user?.is_admin ? api.releaseDiagnostics() : Promise.resolve(null)]);
    if (results[0].status === "fulfilled") setPrefs(results[0].value as Prefs);
    if (results[1].status === "fulfilled") setPickups(results[1].value as Pickup[]);
    if (results[2].status === "fulfilled") setBlocked(results[2].value as any[]);
    if (results[3].status === "fulfilled") setDiagnostics(results[3].value);
    setLoading(false);
  }, [user?.is_admin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patchPrefs = async (patch: any) => {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, ...patch, categories: { ...prefs.categories, ...(patch.categories || {}) } };
    setPrefs(next);
    try { setPrefs(await api.updateNotificationPreferences(patch)); Haptics.selectionAsync(); }
    catch (e: any) { setPrefs(previous); Alert.alert("Couldn't save notification setting", e.message || "Try again"); }
  };

  const addPickup = async () => {
    const latitude = Number(lat), longitude = Number(lng);
    if (!label.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return Alert.alert("Check pickup point", "Add a name and valid latitude/longitude.");
    setSaving(true);
    try {
      await api.savePickupPoint({ label: label.trim(), lat: latitude, lng: longitude, notes: notes.trim() || undefined });
      setLabel(""); setLat(""); setLng(""); setNotes(""); setShowPickup(false);
      await load();
    } catch (e: any) { Alert.alert("Couldn't save pickup point", e.message || "Try again"); }
    finally { setSaving(false); }
  };

  const removePickup = async (id: string) => {
    const previous = pickups;
    setPickups((items) => items.filter((p) => p.pickup_point_id !== id));
    try { await api.deletePickupPoint(id); } catch (e: any) { setPickups(previous); Alert.alert("Couldn't remove pickup point", e.message); }
  };

  const unblock = async (id: string) => {
    const previous = blocked;
    setBlocked((items) => items.filter((u) => u.user_id !== id));
    try { await api.unblockUser(id); } catch (e: any) { setBlocked(previous); Alert.alert("Couldn't unblock user", e.message); }
  };

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={21} color={colors.onSurface} /></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>ACCOUNT</Text><Text style={styles.title}>Settings</Text></View>
      <Text style={styles.version}>v{FRONTEND_VERSION}</Text>
    </View>
    {loading && !prefs ? <View style={styles.center}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Loading settings…</Text></View> : <ScrollView contentContainerStyle={styles.content}>
      <Section title="Appearance" sub="Your theme applies everywhere on UniPool." styles={styles}>
        <View style={styles.segment}>{(["light", "system", "dark"] as const).map((item) => <Pressable key={item} onPress={() => setMode(item)} style={[styles.segmentBtn, mode === item && styles.segmentBtnActive]} accessibilityState={{ selected: mode === item }}><Ionicons name={item === "light" ? "sunny-outline" : item === "dark" ? "moon-outline" : "phone-portrait-outline"} size={17} color={mode === item ? "#fff" : colors.muted} /><Text style={[styles.segmentText, mode === item && { color: "#fff" }]}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
      </Section>

      <Section title="Notifications" sub="Choose what deserves your attention. In-app updates still appear in the Notifications centre unless a category is disabled." styles={styles}>
        {prefs ? <>
          <SettingRow icon="notifications-outline" title="Browser push" sub={push.permission === "denied" ? "Blocked by browser settings" : push.subscribed ? "Push subscription is active" : "Off on this device"} value={!!prefs.push_enabled && !!push.subscribed} onValueChange={async (value) => { if (value && !push.subscribed) await push.subscribe(); if (!value && push.subscribed) await push.unsubscribe(); patchPrefs({ push_enabled: value }); }} disabled={push.busy || push.permission === "denied"} styles={styles} colors={colors} />
          <SettingRow icon="mail-outline" title="Email notifications" sub="Important ride and match emails" value={prefs.email_enabled} onValueChange={(value) => patchPrefs({ email_enabled: value })} styles={styles} colors={colors} />
          <View style={styles.categoryGrid}>{Object.entries(CATEGORY_LABELS).map(([key, meta]) => <View key={key} style={styles.categoryCard}><View style={styles.categoryTop}><View style={styles.smallIcon}><Ionicons name={meta.icon} size={17} color={colors.indigo} /></View><Switch value={prefs.categories[key] !== false} onValueChange={(value) => patchPrefs({ categories: { [key]: value } })} trackColor={{ false: colors.border, true: colors.indigo }} /></View><Text style={styles.cardTitle}>{meta.title}</Text><Text style={styles.cardSub}>{meta.sub}</Text></View>)}</View>
        </> : <Text style={styles.muted}>Notification preferences will appear when the latest backend is available.</Text>}
      </Section>

      <Section title="Saved pickup points" sub="Keep the exact meeting spots you reuse at campus, airports and stations." action="Add point" onAction={() => setShowPickup((v) => !v)} styles={styles}>
        {showPickup ? <View style={styles.formCard}><TextInput value={label} onChangeText={setLabel} placeholder="Name, e.g. MU Gate 2" placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.inputRow}><TextInput value={lat} onChangeText={setLat} placeholder="Latitude" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} /><TextInput value={lng} onChangeText={setLng} placeholder="Longitude" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} /></View><TextInput value={notes} onChangeText={setNotes} placeholder="Pickup note (optional)" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={saving} onPress={addPickup} style={styles.primary}>{saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="bookmark-outline" size={17} color="#fff" /><Text style={styles.primaryText}>Save pickup point</Text></>}</Pressable></View> : null}
        {pickups.length ? <View style={styles.stack}>{pickups.map((point) => <View key={point.pickup_point_id} style={styles.rowCard}><View style={styles.smallIcon}><Ionicons name="location-outline" size={17} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{point.label}</Text><Text style={styles.cardSub}>{point.notes || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}</Text></View><Pressable onPress={() => removePickup(point.pickup_point_id)} hitSlop={10}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable></View>)}</View> : <Text style={styles.muted}>No saved pickup points yet.</Text>}
      </Section>

      <Section title="Privacy & safety" sub="Manage people you've blocked. Trip reports remain private to UniPool moderation." styles={styles}>
        {blocked.length ? blocked.map((person) => <View key={person.user_id} style={styles.rowCard}><View style={styles.smallIcon}><Ionicons name="person-remove-outline" size={17} color={colors.error} /></View><Text style={[styles.cardTitle, { flex: 1 }]}>{person.name}</Text><Pressable onPress={() => unblock(person.user_id)}><Text style={styles.link}>Unblock</Text></Pressable></View>) : <Text style={styles.muted}>You haven't blocked anyone.</Text>}
      </Section>

      {user?.is_admin ? <Section title="Release diagnostics" sub="Admin-only deployment and API health signals." styles={styles}>{diagnostics ? <View style={styles.diagnostics}><Stat label="Backend" value={diagnostics.backend_version || "—"} styles={styles} /><Stat label="Frontend" value={diagnostics.frontend_version || FRONTEND_VERSION} styles={styles} /><Stat label="DB latency" value={`${diagnostics.database_latency_ms ?? "—"} ms`} styles={styles} /><Stat label="Recent client errors" value={String(diagnostics.failed_client_events?.length || 0)} styles={styles} /></View> : <Text style={styles.muted}>Diagnostics unavailable from the current backend.</Text>}</Section> : null}

      <Section title="Account" styles={styles}>
        <Pressable onPress={signOut} style={styles.danger}><Ionicons name="log-out-outline" size={18} color={colors.error} /><Text style={styles.dangerText}>Sign out</Text></Pressable>
        <Text style={[styles.muted, { marginTop: 10 }]}>UniPool does not expose passwords, message contents or contact details in product telemetry.</Text>
      </Section>
    </ScrollView>}
  </SafeAreaView>;
}

function Section({ title, sub, action, onAction, children, styles }: any) { return <View style={styles.section}><View style={styles.sectionHead}><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{title}</Text>{sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}</View>{action ? <Pressable onPress={onAction}><Text style={styles.link}>{action}</Text></Pressable> : null}</View>{children}</View>; }
function SettingRow({ icon, title, sub, value, onValueChange, disabled, styles, colors }: any) { return <View style={styles.settingRow}><View style={styles.smallIcon}><Ionicons name={icon} size={17} color={colors.indigo} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub}>{sub}</Text></View><Switch disabled={disabled} value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.indigo }} /></View>; }
function Stat({ label, value, styles }: any) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { color: colors.onSurface, fontSize: 20, fontWeight: "900", fontFamily: FONT_DISPLAY, marginTop: 2 }, version: { color: colors.muted, fontSize: 9, fontWeight: "800" }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: SPACING.lg, paddingBottom: 120 }, section: { marginBottom: 26 }, sectionHead: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 10 }, sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" }, sectionSub: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3, maxWidth: 620 }, link: { color: colors.indigo, fontSize: 11, fontWeight: "900" }, segment: { flexDirection: "row", gap: 7, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 5 }, segmentBtn: { flex: 1, minHeight: 42, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, segmentBtnActive: { backgroundColor: colors.indigo }, segmentText: { color: colors.muted, fontSize: 11, fontWeight: "900" }, settingRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, marginBottom: 8 }, smallIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, categoryCard: { flexGrow: 1, flexBasis: 190, minHeight: 128, padding: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg }, categoryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }, cardTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900" }, cardSub: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, formCard: { padding: 12, gap: 8, backgroundColor: colors.surface2, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 9 }, input: { minHeight: 44, color: colors.onSurface, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, paddingHorizontal: 12, fontSize: 12 }, inputRow: { flexDirection: "row", gap: 8 }, primary: { minHeight: 44, borderRadius: 22, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" }, stack: { gap: 8 }, rowCard: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg }, diagnostics: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, stat: { flexGrow: 1, flexBasis: 150, minHeight: 80, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, statValue: { color: colors.onSurface, fontSize: 16, fontWeight: "900" }, statLabel: { color: colors.muted, fontSize: 9, marginTop: 3 }, danger: { minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.error, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, dangerText: { color: colors.error, fontWeight: "900", fontSize: 12 }, muted: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
