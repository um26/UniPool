import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";

type Entry = { user_id: string; user_name: string; score: number };

const MEDAL_COLORS = ["#FFD54F", "#CFD8DC", "#D7A47A"];

export default function LeaderboardModal({
  visible,
  onClose,
  game,
  gameLabel,
  unit,
}: {
  visible: boolean;
  onClose: () => void;
  game: string;
  gameLabel: string;
  unit?: string;
}) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myBest, setMyBest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .getLeaderboard(game)
      .then((res) => {
        setEntries(res.entries || []);
        setMyBest(res.my_best ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, game]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
              <Ionicons name="trophy" size={22} color={COLORS.saffron} />
              <Text style={styles.title}>{gameLabel}</Text>
            </View>
            <Pressable testID="leaderboard-close" onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.onSurface} />
            </Pressable>
          </View>

          {myBest !== null && (
            <View style={styles.myBestPill}>
              <Text style={styles.myBestText}>Your best: {myBest}{unit ? ` ${unit}` : ""}</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.center}><ActivityIndicator color={COLORS.indigo} /></View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(e) => e.user_id}
              contentContainerStyle={{ paddingVertical: SPACING.sm }}
              ListEmptyComponent={
                <Text style={styles.empty}>No scores yet — be the first!</Text>
              }
              renderItem={({ item, index }) => (
                <View style={[styles.row, item.user_id === user?.user_id && styles.rowMe]}>
                  <View style={[styles.rankBadge, index < 3 && { backgroundColor: MEDAL_COLORS[index] }]}>
                    <Text style={[styles.rankText, index < 3 && { color: "#3D2E00" }]}>{index + 1}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.user_name}{item.user_id === user?.user_id ? " (you)" : ""}
                  </Text>
                  <Text style={styles.score}>{item.score}{unit ? ` ${unit}` : ""}</Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,20,25,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", paddingBottom: SPACING.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONT.xl, fontWeight: "800", color: COLORS.onSurface, fontFamily: FONT_DISPLAY },
  myBestPill: { alignSelf: "center", backgroundColor: COLORS.cream, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 6, marginTop: SPACING.md },
  myBestText: { color: COLORS.onCream, fontWeight: "700", fontSize: FONT.sm },
  center: { paddingVertical: 60, alignItems: "center" },
  empty: { textAlign: "center", color: COLORS.muted, paddingVertical: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: 10 },
  rowMe: { backgroundColor: "rgba(255,153,51,0.1)" },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center" },
  rankText: { fontWeight: "800", color: COLORS.muted, fontSize: FONT.sm },
  name: { flex: 1, color: COLORS.onSurface, fontWeight: "600", fontSize: FONT.base },
  score: { color: COLORS.indigo, fontWeight: "800", fontSize: FONT.base },
});
