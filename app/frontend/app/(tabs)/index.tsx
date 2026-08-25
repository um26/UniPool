import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
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
  match_score?: number; match_label?: string;
  user_rating_avg?: number | null; user_rating_count?: number;
  user_badges?: { id: string; label: string; icon: string }[];
  confirmed_travelers?: ConfirmedTraveler[];
  my_request_status?: "pending" | "accepted" | "declined" | null;
};

const FILTERS = ["All", "Today", "Tomorrow", "This week", "Airport", "Railway"];

function formatDT(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

function dayKey(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomeFeed() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [requesting, setRequesting] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{ user_id: string; user_name: string } | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const knownAccepted = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await api.listPools();
      setPools(list || []);
      const acceptedNow = new Set<string>((list || []).filter((p: Pool) => p.my_request_status === "accepted").map((p: Pool) => p.pool_id));
      if (knownAccepted.current && [...acceptedNow].some((id) => !knownAccepted.current!.has(id))) {
        setConfettiKey((key) => key + 1);
      }
      knownAccepted.current = acceptedNow;
    } catch (e: any) {
      console.warn("Pool feed failed", e);
      setError(e?.message || "We couldn't load rides right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const sendRequest = useCallback(async (pool: Pool) => {
    setRequesting((current) => new Set(current).add(pool.pool_id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.requestToJoin(pool.pool_id);
      setPools((current) => current.map((item) => item.pool_id === pool.pool_id ? { ...item, my_request_status: "pending" } : item));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Couldn't send request", e?.message || "Please try again.");
    } finally {
      setRequesting((current) => {
        const next = new Set(current);
        next.delete(pool.pool_id);
        return next;
      });
    }
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekOut = Date.now() + 7 * 86400000;
    const query = search.trim().toLowerCase();

    return pools.filter((pool) => {
      const tripTime = new Date(pool.travel_datetime);
      if (filter === "Today" && dayKey(tripTime) !== dayKey(now)) return false;
      if (filter === "Tomorrow" && dayKey(tripTime) !== dayKey(tomorrow)) return false;
      if (filter === "This week" && (tripTime.getTime() < Date.now() || tripTime.getTime() > weekOut)) return false;
      if (filter === "Airport" && !/airport|rgia|rgi|hyd|blr|del|bom|maa/i.test(`${pool.from_location} ${pool.to_location}`)) return false;
      if (filter === "Railway" && !/railway|station|junction|jn\b/i.test(`${pool.from_location} ${pool.to_location}`)) return false;
      if (query && !`${pool.from_location} ${pool.to_location} ${pool.user_name}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [pools, filter, search]);

  const top = (
    <View style={styles.top}>
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>UNIPOOL</Text>
          <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0] || "traveller"}</Text>
          <Text style={styles.subtitle}>Find a better fit for your next journey.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel={showMap ? "Show ride list" : "Show rides on map"} onPress={() => { Haptics.selectionAsync(); setShowMap((value) => !value); }} style={[styles.iconButton, showMap && styles.iconButtonActive]}>
            <Ionicons name={showMap ? "list-outline" : "map-outline"} size={19} color={showMap ? "#fff" : colors.indigo} />
          </Pressable>
          <Pressable accessibilityLabel="Open route demand" onPress={() => router.push("/heatmap")} style={styles.iconButton}>
            <Ionicons name="flame-outline" size={19} color={colors.saffron} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          testID="pool-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search a route or traveller"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
        {search ? <Pressable onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item === filter;
          return <Pressable key={item} testID={`chip-${item.toLowerCase().replace(" ", "-")}`} onPress={() => { setFilter(item); Haptics.selectionAsync(); }} style={[styles.filterChip, active && styles.filterChipActive]}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
          </Pressable>;
        })}
      </ScrollView>

      {!loading && !error ? <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{filtered.length} {filtered.length === 1 ? "ride" : "rides"}</Text>
        {(search || filter !== "All") ? <Pressable onPress={() => { setSearch(""); setFilter("All"); }}><Text style={styles.clearText}>Reset</Text></Pressable> : null}
      </View> : null}
    </View>
  );

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <Confetti burstKey={confettiKey} />

    {loading ? <ScrollView contentContainerStyle={styles.page}>
      {top}
      <PoolFeedSkeleton count={3} />
    </ScrollView> : error ? <ScrollView contentContainerStyle={styles.page}>
      {top}
      <View style={styles.stateCard}>
        <View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={25} color={colors.error} /></View>
        <Text style={styles.stateTitle}>Rides couldn't load</Text>
        <Text style={styles.stateText}>{error}</Text>
        <Pressable onPress={() => { setLoading(true); load(); }} style={styles.retryButton}><Ionicons name="refresh" size={16} color="#fff" /><Text style={styles.retryText}>Try again</Text></Pressable>
      </View>
    </ScrollView> : showMap ? <View style={styles.mapPage}>
      {top}
      <View style={styles.mapWrap}><PoolMapView pools={filtered} /></View>
    </View> : <FlatList
      data={filtered}
      keyExtractor={(item) => item.pool_id}
      contentContainerStyle={styles.listPage}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.indigo} />}
      ListHeaderComponent={top}
      ListEmptyComponent={<View style={styles.stateCard}>
        <View style={styles.stateIcon}><Ionicons name="navigate-outline" size={25} color={colors.indigo} /></View>
        <Text style={styles.stateTitle}>{search || filter !== "All" ? "No rides match that filter" : "No open rides yet"}</Text>
        <Text style={styles.stateText}>{search || filter !== "All" ? "Try another route or reset the filters." : "Post your journey and UniPool will start looking for compatible travellers."}</Text>
        {!search && filter === "All" ? <Pressable onPress={() => router.push("/post-request")} style={styles.retryButton}><Ionicons name="add" size={16} color="#fff" /><Text style={styles.retryText}>Post a trip</Text></Pressable> : null}
      </View>}
      renderItem={({ item }) => <PoolCard
        pool={item}
        mine={item.user_id === user?.user_id}
        busy={requesting.has(item.pool_id)}
        onRequest={() => sendRequest(item)}
        onReport={() => setReportTarget({ user_id: item.user_id, user_name: item.user_name })}
        colors={colors}
        styles={styles}
      />}
    />}

    <PressableScale testID="create-pool-fab" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/post-request"); }} style={styles.fab} scaleTo={0.96}>
      <Ionicons name="add" size={20} color="#fff" /><Text style={styles.fabText}>Post trip</Text>
    </PressableScale>

    {reportTarget ? <ReportBlockModal visible onClose={() => setReportTarget(null)} userId={reportTarget.user_id} userName={reportTarget.user_name} onBlocked={load} /> : null}
  </SafeAreaView>;
}

function PoolCard({ pool, mine, busy, onRequest, onReport, colors, styles }: any) {
  const router = useRouter();
  const travelers = pool.confirmed_travelers || [];
  const score = Number(pool.match_score || 0);

  return <Pressable testID={`pool-card-${pool.pool_id}`} onPress={() => router.push({ pathname: "/pool/[poolId]", params: { poolId: pool.pool_id } })} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
    <View style={styles.cardHeader}>
      <View style={styles.person}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{pool.user_name?.[0]?.toUpperCase() || "U"}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}><Text style={styles.name}>{pool.user_name}{mine ? " · You" : ""}</Text>{!mine && score > 0 ? <View style={styles.matchPill}><Text style={styles.matchPillText}>{score}% match</Text></View> : null}</View>
          <View style={styles.identityRow}><RatingBadge avg={pool.user_rating_avg} count={pool.user_rating_count} /><UserBadges badges={pool.user_badges} compact /></View>
        </View>
      </View>
      {!mine ? <Pressable onPress={(event: any) => { event.stopPropagation?.(); onReport(); }} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={19} color={colors.muted} /></Pressable> : null}
    </View>

    <View style={styles.routeBox}>
      <View style={styles.routeRow}><View style={[styles.routeDot, { backgroundColor: colors.saffron }]} /><Text style={styles.routeText} numberOfLines={1}>{pool.from_location}</Text></View>
      <View style={styles.routeStem} />
      <View style={styles.routeRow}><View style={[styles.routeDot, { backgroundColor: colors.indigo }]} /><Text style={styles.routeText} numberOfLines={1}>{pool.to_location}</Text></View>
    </View>

    <View style={styles.detailRow}>
      <View style={styles.detail}><Ionicons name="time-outline" size={14} color={colors.muted} /><Text style={styles.detailText}>{formatDT(pool.travel_datetime)}</Text></View>
      {pool.companions > 0 ? <View style={styles.detail}><Ionicons name="people-outline" size={14} color={colors.muted} /><Text style={styles.detailText}>+{pool.companions}</Text></View> : null}
      {pool.luggage ? <View style={styles.detail}><Ionicons name="bag-handle-outline" size={14} color={colors.muted} /><Text style={styles.detailText}>{pool.luggage}</Text></View> : null}
    </View>

    {pool.notes ? <Text style={styles.notes} numberOfLines={2}>{pool.notes}</Text> : null}
    {travelers.length > 0 ? <View style={styles.travelTogether}><Ionicons name="people-circle-outline" size={16} color={colors.success} /><Text style={styles.travelTogetherText} numberOfLines={1}>{travelers.map((traveller: ConfirmedTraveler) => traveller.name.split(" ")[0]).join(", ")} confirmed</Text></View> : null}

    {!mine ? <RequestButton pool={pool} busy={busy} onRequest={onRequest} colors={colors} styles={styles} /> : <View style={styles.ownTrip}><Text style={styles.ownTripText}>Your trip</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></View>}
  </Pressable>;
}

function RequestButton({ pool, busy, onRequest, colors, styles }: any) {
  if (pool.my_request_status === "accepted") return <View style={styles.accepted}><Ionicons name="checkmark-circle" size={17} color={colors.success} /><Text style={styles.acceptedText}>You're travelling together</Text></View>;
  if (pool.my_request_status === "pending") return <View style={styles.pending}><Ionicons name="time-outline" size={16} color={colors.indigo} /><Text style={styles.pendingText}>Request sent</Text></View>;
  return <Pressable onPress={(event: any) => { event.stopPropagation?.(); onRequest(); }} disabled={busy} style={[styles.requestButton, busy && { opacity: .6 }]}>
    {busy ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="person-add-outline" size={16} color="#fff" /><Text style={styles.requestText}>{pool.my_request_status === "declined" ? "Request again" : "Request to join"}</Text></>}
  </Pressable>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  page: { width: "100%", maxWidth: 900, alignSelf: "center", padding: SPACING.lg, paddingBottom: 130 },
  listPage: { width: "100%", maxWidth: 900, alignSelf: "center", padding: SPACING.lg, paddingBottom: 130 },
  mapPage: { flex: 1, width: "100%", maxWidth: 1100, alignSelf: "center", padding: SPACING.lg, paddingBottom: 100 },
  mapWrap: { flex: 1, minHeight: 360, borderRadius: RADIUS.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  top: { width: "100%", marginBottom: 18 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  eyebrow: { color: colors.saffron, fontSize: 10, letterSpacing: 1.3, fontWeight: "900" },
  greeting: { color: colors.onSurface, fontFamily: FONT_DISPLAY, fontSize: FONT["2xl"], fontWeight: "900", marginTop: 2 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  iconButtonActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  searchBox: { height: 48, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, outlineStyle: "none" } as any,
  filterRow: { gap: 8, paddingTop: 12, paddingBottom: 3 },
  filterChip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 13, borderRadius: RADIUS.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.cream, borderColor: colors.saffron },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.onCream, fontWeight: "900" },
  resultsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  resultsText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  clearText: { color: colors.indigo, fontSize: 12, fontWeight: "800" },
  card: { width: "100%", maxWidth: 780, alignSelf: "center", backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: SPACING.lg, marginBottom: 12 },
  cardPressed: { transform: [{ scale: .995 }], borderColor: colors.borderStrong },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  avatarText: { color: colors.indigo, fontWeight: "900", fontSize: 15 },
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  name: { color: colors.onSurface, fontWeight: "900", fontSize: 14 },
  identityRow: { marginTop: 3 },
  matchPill: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  matchPillText: { color: colors.onCream, fontSize: 10, fontWeight: "900" },
  routeBox: { backgroundColor: colors.surface2, borderRadius: RADIUS.md, padding: 13, marginTop: 14 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: { width: 9, height: 9, borderRadius: 5 },
  routeStem: { width: 2, height: 15, backgroundColor: colors.borderStrong, marginLeft: 3.5, marginVertical: 2 },
  routeText: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "750" } as any,
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 11 },
  detail: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailText: { color: colors.muted, fontSize: 12 },
  notes: { color: colors.onSurface2, fontSize: 12, lineHeight: 18, marginTop: 10 },
  travelTogether: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 10 },
  travelTogetherText: { color: colors.success, fontSize: 11, fontWeight: "750", flex: 1 } as any,
  requestButton: { minHeight: 42, marginTop: 14, backgroundColor: colors.indigo, borderRadius: RADIUS.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 15 },
  requestText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  accepted: { marginTop: 14, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: RADIUS.pill, backgroundColor: colors.surface2 },
  acceptedText: { color: colors.success, fontSize: 12, fontWeight: "850" } as any,
  pending: { marginTop: 14, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: RADIUS.pill, backgroundColor: colors.surface2 },
  pendingText: { color: colors.indigo, fontSize: 12, fontWeight: "850" } as any,
  ownTrip: { marginTop: 14, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  ownTripText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  stateCard: { width: "100%", maxWidth: 520, alignSelf: "center", alignItems: "center", padding: 28, marginTop: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg },
  stateIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  stateTitle: { color: colors.onSurface, fontFamily: FONT_DISPLAY, fontSize: FONT.xl, fontWeight: "900", marginTop: 13, textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 5 },
  retryButton: { marginTop: 15, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.indigo, borderRadius: RADIUS.pill, paddingHorizontal: 16 },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  fab: { position: "absolute", right: 20, bottom: 92, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 17, borderRadius: 23, backgroundColor: colors.saffron, shadowColor: "#000", shadowOpacity: .13, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 13 },
});