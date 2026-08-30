import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { peopleApi } from "@/src/api/people";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { FONT_DISPLAY, RADIUS, SPACING } from "@/src/theme";

type Note = {
  notification_id: string;
  title: string;
  body: string;
  category?: string;
  action_url?: string;
  read_at?: string | null;
  created_at: string;
  source?: "supabase" | "legacy";
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  match: "people-outline",
  request: "person-add-outline",
  trip: "navigate-outline",
  chat: "chatbubble-outline",
  saved_route: "notifications-outline",
  rating: "star-outline",
  digest: "calendar-outline",
  games: "game-controller-outline",
  circle: "wallet-outline",
  people: "people-circle-outline",
  general: "sparkles-outline",
};

function categoryFor(type?: string) {
  const value = String(type || "general").toLowerCase();
  if (value.includes("route")) return "saved_route";
  if (value.includes("trip") || value.includes("journey") || value.includes("waitlist")) return "trip";
  if (value.includes("chat") || value.includes("message")) return "chat";
  if (value.includes("request")) return "request";
  if (value.includes("match")) return "match";
  if (value.includes("rating") || value.includes("feedback")) return "rating";
  if (value.includes("game") || value.includes("streak")) return "games";
  if (value.includes("circle") || value.includes("expense") || value.includes("settle")) return "circle";
  if (value.includes("people") || value.includes("contact")) return "people";
  return value in ICONS ? value : "general";
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const loaded = useRef(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet && !loaded.current) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const rows = await peopleApi.notifications(80);
      const normalized: Note[] = (rows || []).map((note) => ({
        notification_id: note.id,
        title: note.title,
        body: note.body,
        category: categoryFor(note.type),
        action_url: note.route || undefined,
        read_at: note.read_at,
        created_at: note.created_at,
        source: "supabase",
      }));
      setItems(normalized);
      setUnread(normalized.filter((note) => !note.read_at).length);
      loaded.current = true;
    } catch {
      try {
        const data = await api.notifications(false, 80);
        const normalized: Note[] = (data.items || []).map((note: any) => ({ ...note, category: categoryFor(note.category), source: "legacy" }));
        setItems(normalized);
        setUnread(Number(data.unread || normalized.filter((note) => !note.read_at).length));
        loaded.current = true;
      } catch (e: any) {
        setError(e?.message || "Couldn't refresh notifications.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(loaded.current); }, [load]));

  const open = async (note: Note) => {
    if (!note.read_at) {
      setItems((prev) => prev.map((n) => n.notification_id === note.notification_id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnread((n) => Math.max(0, n - 1));
      if (note.source === "legacy") api.readNotification(note.notification_id).catch(() => {});
      else peopleApi.readNotification(note.notification_id).catch(() => {});
    }
    if (note.action_url) router.push(note.action_url as any);
  };

  const readAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnread(0);
    try {
      const usesLegacy = items.some((note) => note.source === "legacy");
      if (usesLegacy) await api.readAllNotifications();
      else await peopleApi.readAllNotifications();
    } catch { load(true); }
  };

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={21} color={colors.onSurface} /></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>UPDATES</Text><Text style={styles.title}>Notifications</Text></View>
      {unread > 0 ? <Pressable onPress={readAll} style={styles.readAll}><Text style={styles.readAllText}>Mark all read</Text></Pressable> : null}
    </View>

    {loading ? <View style={styles.center}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Loading your updates…</Text></View> : <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.indigo} />}
    >
      {error ? <Pressable onPress={() => load(true)} style={styles.errorCard}><Ionicons name="refresh" size={19} color={colors.indigo} /><Text style={styles.errorText}>{error} Tap to retry.</Text></Pressable> : null}
      <View style={styles.summary}>
        <View><Text style={styles.summaryNum}>{unread}</Text><Text style={styles.summaryLabel}>unread</Text></View>
        <Text style={styles.summaryCopy}>Matches, ride alerts, trip updates, Circle activity and chats can land here without waiting for the legacy travel backend.</Text>
      </View>
      {items.length === 0 ? <View style={styles.empty}><Ionicons name="notifications-off-outline" size={32} color={colors.muted} /><Text style={styles.emptyTitle}>You're caught up</Text><Text style={styles.muted}>New UniPool activity will appear here.</Text></View> : <View style={styles.stack}>
        {items.map((note) => {
          const unreadNote = !note.read_at;
          const category = note.category || "general";
          return <Pressable key={note.notification_id} onPress={() => open(note)} style={({ pressed }) => [styles.note, unreadNote && styles.noteUnread, pressed && { opacity: .76 }]}>
            <View style={styles.iconWrap}><Ionicons name={ICONS[category] || ICONS.general} size={19} color={unreadNote ? colors.indigo : colors.muted} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.noteTop}><Text style={styles.noteTitle}>{note.title}</Text><Text style={styles.time}>{relativeTime(note.created_at)}</Text></View>
              <Text style={styles.noteBody}>{note.body}</Text>
            </View>
            {unreadNote ? <View style={styles.dot} /> : null}
          </Pressable>;
        })}
      </View>}
    </ScrollView>}
  </SafeAreaView>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: SPACING.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "900", fontFamily: FONT_DISPLAY, marginTop: 2 },
  readAll: { minHeight: 38, justifyContent: "center", paddingHorizontal: 11 },
  readAllText: { color: colors.indigo, fontSize: 11, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", padding: SPACING.lg, paddingBottom: 120 },
  summary: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 15, marginBottom: 14 },
  summaryNum: { color: colors.onSurface, fontSize: 26, fontWeight: "900" },
  summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  summaryCopy: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: RADIUS.md, backgroundColor: colors.surface2, padding: 11, marginBottom: 12 },
  errorText: { color: colors.onSurface, fontSize: 11, fontWeight: "700" },
  stack: { gap: 8 },
  note: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12 },
  noteUnread: { backgroundColor: colors.surface2, borderColor: colors.indigo },
  iconWrap: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  noteTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  noteTitle: { flex: 1, color: colors.onSurface, fontSize: 12, fontWeight: "900" },
  time: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  noteBody: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.indigo },
  empty: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 7 },
  emptyTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900" },
  muted: { color: colors.muted, fontSize: 11 },
});
