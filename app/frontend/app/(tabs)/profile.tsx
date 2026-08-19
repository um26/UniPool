import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import BrandFooter from "@/src/components/BrandFooter";
import { usePushNotifications } from "@/src/hooks/use-push-notifications";

type ConfirmedTraveler = { user_id: string; name: string; email: string };

type Pool = {
  pool_id: string;
  from_location: string;
  to_location: string;
  travel_datetime: string;
  companions: number;
  status?: string;
  user_name?: string;
  user_email?: string;
  confirmed_travelers?: ConfirmedTraveler[];
};

type JoinRequest = {
  request_id: string;
  pool_id: string;
  from_location: string;
  to_location: string;
  travel_datetime: string;
  requester_id: string;
  requester_name: string;
  requester_rating_avg?: number | null;
  requester_rating_count?: number;
  status: string;
  created_at: string;
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const push = usePushNotifications();
  const [myPools, setMyPools] = useState<Pool[]>([]);
  const [gender, setGender] = useState<string>(user?.gender || "any");
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [incoming, setIncoming] = useState<JoinRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminPools, setAdminPools] = useState<Pool[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pools, reqs] = await Promise.all([api.myPools(), api.incomingRequests()]);
      setMyPools(pools);
      setIncoming(reqs);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (requestId: string, action: "accept" | "decline") => {
    setRespondingId(requestId);
    try {
      if (action === "accept") await api.acceptRequest(requestId);
      else await api.declineRequest(requestId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setRespondingId(null);
    }
  };

  const saveGender = async (g: string) => {
    setGender(g);
    try { await api.updateProfile({ gender: g }); Haptics.selectionAsync(); } catch {}
  };

  const remove = async (id: string) => {
    try { await api.deletePool(id); await load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const closeQuery = async (id: string) => {
    try { await api.closePool(id); await load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const reopenQuery = async (id: string) => {
    try { await api.reopenPool(id); await load(); Haptics.selectionAsync(); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const loadAdmin = async () => {
    setAdminLoading(true);
    try {
      const [stats, pools] = await Promise.all([api.adminStats(), api.adminPools()]);
      setAdminStats(stats);
      setAdminPools(pools);
    } catch (e: any) {
      Alert.alert("Admin error", e.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const toggleAdmin = () => {
    const next = !adminOpen;
    setAdminOpen(next);
    if (next && !adminStats) loadAdmin();
  };

  const adminRemove = async (id: string) => {
    try { await api.adminDeletePool(id); await loadAdmin(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const filtered = myPools.filter((p) => (tab === "open" ? (p.status ?? "open") === "open" : p.status === "closed"));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.indigo, "#3949AB"]} style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "U"}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.is_admin ? (
          <View style={styles.adminBadge}><Ionicons name="shield-checkmark" size={12} color={COLORS.indigo} /><Text style={styles.adminBadgeText}>Admin</Text></View>
        ) : null}
      </LinearGradient>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.pool_id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionLabel}>Preferences</Text>
            <View style={styles.prefRow}>
              {[
                { k: "any", label: "Any gender" },
                { k: "male", label: "Male" },
                { k: "female", label: "Female" },
                { k: "other", label: "Other" },
              ].map((g) => (
                <Pressable
                  key={g.k}
                  testID={`gender-${g.k}`}
                  onPress={() => saveGender(g.k)}
                  style={[styles.prefChip, gender === g.k && styles.prefChipActive]}
                >
                  <Text style={[styles.prefText, gender === g.k && { color: "#fff" }]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            {push.supported && (
              <Pressable
                testID="push-toggle"
                onPress={() => (push.subscribed ? push.unsubscribe() : push.subscribe())}
                disabled={push.busy || push.permission === "denied"}
                style={[styles.pushToggle, push.subscribed && styles.pushToggleActive]}
              >
                {push.busy ? (
                  <ActivityIndicator color={push.subscribed ? "#fff" : COLORS.indigo} size="small" />
                ) : (
                  <Ionicons name={push.subscribed ? "notifications" : "notifications-outline"} size={18} color={push.subscribed ? "#fff" : COLORS.indigo} />
                )}
                <Text style={[styles.pushToggleText, push.subscribed && { color: "#fff" }]}>
                  {push.permission === "denied"
                    ? "Notifications blocked in browser settings"
                    : push.subscribed
                    ? "Push notifications on"
                    : "Enable push notifications"}
                </Text>
              </Pressable>
            )}

            {incoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Ride Requests</Text>
                {incoming.map((r) => (
                  <View key={r.request_id} style={styles.reqCard} testID={`incoming-${r.request_id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqName}>{r.requester_name}</Text>
                      <Text style={styles.reqRoute}>{r.from_location} → {r.to_location}</Text>
                      <Text style={styles.reqWhen}>{fmt(r.travel_datetime)}</Text>
                    </View>
                    {respondingId === r.request_id ? (
                      <ActivityIndicator color={COLORS.indigo} />
                    ) : (
                      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                        <Pressable
                          testID={`decline-${r.request_id}`}
                          onPress={() => respond(r.request_id, "decline")}
                          style={[styles.reqBtn, styles.reqBtnDecline]}
                          hitSlop={8}
                        >
                          <Ionicons name="close" size={18} color={COLORS.error} />
                        </Pressable>
                        <Pressable
                          testID={`accept-${r.request_id}`}
                          onPress={() => respond(r.request_id, "accept")}
                          style={[styles.reqBtn, styles.reqBtnAccept]}
                          hitSlop={8}
                        >
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionLabel}>My Queries</Text>
            <View style={styles.segmentRow}>
              <Pressable testID="mine-tab-open" onPress={() => setTab("open")} style={[styles.segment, tab === "open" && styles.segmentActive]}>
                <Text style={[styles.segmentText, tab === "open" && styles.segmentTextActive]}>Open</Text>
              </Pressable>
              <Pressable testID="mine-tab-closed" onPress={() => setTab("closed")} style={[styles.segment, tab === "closed" && styles.segmentActive]}>
                <Text style={[styles.segmentText, tab === "closed" && styles.segmentTextActive]}>Closed</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.mine} testID={`mine-item-${item.pool_id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mineRoute}>{item.from_location} → {item.to_location}</Text>
              <Text style={styles.mineWhen}>{fmt(item.travel_datetime)}</Text>
              {(item.confirmed_travelers?.length ?? 0) > 0 && (
                <View style={styles.mineTravelingRow}>
                  <Ionicons name="car-sport" size={12} color={COLORS.success} />
                  <Text style={styles.mineTravelingText} numberOfLines={1}>
                    Traveling with {item.confirmed_travelers!.map((t) => t.name.split(" ")[0]).join(", ")}
                  </Text>
                </View>
              )}
            </View>
            {tab === "open" ? (
              <>
                <Pressable testID={`edit-${item.pool_id}`} onPress={() => router.push(`/post-request?edit=${item.pool_id}`)} style={styles.actionBtn} hitSlop={8}>
                  <Ionicons name="pencil" size={20} color={COLORS.indigo} />
                </Pressable>
                <Pressable testID={`close-${item.pool_id}`} onPress={() => closeQuery(item.pool_id)} style={styles.actionBtn} hitSlop={8}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                </Pressable>
              </>
            ) : (
              <Pressable testID={`reopen-${item.pool_id}`} onPress={() => reopenQuery(item.pool_id)} style={styles.actionBtn} hitSlop={8}>
                <Ionicons name="refresh" size={20} color={COLORS.indigo} />
              </Pressable>
            )}
            <Pressable testID={`delete-${item.pool_id}`} onPress={() => remove(item.pool_id)} hitSlop={8} style={styles.actionBtn}>
              <Ionicons name="trash" size={20} color={COLORS.error} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyMine}>
            {tab === "open" ? "No open queries. Post one from the Pool tab." : "No closed queries yet."}
          </Text>
        }
        ListFooterComponent={
          <>
            {user?.is_admin ? (
              <View style={{ marginTop: SPACING.xl }}>
                <Pressable testID="admin-panel-toggle" onPress={toggleAdmin} style={styles.adminToggle}>
                  <Ionicons name="shield" size={16} color={COLORS.indigo} />
                  <Text style={styles.adminToggleText}>Admin panel</Text>
                  <Ionicons name={adminOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.indigo} />
                </Pressable>
                {adminOpen && (
                  <View style={styles.adminPanel}>
                    {adminLoading ? (
                      <ActivityIndicator color={COLORS.indigo} />
                    ) : (
                      <>
                        {adminStats && (
                          <View style={styles.statsRow}>
                            <Stat label="Users" value={adminStats.total_users} />
                            <Stat label="Open" value={adminStats.open_pools} />
                            <Stat label="Closed" value={adminStats.closed_pools} />
                          </View>
                        )}
                        {adminPools.map((p) => (
                          <View key={p.pool_id} style={styles.adminRow} testID={`admin-pool-${p.pool_id}`}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.adminRoute}>{p.from_location} → {p.to_location}</Text>
                              <Text style={styles.adminMeta}>{p.user_name} · {p.user_email} · {p.status ?? "open"}</Text>
                            </View>
                            <Pressable testID={`admin-delete-${p.pool_id}`} onPress={() => adminRemove(p.pool_id)} hitSlop={8}>
                              <Ionicons name="trash" size={18} color={COLORS.error} />
                            </Pressable>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            ) : null}
            <Pressable testID="logout-button" onPress={signOut} style={styles.logout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
              <Text style={styles.logoutText}>Sign out</Text>
            </Pressable>
            <BrandFooter />
          </>
        }
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { alignItems: "center", paddingVertical: SPACING.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  avatarText: { color: COLORS.indigo, fontSize: 28, fontWeight: "800" },
  name: { color: "#fff", fontSize: FONT.xl, fontWeight: "800", fontFamily: FONT_DISPLAY },
  email: { color: "rgba(255,236,194,0.9)", marginTop: 4 },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.cream, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: SPACING.sm },
  adminBadgeText: { color: COLORS.indigo, fontWeight: "800", fontSize: 11 },
  sectionLabel: { fontSize: FONT.sm, fontWeight: "700", color: COLORS.muted, marginTop: SPACING.lg, marginBottom: SPACING.sm, letterSpacing: 0.8, textTransform: "uppercase" },
  prefRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  prefChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border },
  prefChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  prefText: { color: COLORS.onSurface, fontWeight: "600", fontSize: 13 },

  pushToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: SPACING.md, backgroundColor: "#fff", borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.indigo, paddingVertical: 12 },
  pushToggleActive: { backgroundColor: COLORS.indigo },
  pushToggleText: { color: COLORS.indigo, fontWeight: "700", fontSize: 13 },

  segmentRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  segment: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border },
  segmentActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  segmentText: { fontWeight: "700", color: COLORS.onSurface },
  segmentTextActive: { color: "#fff" },

  mine: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  mineRoute: { fontSize: FONT.base, fontWeight: "700", color: COLORS.onSurface },
  mineWhen: { color: COLORS.muted, marginTop: 2, fontSize: FONT.sm },
  mineTravelingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  mineTravelingText: { color: COLORS.success, fontSize: 11, fontWeight: "700", flex: 1 },
  actionBtn: { padding: 4 },
  emptyMine: { color: COLORS.muted, padding: SPACING.md, textAlign: "center" },

  reqCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.saffron, gap: SPACING.sm },
  reqName: { fontSize: FONT.base, fontWeight: "700", color: COLORS.onSurface },
  reqRoute: { color: COLORS.onSurface, marginTop: 2, fontSize: FONT.sm, fontWeight: "600" },
  reqWhen: { color: COLORS.muted, marginTop: 1, fontSize: FONT.sm },
  reqBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  reqBtnAccept: { backgroundColor: COLORS.success },
  reqBtnDecline: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.error },

  adminToggle: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12, paddingHorizontal: SPACING.lg, justifyContent: "center" },
  adminToggleText: { color: COLORS.indigo, fontWeight: "700", flex: 1, textAlign: "center" },
  adminPanel: { marginTop: SPACING.sm, backgroundColor: "#fff", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  statBox: { flex: 1, alignItems: "center", backgroundColor: COLORS.surface2, borderRadius: RADIUS.md, paddingVertical: SPACING.sm },
  statValue: { fontSize: FONT.xl, fontWeight: "800", color: COLORS.indigo },
  statLabel: { fontSize: FONT.sm, color: COLORS.muted, marginTop: 2 },
  adminRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  adminRoute: { fontWeight: "700", color: COLORS.onSurface },
  adminMeta: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 2 },

  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.pill, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.error },
  logoutText: { color: COLORS.error, fontWeight: "700" },
});
