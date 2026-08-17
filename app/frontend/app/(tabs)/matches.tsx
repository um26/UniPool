import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";

type Pool = {
  pool_id: string; user_id: string; user_name: string; user_email: string;
  from_location: string; to_location: string; travel_datetime: string;
  gender_preference: string; companions: number; luggage?: string | null; notes?: string | null;
};

export default function MatchesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.myMatches()); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

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
        <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.pool_id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
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
                <Text style={styles.when}>{new Date(item.travel_datetime).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
              </View>
              <Text style={styles.name}>{item.user_name}</Text>
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
              </View>
            </View>
          )}
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
  card: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  matchBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  matchBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  when: { color: COLORS.muted, fontWeight: "600" },
  name: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface, marginBottom: 6 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.sm },
  route: { fontSize: FONT.base, color: COLORS.onSurface, fontWeight: "600" },
  notes: { color: COLORS.muted, fontStyle: "italic", marginBottom: SPACING.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.indigo, paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.pill },
  ctaRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  ctaGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.indigo, flex: 0 },
  ctaText: { color: "#fff", fontWeight: "700" },
});
