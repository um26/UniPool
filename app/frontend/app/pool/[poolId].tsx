import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Share as RNShare } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import RatingBadge from "@/src/components/RatingBadge";
import PoolMapView from "@/src/components/PoolMapView";
import ReportBlockModal from "@/src/components/ReportBlockModal";

const WEB_BASE_URL = "https://uni-pool-ruddy.vercel.app";

type ConfirmedTraveler = { user_id: string; name: string; email: string };
type Pool = {
  pool_id: string; user_id: string; user_name: string; user_email: string;
  from_location: string; to_location: string; travel_datetime: string;
  gender_preference: string; companions: number; luggage?: string | null; notes?: string | null;
  user_rating_avg?: number | null; user_rating_count?: number;
  confirmed_travelers?: ConfirmedTraveler[];
  my_request_status?: "pending" | "accepted" | "declined" | null;
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export default function PoolDetailScreen() {
  const { poolId } = useLocalSearchParams<{ poolId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    try { setPool(await api.getPool(poolId as string)); }
    catch (e: any) { Alert.alert("Not found", "This pool no longer exists."); router.back(); }
    finally { setLoading(false); }
  }, [poolId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const share = async () => {
    const url = `${WEB_BASE_URL}/pool/${poolId}`;
    const text = pool ? `Join my UniPool ride: ${pool.from_location} → ${pool.to_location} — ${url}` : url;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: "UniPool ride", text, url }); return; } catch { /* user cancelled */ }
    }
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); Alert.alert("Link copied", "Pool link copied to clipboard."); return; } catch {}
    }
    try { await RNShare.share({ message: text }); } catch {}
  };

  const sendRequest = async () => {
    if (!pool) return;
    setRequesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.requestToJoin(pool.pool_id);
      setPool({ ...pool, my_request_status: "pending" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Couldn't send request", e.message || "Try again");
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !pool) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.indigo} />
        </View>
      </SafeAreaView>
    );
  }

  const mine = pool.user_id === user?.user_id;
  const travelers = pool.confirmed_travelers || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Pool Details</Text>
        <View style={{ flexDirection: "row", gap: SPACING.md }}>
          <Pressable testID="share-btn" onPress={share} hitSlop={10}>
            <Ionicons name="share-outline" size={22} color={COLORS.onSurface} />
          </Pressable>
          {!mine && (
            <Pressable testID="detail-more-btn" onPress={() => setShowReport(true)} hitSlop={10}>
              <Ionicons name="ellipsis-vertical" size={22} color={COLORS.onSurface} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}>
        <View style={styles.ownerRow}>
          <View style={styles.avatar}><Text style={{ color: COLORS.indigo, fontWeight: "800", fontSize: 18 }}>{pool.user_name?.[0]?.toUpperCase() || "U"}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ownerName}>{pool.user_name}{mine ? "  (you)" : ""}</Text>
            <RatingBadge avg={pool.user_rating_avg} count={pool.user_rating_count} />
          </View>
          {pool.gender_preference === "same" && (
            <View style={styles.badge}><Text style={styles.badgeText}>Same-gender</Text></View>
          )}
        </View>

        <View style={styles.mapWrap}>
          <PoolMapView pools={[pool]} />
        </View>

        <View style={styles.card}>
          <Row icon="location" iconColor={COLORS.saffron} label="Pickup" value={pool.from_location} />
          <Row icon="flag" iconColor={COLORS.indigo} label="Drop" value={pool.to_location} />
          <Row icon="time" iconColor={COLORS.muted} label="Departs" value={fmtWhen(pool.travel_datetime)} />
          <Row icon="people" iconColor={COLORS.muted} label="Companions" value={`+${pool.companions} already with them`} />
          {pool.luggage ? <Row icon="briefcase" iconColor={COLORS.muted} label="Luggage" value={pool.luggage} /> : null}
        </View>

        {pool.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>“{pool.notes}”</Text>
          </View>
        ) : null}

        {travelers.length > 0 && (
          <View style={styles.travelersCard}>
            <Text style={styles.notesLabel}>Traveling Together ({travelers.length})</Text>
            {travelers.map((t) => (
              <View key={t.user_id} style={styles.travelerRow}>
                <Ionicons name="car-sport" size={16} color={COLORS.success} />
                <Text style={styles.travelerName}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {!mine && (
        <View style={styles.footer}>
          <Pressable
            testID="detail-message-btn"
            onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: pool.user_id, name: pool.user_name } })}
            style={styles.messageBtn}
          >
            <Ionicons name="chatbubble" size={18} color={COLORS.indigo} />
          </Pressable>

          {pool.my_request_status === "accepted" ? (
            <View style={[styles.requestBtn, { backgroundColor: COLORS.success }]}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.requestBtnText}>Confirmed for this ride</Text>
            </View>
          ) : pool.my_request_status === "pending" ? (
            <View style={[styles.requestBtn, { backgroundColor: COLORS.cream }]}>
              <Ionicons name="time-outline" size={18} color={COLORS.indigo} />
              <Text style={[styles.requestBtnText, { color: COLORS.indigo }]}>Request sent</Text>
            </View>
          ) : (
            <Pressable testID="detail-request-btn" onPress={sendRequest} disabled={requesting} style={[styles.requestBtn, { backgroundColor: COLORS.indigo }, requesting && { opacity: 0.6 }]}>
              {requesting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="hand-left-outline" size={18} color="#fff" />
                  <Text style={styles.requestBtnText}>{pool.my_request_status === "declined" ? "Request again" : "Request to join"}</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}

      <ReportBlockModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        userId={pool.user_id}
        userName={pool.user_name}
        poolId={pool.pool_id}
        onBlocked={() => router.back()}
      />
    </SafeAreaView>
  );
}

function Row({ icon, iconColor, label, value }: { icon: any; iconColor: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: "#fff" },
  headerTitle: { fontSize: FONT.lg, fontWeight: "800", color: COLORS.onSurface },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" },
  ownerName: { fontSize: FONT.lg, fontWeight: "800", color: COLORS.onSurface, marginBottom: 2, fontFamily: FONT_DISPLAY },
  badge: { backgroundColor: COLORS.indigo, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  mapWrap: { height: 220, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  card: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md, marginBottom: SPACING.lg },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  rowLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  rowValue: { fontSize: FONT.base, fontWeight: "600", color: COLORS.onSurface, marginTop: 2 },
  notesCard: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  notesLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  notesText: { color: COLORS.onSurface, fontStyle: "italic" },
  travelersCard: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.success, marginBottom: SPACING.lg },
  travelerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  travelerName: { color: COLORS.onSurface, fontWeight: "600" },
  footer: { flexDirection: "row", gap: SPACING.md, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  messageBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.indigo, backgroundColor: "#fff" },
  requestBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: RADIUS.pill, paddingVertical: 14 },
  requestBtnText: { color: "#fff", fontWeight: "800", fontSize: FONT.base },
});
