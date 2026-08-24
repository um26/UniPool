import React, { useCallback, useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";

import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

type Convo = {
  other_user_id: string;
  name: string;
  picture?: string | null;
  last_message: string;
  last_at: string;
  unread: number;
  online?: boolean;
};

function fmt(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export default function MessagesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [items, setItems] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api.listConversations());
    } catch (e: any) {
      console.warn(e);
      setError(e?.message || "Unable to load your conversations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={isDark ? [colors.surface2, colors.surface2] : [colors.indigo, "#3949AB"]} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md }}>
          <View style={styles.headerIcon}><Ionicons name="chatbubbles" size={21} color={isDark ? colors.saffron : "#fff"} /></View>
          <View>
            <Text style={styles.title}>Chats</Text>
            <Text style={styles.sub}>Your ride conversations</Text>
          </View>
        </View>
        {!loading && !error && items.length > 0 ? <View style={styles.headerCount}><Text style={styles.headerCountText}>{items.length}</Text></View> : null}
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.indigo} /></View>
      ) : error ? (
        <View style={styles.state}>
          <View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={28} color={colors.error} /></View>
          <Text style={styles.emptyTitle}>Couldn't load chats</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading chats" onPress={() => { setLoading(true); load(); }} style={styles.retry}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.other_user_id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.indigo} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.indigo} /></View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Once you match with someone, your conversation will appear here.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Open matches" onPress={() => router.push("/matches")} style={styles.emptyCta}>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.emptyCtaText}>Find a match</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`convo-${item.other_user_id}`}
              onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: item.other_user_id, name: item.name } })}
              style={styles.row}
            >
              <View style={{ position: "relative" }}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || "U"}</Text></View>
                {item.online && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.time}>{fmt(item.last_at)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.preview} numberOfLines={1}>{item.last_message}</Text>
                  {item.unread > 0 && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : "rgba(255,255,255,0.18)" },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? colors.surface3 : "rgba(255,255,255,0.14)" },
  headerCount: { position: "absolute", right: SPACING.lg, top: SPACING.lg, minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? colors.surface3 : "rgba(255,255,255,0.16)" },
  headerCountText: { color: isDark ? colors.onSurface : "#fff", fontWeight: "800", fontSize: 12 },
  title: { color: isDark ? colors.onSurface : "#fff", fontSize: FONT["2xl"], fontWeight: "800", fontFamily: FONT_DISPLAY },
  sub: { color: isDark ? colors.onSurface2 : "rgba(255,255,255,0.9)", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xl },
  stateIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, marginBottom: SPACING.md },
  retry: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: SPACING.lg, backgroundColor: colors.indigo, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#fff", fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 80, paddingHorizontal: SPACING.xl },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, marginBottom: SPACING.md },
  emptyCta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: SPACING.lg, backgroundColor: colors.indigo, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
  emptyCtaText: { color: "#fff", fontWeight: "800" },
  emptyTitle: { marginTop: SPACING.md, fontSize: FONT.xl, fontWeight: "700", color: colors.onSurface },
  emptySub: { marginTop: 4, color: colors.muted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.indigo, fontWeight: "800" },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.card },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontWeight: "700", color: colors.onSurface, fontSize: FONT.base },
  time: { color: colors.muted, fontSize: FONT.sm },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  preview: { color: colors.muted, flex: 1, marginRight: SPACING.sm },
  badge: { backgroundColor: colors.saffron, borderRadius: RADIUS.pill, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
