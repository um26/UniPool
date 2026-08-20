import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable, Linking, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import RatingBadge from "@/src/components/RatingBadge";
import RatingModal from "@/src/components/RatingModal";
import ReportBlockModal from "@/src/components/ReportBlockModal";
import { PoolFeedSkeleton } from "@/src/components/Skeleton";

type Pool = {
  pool_id: string; user_id: string; user_name: string; user_email: string;
  from_location: string; to_location: string; travel_datetime: string;
  gender_preference: string; companions: number; luggage?: string | null; notes?: string | null;
  user_rating_avg?: number | null; user_rating_count?: number;
};

type ConfirmedRide = {
  pool_id: string; from_location: string; to_location: string; travel_datetime: string;
  pool_status: string; other_user_id: string; other_user_name: string; other_user_email: string;
  other_user_rating_avg?: number | null; other_user_rating_count?: number; my_role: "owner" | "traveler";
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function MatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Pool[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ user_id: string; user_name: string; pool_id: string } | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ user_id: string; user_name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [matches, rides] = await Promise.all([api.myMatches(), api.confirmedMatches()]);
      setItems(matches);
      setConfirmed(rides);
    }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const removeTraveler = (ride: ConfirmedRide) => {
    Alert.alert(
      "Remove this ride?",
      `You'll no longer be traveling together with ${ride.other_user_name.split(" ")[0]} on this pool.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive", onPress: async () => {
            const key = `${ride.pool_id}:${ride.other_user_id}`;
            setRemovingKey(key);
            try {
              const removeId = ride.my_role === "owner" ? ride.other_user_id : (user?.user_id as string);
              await api.removeTraveler(ride.pool_id, removeId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch (e: any) {
              Alert.alert("Couldn't remove", e.message || "Try again");
            } finally {
              setRemovingKey(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.saffron, "#F57F17"]} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md }}>
          <Ionicons name="sparkles" size={26} color="#fff" />
          <View>
            <Text style={styles.title}>Your Matches</Text>
            <Text style={styles.sub}>Fellow travellers within a ±1 hour window</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}>
          <PoolFeedSkeleton count={3} />
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.pool_id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            confirmed.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Traveling Together</Text>
                {confirmed.map((ride) => {
                  const key = `${ride.pool_id}:${ride.other_user_id}`;
                  return (
                    <View key={key} style={styles.rideCard} testID={`confirmed-${key}`}>
                      <View style={styles.rowTop}>
                        <View style={styles.confirmedBadge}><Ionicons name="car-sport" size={12} color="#fff" /><Text style={styles.confirmedBadgeText}>CONFIRMED</Text></View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                          <Text style={styles.when}>{fmtWhen(ride.travel_datetime)}</Text>
                          <Pressable testID={`more-confirmed-${key}`} onPress={() => setReportTarget({ user_id: ride.other_user_id, user_name: ride.other_user_name })} hitSlop={8}>
                            <Ionicons name="ellipsis-vertical" size={16} color={COLORS.muted} />
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.name}>{ride.other_user_name}</Text>
                      <View style={{ marginBottom: SPACING.sm }}>
                        <RatingBadge avg={ride.other_user_rating_avg} count={ride.other_user_rating_count} />
                      </View>
                      <View style={styles.routeRow}>
                        <Ionicons name="location" size={16} color={COLORS.saffron} />
                        <Text style={styles.route}>{ride.from_location}</Text>
                        <Ionicons name="arrow-forward" size={14} color={COLORS.muted} />
                        <Text style={styles.route}>{ride.to_location}</Text>
                      </View>
                      <View style={styles.ctaRow}>
                        <Pressable
                          testID={`chat-${key}`}
                          onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: ride.other_user_id, name: ride.other_user_name } })}
                          style={[styles.cta, { flex: 1 }]}
                        >
                          <Ionicons name="chatbubble" size={16} color="#fff" />
                          <Text style={styles.ctaText}>Chat</Text>
                        </Pressable>
                        <Pressable
                          testID={`rate-confirmed-${key}`}
                          onPress={() => setRatingTarget({ user_id: ride.other_user_id, user_name: ride.other_user_name, pool_id: ride.pool_id })}
                          style={[styles.cta, styles.ctaGhost]}
                        >
                          <Ionicons name="star" size={16} color={COLORS.saffron} />
                        </Pressable>
                        <Pressable
                          testID={`remove-${key}`}
                          onPress={() => removeTraveler(ride)}
                          disabled={removingKey === key}
                          style={[styles.cta, styles.ctaDanger]}
                        >
                          {removingKey === key ? <ActivityIndicator size="small" color={COLORS.error} /> : <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>Route Matches</Text>
              </>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-clear-outline" size={64} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySub}>Post a request from the Pool tab — we'll email you when someone matches.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`match-card-${item.pool_id}`}>
              <View style={styles.rowTop}>
                <View style={styles.matchBadge}><Ionicons name="flash" size={12} color="#fff" /><Text style={styles.matchBadgeText}>MATCH</Text></View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                  <Text style={styles.when}>{fmtWhen(item.travel_datetime)}</Text>
                  <Pressable testID={`more-match-${item.pool_id}`} onPress={() => setReportTarget({ user_id: item.user_id, user_name: item.user_name })} hitSlop={8}>
                    <Ionicons name="ellipsis-vertical" size={16} color={COLORS.muted} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.name}>{item.user_name}</Text>
              <View style={{ marginBottom: SPACING.sm }}>
                <RatingBadge avg={item.user_rating_avg} count={item.user_rating_count} />
              </View>
              <View style={styles.routeRow}>
                <Ionicons name="location" size={16} color={COLORS.saffron} />
                <Text style={styles.route}>{item.from_location}</Text>
                <Ionicons name="arrow-forward" size={14} color={COLORS.muted} />
                <Text style={styles.route}>{item.to_location}</Text>
              </View>
              {item.notes ? <Text style={styles.notes}>“{item.notes}”</Text> : null}
              <View style={styles.ctaRow}>
                <Pressable
                  testID={`message-${item.pool_id}`}
                  onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: item.user_id, name: item.user_name } })}
                  style={[styles.cta, { flex: 1 }]}
                >
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                  <Text style={styles.ctaText}>Message</Text>
                </Pressable>
                <Pressable
                  testID={`connect-${item.pool_id}`}
                  onPress={() => Linking.openURL(`mailto:${item.user_email}?subject=UniPool%20-%20Cab%20Share&body=Hi%20${encodeURIComponent(item.user_name)},%20saw%20your%20UniPool%20request.%20Want%20to%20share%20the%20cab%3F`)}
                  style={[styles.cta, styles.ctaGhost]}
                >
                  <Ionicons name="mail" size={16} color={COLORS.indigo} />
                </Pressable>
                <Pressable
                  testID={`rate-${item.pool_id}`}
                  onPress={() => setRatingTarget({ user_id: item.user_id, user_name: item.user_name, pool_id: item.pool_id })}
                  style={[styles.cta, styles.ctaGhost]}
                >
                  <Ionicons name="star" size={16} color={COLORS.saffron} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {ratingTarget && (
        <RatingModal
          visible={!!ratingTarget}
          onClose={() => setRatingTarget(null)}
          userId={ratingTarget.user_id}
          userName={ratingTarget.user_name}
          poolId={ratingTarget.pool_id}
          onSubmitted={load}
        />
      )}

      {reportTarget && (
        <ReportBlockModal
          visible={!!reportTarget}
          onClose={() => setReportTarget(null)}
          userId={reportTarget.user_id}
          userName={reportTarget.user_name}
          onBlocked={load}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  title: { color: "#fff", fontSize: FONT["2xl"], fontWeight: "800", fontFamily: FONT_DISPLAY },
  sub: { color: "rgba(255,255,255,0.9)", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { marginTop: SPACING.md, fontSize: FONT.xl, fontWeight: "700", color: COLORS.onSurface },
  emptySub: { marginTop: 4, color: COLORS.muted, textAlign: "center" },
  sectionLabel: { fontSize: FONT.sm, fontWeight: "700", color: COLORS.muted, marginBottom: SPACING.sm, letterSpacing: 0.8, textTransform: "uppercase" },
  card: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rideCard: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.success, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  matchBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  matchBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  confirmedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.indigo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  confirmedBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  when: { color: COLORS.muted, fontWeight: "600" },
  name: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface, marginBottom: 6 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm },
  route: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: "600" },
  notes: { color: COLORS.muted, fontStyle: "italic", marginBottom: SPACING.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.indigo, paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.pill },
  ctaRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  ctaGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.indigo, flex: 0 },
  ctaDanger: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.error, flex: 0 },
  ctaText: { color: "#fff", fontWeight: "700" },
});
