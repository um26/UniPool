import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";

type Pool = { pool_id: string; from_location: string; to_location: string; travel_datetime: string; companions: number };

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [myPools, setMyPools] = useState<Pool[]>([]);
  const [gender, setGender] = useState<string>(user?.gender || "any");

  const load = useCallback(async () => {
    try { setMyPools(await api.myPools()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveGender = async (g: string) => {
    setGender(g);
    try { await api.updateProfile({ gender: g }); Haptics.selectionAsync(); } catch {}
  };

  const remove = async (id: string) => {
    try { await api.deletePool(id); await load(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={[COLORS.indigo, "#3949AB"]} style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "U"}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </LinearGradient>

      <FlatList
        data={myPools}
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
            <Text style={styles.sectionLabel}>My Requests</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.mine}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mineRoute}>{item.from_location} → {item.to_location}</Text>
              <Text style={styles.mineWhen}>{new Date(item.travel_datetime).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
            </View>
            <Pressable testID={`delete-${item.pool_id}`} onPress={() => remove(item.pool_id)} hitSlop={8}>
              <Ionicons name="trash" size={20} color={COLORS.error} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyMine}>You haven't posted any pools yet.</Text>}
        ListFooterComponent={
          <Pressable testID="logout-button" onPress={signOut} style={styles.logout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { alignItems: "center", paddingVertical: SPACING.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  avatarText: { color: COLORS.indigo, fontSize: 28, fontWeight: "800" },
  name: { color: "#fff", fontSize: FONT.xl, fontWeight: "800" },
  email: { color: "rgba(255,236,194,0.9)", marginTop: 4 },
  sectionLabel: { fontSize: FONT.sm, fontWeight: "700", color: COLORS.muted, marginTop: SPACING.lg, marginBottom: SPACING.sm, letterSpacing: 0.8, textTransform: "uppercase" },
  prefRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  prefChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border },
  prefChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
  prefText: { color: COLORS.onSurface, fontWeight: "600", fontSize: 13 },
  mine: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  mineRoute: { fontSize: FONT.base, fontWeight: "700", color: COLORS.onSurface },
  mineWhen: { color: COLORS.muted, marginTop: 2, fontSize: FONT.sm },
  emptyMine: { color: COLORS.muted, padding: SPACING.md, textAlign: "center" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING.xl, paddingVertical: 14, borderRadius: RADIUS.pill, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.error },
  logoutText: { color: COLORS.error, fontWeight: "700" },
});
