import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
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
  const [items, setItems] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.listConversations()); } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.indigo, "#3949AB"]} style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md }}>
          <Ionicons name="chatbubbles" size={26} color="#fff" />
          <View>
            <Text style={styles.title}>Chats</Text>
            <Text style={styles.sub}>Message your matched travellers directly</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.other_user_id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Message someone from your Matches tab to start chatting.</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  title: { color: "#fff", fontSize: FONT["2xl"], fontWeight: "800", fontFamily: FONT_DISPLAY },
  sub: { color: "rgba(255,255,255,0.9)", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { marginTop: SPACING.md, fontSize: FONT.xl, fontWeight: "700", color: COLORS.onSurface },
  emptySub: { marginTop: 4, color: COLORS.muted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.indigo, fontWeight: "800" },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success, borderWidth: 2, borderColor: "#fff" },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontWeight: "700", color: COLORS.onSurface, fontSize: FONT.base },
  time: { color: COLORS.muted, fontSize: FONT.sm },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  preview: { color: COLORS.muted, flex: 1, marginRight: SPACING.sm },
  badge: { backgroundColor: COLORS.saffron, borderRadius: RADIUS.pill, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
