import React, { useCallback, useState, useRef, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable, Linking, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import RatingBadge from "@/src/components/RatingBadge";
import UserBadges from "@/src/components/UserBadges";
import RatingModal from "@/src/components/RatingModal";
import Confetti from "@/src/components/Confetti";
import ReportBlockModal from "@/src/components/ReportBlockModal";
import { PoolFeedSkeleton } from "@/src/components/Skeleton";

type Pool = {
  pool_id: string; user_id: string; user_name: string; user_email: string;
  from_location: string; to_location: string; travel_datetime: string;
  gender_preference: string; companions: number; luggage?: string | null; notes?: string | null;
  user_rating_avg?: number | null; user_rating_count?: number;
  user_badges?: { id: string; label: string; icon: string }[];
};

type ConfirmedRide = {
  pool_id: string; from_location: string; to_location: string; travel_datetime: string;
  pool_status: string; other_user_id: string; other_user_name: string; other_user_email: string;
  other_user_rating_avg?: number | null; other_user_rating_count?: number; my_role: "owner" | "traveler";
  other_user_badges?: { id: string; label: string; icon: string }[];
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function MatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [items, setItems] = useState<Pool[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ user_id: string; user_name: string; pool_id: string } | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ user_id: string; user_name: string } | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const knownConfirmedKeys = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [matches, rides] = await Promise.all([api.myMatches(), api.confirmedMatches()]);
      setItems(matches);
      setConfirmed(rides);

      const keysNow = new Set<string>(rides.map((r: ConfirmedRide) => `${r.pool_id}:${r.other_user_id}`));
      if (knownConfirmedKeys.current) {
        const grew = [...keysNow].some((k) => !knownConfirmedKeys.current!.has(k));
        if (grew) setConfettiKey((k) => k + 1);
      }
      knownConfirmedKeys.current = keysNow;
    }
    catch (e: any) {
      console.warn(e);
      setError(e?.message || "Unable to load your matches.");
    }
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
      <Confetti burstKey={confettiKey} />
      <LinearGradient colors={isDark ? [colors.surface2, colors.surface2] : [colors.saffron, "#F57F17"]} style={styles.header}>
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
      ) : error ? (
        <View style={styles.errorState}>
          <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={28} color={colors.error} /></View>
          <Text style={styles.emptyTitle}>Couldn't load matches</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading matches" onPress={() => { setLoading(true); load(); }} style={styles.retry}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.ctaText}>Try again</Text>
          </Pressable>
        </View>
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
                            <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.name}>{ride.other_user_name}</Text>
                      <View style={{ marginBottom: SPACING.sm }}>
                        <RatingBadge avg={ride.other_user_rating_avg} count={ride.other_user_rating_count} />
                        <UserBadges badges={ride.other_user_badges} compact />
                      </View>
                      <View style={styles.routeRow}>
                        <Ionicons name="location" size={16} color={colors.saffron} />
                        <Text style={styles.route}>{ride.from_location}</Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.muted} />
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
                          <Ionicons name="star" size={16} color={colors.saffron} />
                        </Pressable>
                        <Pressable
                          testID={`remove-${key}`}
                          onPress={() => removeTraveler(ride)}
                          disabled={removingKey === key}
                          style={[styles.cta, styles.ctaDanger]}
                        >
                          {removingKey === key ? <ActivityIndicator size="small" color={colors.error} /> : <Ionicons name="close-circle-outline" size={16} color={colors.error} />}
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
              <Ionicons name="calendar-clear-outline" size={64} color={colors.borderStrong} />
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
                    <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.name}>{item.user_name}</Text>
              <View style={{ marginBottom: SPACING.sm }}>
                <RatingBadge avg={item.user_rating_avg} count={item.user_rating_count} />
                <UserBadges badges={item.user_badges} compact />
              </View>
              <View style={styles.routeRow}>
                <Ionicons name="location" size={16} color={colors.saffron} />
                <Text style={styles.route}>{item.from_location}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.muted} />
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
                  <Ionicons name="mail" size={16} color={colors.indigo} />
                </Pressable>
                <Pressable
                  testID={`rate-${item.pool_id}`}
                  onPress={() => setRatingTarget({ user_id: item.user_id, user_name: item.user_name, pool_id: item.pool_id })}
                  style={[styles.cta, styles.ctaGhost]}
                >
                  <Ionicons name="star" size={16} color={colors.saffron} />
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

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : "rgba(255,255,255,0.18)" },
  title: { color: isDark ? colors.onSurface : "#fff", fontSize: FONT["2xl"], fontWeight: "800", fontFamily: FONT_DISPLAY },
  sub: { color: isDark ? colors.onSurface2 : "rgba(255,255,255,0.9)", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xl },
  errorIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, marginBottom: SPACING.md },
  retry: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.indigo, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: SPACING.lg },
  empty: { alignItems: "center", paddingVertical: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { marginTop: SPACING.md, fontSize: FONT.xl, fontWeight: "700", color: colors.onSurface },
  emptySub: { marginTop: 4, color: colors.muted, textAlign: "center" },
  sectionLabel: { fontSize: FONT.sm, fontWeight: "700", color: colors.muted, marginBottom: SPACING.sm, letterSpacing: 0.8, textTransform: "uppercase" },
  card: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rideCard: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.success, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  matchBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  matchBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  confirmedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.indigo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  confirmedBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  when: { color: colors.muted, fontWeight: "600" },
  name: { fontSize: FONT.lg, fontWeight: "700", color: colors.onSurface, marginBottom: 6 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm },
  route: { fontSize: FONT.base, color: colors.onSurface, fontWeight: "600" },
  notes: { color: colors.muted, fontStyle: "italic", marginBottom: SPACING.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.indigo, paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.pill },
  ctaRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  ctaGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.indigo, flex: 0 },
  ctaDanger: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.error, flex: 0 },
  ctaText: { color: "#fff", fontWeight: "700" },
});
