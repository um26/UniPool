import React, { useCallback, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import RatingBadge from "@/src/components/RatingBadge";
import UserBadges from "@/src/components/UserBadges";
import PoolMapView from "@/src/components/PoolMapView";
import { PoolFeedSkeleton } from "@/src/components/Skeleton";
import ReportBlockModal from "@/src/components/ReportBlockModal";
import Confetti from "@/src/components/Confetti";

type ConfirmedTraveler = { user_id: string; name: string; email: string };
type Pool = {
  pool_id: string; user_id: string; user_name: string; user_email: string;
  from_location: string; to_location: string; travel_datetime: string;
  gender_preference: string; companions: number; luggage?: string | null; notes?: string | null;
  user_rating_avg?: number | null; user_rating_count?: number;
  user_badges?: { id: string; label: string; icon: string }[];
  confirmed_travelers?: ConfirmedTraveler[];
  my_request_status?: "pending" | "accepted" | "declined" | null;
};
const CHIPS = ["All", "Today", "Tomorrow", "This week", "Airport", "Railway"];
function formatDT(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso); return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

export default function HomeFeed() {
  const router = useRouter(); const { user } = useAuth(); const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pools, setPools] = useState<Pool[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [chip, setChip] = useState("All"); const [search, setSearch] = useState(""); const [showMap, setShowMap] = useState(false);
  const [requesting, setRequesting] = useState<Set<string>>(new Set()); const [reportTarget, setReportTarget] = useState<{ user_id: string; user_name: string } | null>(null);
  const [confettiKey, setConfettiKey] = useState(0); const knownAccepted = useRef<Set<string> | null>(null);
  const load = useCallback(async () => {
    try {
      const list = await api.listPools(); setPools(list);
      const acceptedNow = new Set<string>(list.filter((p: Pool) => p.my_request_status === "accepted").map((p: Pool) => p.pool_id));
      if (knownAccepted.current && [...acceptedNow].some((id) => !knownAccepted.current!.has(id))) setConfettiKey((k) => k + 1);
      knownAccepted.current = acceptedNow;
    } catch (e) { console.warn(e); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  const sendRequest = useCallback(async (pool: Pool) => {
    setRequesting((s) => new Set(s).add(pool.pool_id)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await api.requestToJoin(pool.pool_id); setPools((prev) => prev.map((p) => p.pool_id === pool.pool_id ? { ...p, my_request_status: "pending" } : p)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch (e: any) { Alert.alert("Couldn't send request", e.message || "Please try again."); }
    finally { setRequesting((s) => { const n = new Set(s); n.delete(pool.pool_id); return n; }); }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const filtered = useMemo(() => pools.filter((p) => {
    if (chip === "Today" && !isSameDay(p.travel_datetime, new Date())) return false;
    if (chip === "Tomorrow") { const t = new Date(); t.setDate(t.getDate() + 1); if (!isSameDay(p.travel_datetime, t)) return false; }
    if (chip === "This week") { const d = new Date(p.travel_datetime); const now = new Date(); const weekOut = new Date(); weekOut.setDate(now.getDate() + 7); if (d < now || d > weekOut) return false; }
    if (chip === "Airport" && !/airport|blr|del|bom|maa|hyd/i.test(`${p.from_location} ${p.to_location}`)) return false;
    if (chip === "Railway" && !/station|railway|junction|jn/i.test(`${p.from_location} ${p.to_location}`)) return false;
    if (search.trim()) { const q = search.trim().toLowerCase(); const haystack = `${p.from_location} ${p.to_location} ${p.user_name}`.toLowerCase(); if (!haystack.includes(q)) return false; }
    return true;
  }), [pools, chip, search]);
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Confetti burstKey={confettiKey} />
      <LinearGradient colors={isDark ? [colors.surface2, colors.surface3] : [colors.indigo, "#283593"]} style={styles.header}>
        <View style={styles.headerTop}><View><Text style={styles.hello}>Namaste, {user?.name?.split(" ")[0] || "traveller"}</Text><Text style={styles.subhello}>Where's your next journey?</Text></View>
          <View style={{ flexDirection: "row" }}>
            <Pressable testID="toggle-map-view" onPress={() => { Haptics.selectionAsync(); setShowMap((m) => !m); }} style={styles.avatar}><Ionicons name={showMap ? "list" : "map"} size={18} color={colors.indigo} /></Pressable>
            <Pressable testID="open-heatmap" onPress={() => { Haptics.selectionAsync(); router.push("/heatmap"); }} style={[styles.avatar, { marginLeft: 8 }]}><Ionicons name="flame" size={18} color={colors.saffron} /></Pressable>
          </View>
        </View>
        <View style={styles.searchRow}><Ionicons name="search" size={16} color={isDark ? "#B9C7DF" : "rgba(255,255,255,0.82)"} />
          <TextInput testID="pool-search" value={search} onChangeText={setSearch} placeholder="Search route or name..." placeholderTextColor={isDark ? "#94A3B8" : "rgba(255,255,255,0.68)"} style={styles.searchInput} />
          {search.length > 0 && <Pressable testID="clear-search" onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={16} color={isDark ? "#B9C7DF" : "rgba(255,255,255,0.8)"} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{CHIPS.map((c) => <Pressable key={c} testID={`chip-${c.toLowerCase().replace(" ", "-")}`} onPress={() => { Haptics.selectionAsync(); setChip(c); }} style={[styles.chip, chip === c && styles.chipActive]}><Text style={[styles.chipText, chip === c && styles.chipTextActive]}>{c}</Text></Pressable>)}</ScrollView>
      </LinearGradient>
      {loading ? <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}><PoolFeedSkeleton /></ScrollView> : showMap ? <PoolMapView pools={filtered} /> : <FlatList data={filtered} keyExtractor={(i) => i.pool_id} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.indigo} />} ListEmptyComponent={<View style={styles.empty}><Ionicons name="map-outline" size={56} color={colors.borderStrong} /><Text style={styles.emptyTitle}>No pools yet</Text><Text style={styles.emptySub}>Be the first to post a cab-pool for this route.</Text></View>} renderItem={({ item }) => <PoolCard pool={item} mine={item.user_id === user?.user_id} busy={requesting.has(item.pool_id)} onRequest={() => sendRequest(item)} onOpenReport={() => setReportTarget({ user_id: item.user_id, user_name: item.user_name })} colors={colors} styles={styles} />} />}
      <PressableScale testID="create-pool-fab" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/post-request"); }} style={styles.fab} scaleTo={0.92}><LinearGradient colors={[colors.saffron, "#F57F17"]} style={styles.fabBg}><Ionicons name="add" size={26} color="#fff" /><Text style={styles.fabText}>Post Pool</Text></LinearGradient></PressableScale>
      {reportTarget && <ReportBlockModal visible={!!reportTarget} onClose={() => setReportTarget(null)} userId={reportTarget.user_id} userName={reportTarget.user_name} onBlocked={load} />}
    </SafeAreaView>
  );
}

function PoolCard({ pool, mine, busy, onRequest, onOpenReport, colors, styles }: { pool: Pool; mine: boolean; busy: boolean; onRequest: () => void; onOpenReport: () => void; colors: any; styles: any }) {
  const travelers = pool.confirmed_travelers || []; const router = useRouter();
  return <Pressable testID={`pool-card-${pool.pool_id}`} onPress={() => router.push({ pathname: "/pool/[poolId]", params: { poolId: pool.pool_id } })} style={styles.card}>
    <View style={styles.cardHeader}><View style={styles.cardAvatar}><Text style={{ color: colors.indigo, fontWeight: "700" }}>{pool.user_name?.[0]?.toUpperCase() || "U"}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardName}>{pool.user_name}{mine && <Text style={{ color: colors.saffron }}>  (you)</Text>}</Text><Text style={styles.cardWhen}>{formatDT(pool.travel_datetime)}</Text><View style={{ marginTop: 3 }}><RatingBadge avg={pool.user_rating_avg} count={pool.user_rating_count} /></View><UserBadges badges={pool.user_badges} compact /></View>{pool.gender_preference === "same" && <View style={styles.badge}><Text style={styles.badgeText}>Same-gender</Text></View>}{!mine && <Pressable testID={`more-${pool.pool_id}`} onPress={(e) => { e.stopPropagation(); onOpenReport(); }} hitSlop={10} style={{ marginLeft: 6 }}><Ionicons name="ellipsis-vertical" size={18} color={colors.muted} /></Pressable>}</View>
    <View style={styles.routeBlock}><View style={styles.dotRow}><View style={[styles.dot, { backgroundColor: colors.saffron }]} /><Text style={styles.routeText}>{pool.from_location}</Text></View><View style={styles.connector} /><View style={styles.dotRow}><View style={[styles.dot, { backgroundColor: colors.indigo }]} /><Text style={styles.routeText}>{pool.to_location}</Text></View></View>
    <View style={styles.metaRow}><View style={styles.metaPill}><Ionicons name="people" size={14} color={colors.onCream} /><Text style={styles.metaText}>+{pool.companions} with</Text></View>{pool.luggage ? <View style={styles.metaPill}><Ionicons name="briefcase" size={14} color={colors.onCream} /><Text style={styles.metaText}>{pool.luggage}</Text></View> : null}</View>
    {pool.notes ? <Text style={styles.notes}>“{pool.notes}”</Text> : null}
    {travelers.length > 0 && <View style={styles.travelingRow} testID={`traveling-together-${pool.pool_id}`}><Ionicons name="car-sport" size={14} color={colors.success} /><Text style={styles.travelingText} numberOfLines={1}>Traveling together: {travelers.map((t) => t.name.split(" ")[0]).join(", ")}{mine ? "" : ` +${travelers.length}`}</Text></View>}
    {!mine && <RequestCta pool={pool} busy={busy} onRequest={onRequest} colors={colors} styles={styles} />}
  </Pressable>;
}

function RequestCta({ pool, busy, onRequest, colors, styles }: { pool: Pool; busy: boolean; onRequest: () => void; colors: any; styles: any }) {
  const status = pool.my_request_status;
  if (status === "accepted") return <View style={[styles.reqPill, styles.reqPillAccepted]}><Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={styles.reqPillTextLight}>You're confirmed for this ride 🚗</Text></View>;
  if (status === "pending") return <View style={[styles.reqPill, styles.reqPillPending]}><Ionicons name="time-outline" size={16} color={colors.indigo} /><Text style={styles.reqPillText}>Request sent — waiting for response</Text></View>;
  return <Pressable testID={`request-${pool.pool_id}`} onPress={(e) => { e.stopPropagation(); onRequest(); }} disabled={busy} style={[styles.reqPill, styles.reqPillIdle, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="hand-left-outline" size={16} color="#fff" /><Text style={styles.reqPillTextLight}>{status === "declined" ? "Request again" : "Request to join"}</Text></>}</Pressable>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hello: { color: "#FFFFFF", fontSize: FONT.xl, fontWeight: "800", fontFamily: FONT_DISPLAY },
  subhello: { color: "rgba(255,255,255,0.78)", marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  chipRow: { paddingTop: SPACING.md, paddingRight: SPACING.lg, gap: SPACING.sm },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10, marginTop: SPACING.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.20)" },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: FONT.base },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.saffron, borderColor: colors.saffron }, chipText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" }, chipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" }, empty: { alignItems: "center", justifyContent: "center", paddingVertical: 80 }, emptyTitle: { marginTop: SPACING.md, fontSize: FONT.xl, fontWeight: "700", color: colors.onSurface }, emptySub: { marginTop: 4, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md }, cardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }, cardName: { fontSize: FONT.lg, fontWeight: "700", color: colors.onSurface }, cardWhen: { color: colors.muted, fontSize: FONT.sm, marginTop: 2 },
  badge: { backgroundColor: colors.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill }, badgeText: { color: colors.onCream, fontSize: 11, fontWeight: "700" },
  routeBlock: { backgroundColor: colors.surface2, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs, borderWidth: 1, borderColor: colors.border }, dotRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md }, dot: { width: 10, height: 10, borderRadius: 5 }, connector: { width: 2, height: 14, backgroundColor: colors.borderStrong, marginLeft: 4 }, routeText: { color: colors.onSurface, fontSize: FONT.base, fontWeight: "600", flex: 1 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md }, metaPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.cream, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6 }, metaText: { fontSize: 12, color: colors.onCream, fontWeight: "600" }, notes: { marginTop: SPACING.md, color: colors.muted, fontStyle: "italic" },
  travelingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.md, backgroundColor: colors.surface3, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 8 }, travelingText: { color: colors.success, fontSize: 12, fontWeight: "700", flex: 1 },
  reqPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: SPACING.md, borderRadius: RADIUS.pill, paddingVertical: 12 }, reqPillIdle: { backgroundColor: colors.indigo }, reqPillPending: { backgroundColor: colors.cream }, reqPillAccepted: { backgroundColor: colors.success }, reqPillText: { color: colors.onCream, fontWeight: "700", fontSize: 13 }, reqPillTextLight: { color: "#fff", fontWeight: "700", fontSize: 13 },
  fab: { position: "absolute", right: SPACING.lg, bottom: 90, borderRadius: RADIUS.pill, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }, fabBg: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 6 }, fabText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
});
