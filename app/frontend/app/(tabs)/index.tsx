import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import RatingBadge from "@/src/components/RatingBadge";
import PoolMapView from "@/src/components/PoolMapView";

type Pool = {
  pool_id: string; user_id: string; user_name: string; user_email: string;
  from_location: string; to_location: string; travel_datetime: string;
  gender_preference: string; companions: number; luggage?: string | null; notes?: string | null;
  user_rating_avg?: number | null; user_rating_count?: number;
};

const CHIPS = ["All", "Today", "Tomorrow", "This week", "Airport", "Railway"];

function formatDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

export default function HomeFeed() {
  const router = useRouter();
  const { user } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chip, setChip] = useState("All");
  const [search, setSearch] = useState("");
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    try { const list = await api.listPools(); setPools(list); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const filtered = useMemo(() => pools.filter((p) => {
    if (chip === "Today" && !isSameDay(p.travel_datetime, new Date())) return false;
    if (chip === "Tomorrow") {
      const t = new Date(); t.setDate(t.getDate() + 1);
      if (!isSameDay(p.travel_datetime, t)) return false;
    }
    if (chip === "This week") {
      const d = new Date(p.travel_datetime);
      const now = new Date();
      const weekOut = new Date(); weekOut.setDate(now.getDate() + 7);
      if (d < now || d > weekOut) return false;
    }
    if (chip === "Airport" && !/airport|blr|del|bom|maa|hyd/i.test(`${p.from_location} ${p.to_location}`)) return false;
    if (chip === "Railway" && !/station|railway|junction|jn/i.test(`${p.from_location} ${p.to_location}`)) return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = `${p.from_location} ${p.to_location} ${p.user_name}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [pools, chip, search]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.indigo, "#283593"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.hello}>Namaste, {user?.name?.split(" ")[0] || "traveller"}</Text>
            <Text style={styles.subhello}>Where's your next journey?</Text>
          </View>
          <Pressable testID="toggle-map-view" onPress={() => { Haptics.selectionAsync(); setShowMap((m) => !m); }} style={styles.avatar}>
            <Ionicons name={showMap ? "list" : "map"} size={18} color={COLORS.indigo} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="rgba(255,236,194,0.7)" />
          <TextInput
            testID="pool-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search route or name..."
            placeholderTextColor="rgba(255,236,194,0.6)"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable testID="clear-search" onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="rgba(255,236,194,0.7)" />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CHIPS.map((c) => (
            <Pressable
              key={c}
              testID={`chip-${c.toLowerCase().replace(" ", "-")}`}
              onPress={() => { Haptics.selectionAsync(); setChip(c); }}
              style={[styles.chip, chip === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, chip === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View>
      ) : showMap ? (
        <PoolMapView pools={filtered} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.pool_id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.indigo} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={56} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No pools yet</Text>
              <Text style={styles.emptySub}>Be the first to post a cab-pool for this route.</Text>
            </View>
          }
          renderItem={({ item }) => <PoolCard pool={item} mine={item.user_id === user?.user_id} />}
        />
      )}

      <PressableScale
        testID="create-pool-fab"
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/post-request"); }}
        style={styles.fab}
        scaleTo={0.92}
      >
        <LinearGradient colors={[COLORS.saffron, "#F57F17"]} style={styles.fabBg}>
          <Ionicons name="add" size={26} color="#fff" />
          <Text style={styles.fabText}>Post Pool</Text>
        </LinearGradient>
      </PressableScale>
    </SafeAreaView>
  );
}

function PoolCard({ pool, mine }: { pool: Pool; mine: boolean }) {
  return (
    <View style={styles.card} testID={`pool-card-${pool.pool_id}`}>
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}><Text style={{ color: COLORS.indigo, fontWeight: "700" }}>{pool.user_name?.[0]?.toUpperCase() || "U"}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{pool.user_name}{mine && <Text style={{ color: COLORS.saffron }}>  (you)</Text>}</Text>
          <Text style={styles.cardWhen}>{formatDT(pool.travel_datetime)}</Text>
          <View style={{ marginTop: 3 }}>
            <RatingBadge avg={pool.user_rating_avg} count={pool.user_rating_count} />
          </View>
        </View>
        {pool.gender_preference === "same" && (
          <View style={styles.badge}><Text style={styles.badgeText}>Same-gender</Text></View>
        )}
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.dotRow}><View style={[styles.dot, { backgroundColor: COLORS.saffron }]} /><Text style={styles.routeText}>{pool.from_location}</Text></View>
        <View style={styles.connector} />
        <View style={styles.dotRow}><View style={[styles.dot, { backgroundColor: COLORS.indigo }]} /><Text style={styles.routeText}>{pool.to_location}</Text></View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}><Ionicons name="people" size={14} color={COLORS.onCream} /><Text style={styles.metaText}>+{pool.companions} with</Text></View>
        {pool.luggage ? <View style={styles.metaPill}><Ionicons name="briefcase" size={14} color={COLORS.onCream} /><Text style={styles.metaText}>{pool.luggage}</Text></View> : null}
      </View>

      {pool.notes ? <Text style={styles.notes}>“{pool.notes}”</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hello: { color: COLORS.cream, fontSize: FONT.xl, fontWeight: "800", fontFamily: FONT_DISPLAY },
  subhello: { color: "rgba(255,236,194,0.8)", marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" },
  chipRow: { paddingTop: SPACING.md, paddingRight: SPACING.lg, gap: SPACING.sm },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: "rgba(255,236,194,0.12)", borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10, marginTop: SPACING.lg, borderWidth: 1, borderColor: "rgba(255,236,194,0.25)" },
  searchInput: { flex: 1, color: COLORS.cream, fontSize: FONT.base },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,236,194,0.15)", borderWidth: 1, borderColor: "rgba(255,236,194,0.35)", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.saffron, borderColor: COLORS.saffron },
  chipText: { color: COLORS.cream, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyTitle: { marginTop: SPACING.md, fontSize: FONT.xl, fontWeight: "700", color: COLORS.onSurface },
  emptySub: { marginTop: 4, color: COLORS.muted },

  card: {
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: "rgba(226,213,201,0.6)",
    shadowColor: "#1A237E", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  cardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface },
  cardWhen: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 2 },
  badge: { backgroundColor: COLORS.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { color: COLORS.onCream, fontSize: 11, fontWeight: "700" },

  routeBlock: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs },
  dotRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  connector: { width: 2, height: 14, backgroundColor: COLORS.borderStrong, marginLeft: 4 },
  routeText: { color: COLORS.onSurface, fontSize: FONT.base, fontWeight: "600", flex: 1 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.cream, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6 },
  metaText: { fontSize: 12, color: COLORS.onCream, fontWeight: "600" },
  notes: { marginTop: SPACING.md, color: COLORS.muted, fontStyle: "italic" },

  fab: { position: "absolute", right: SPACING.lg, bottom: 90, borderRadius: RADIUS.pill, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  fabBg: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 6 },
  fabText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
});
