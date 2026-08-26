import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

type Pool = {
  pool_id: string;
  from_location: string;
  to_location: string;
  travel_datetime: string;
  status?: string;
  confirmed_travelers?: { user_id: string; name: string }[];
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default function ExploreScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.myPools();
      setPools(data || []);
    } catch (e: any) {
      setError(e?.message || "Couldn't refresh your trips.");
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!loadedOnce.current) setLoading(true);
    load();
  }, [load]));

  const active = useMemo(
    () => pools
      .filter((pool) => (pool.status ?? "open") === "open" && new Date(pool.travel_datetime).getTime() >= Date.now() - 3600000)
      .sort((a, b) => +new Date(a.travel_datetime) - +new Date(b.travel_datetime)),
    [pools]
  );

  const shareReferral = async () => {
    const text = "Join me on UniPool — find and share rides with verified university students.";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "UniPool", text });
      } else {
        Alert.alert("Invite friends", text);
      }
    } catch {}
  };

  const go = (path: string) => {
    Haptics.selectionAsync();
    router.push(path as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>EXPLORE</Text>
            <Text style={styles.title}>Everything around your ride</Text>
            <Text style={styles.subtitle}>Your trips, useful tools and something to do while you wait.</Text>
          </View>
          <Pressable onPress={() => go("/post-request")} style={styles.postButton}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.postButtonText}>Post trip</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your upcoming trips</Text>
          {active.length > 0 ? <Text style={styles.count}>{active.length}</Text> : null}
        </View>

        {loading && !loadedOnce.current ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.indigo} />
            <Text style={styles.loadingText}>Loading your trips…</Text>
          </View>
        ) : error && active.length === 0 ? (
          <Pressable onPress={load} style={styles.stateCard}>
            <Ionicons name="refresh-outline" size={22} color={colors.indigo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Couldn't refresh trips</Text>
              <Text style={styles.cardSub}>Tap to try again. The rest of Explore still works.</Text>
            </View>
          </Pressable>
        ) : active.length === 0 ? (
          <View style={styles.emptyTrip}>
            <View style={styles.emptyIcon}><Ionicons name="navigate-outline" size={24} color={colors.indigo} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>No upcoming trip yet</Text>
              <Text style={styles.cardSub}>Post where you're going and UniPool will start matching automatically.</Text>
            </View>
            <Pressable onPress={() => go("/post-request")}><Ionicons name="arrow-forward-circle" size={28} color={colors.saffron} /></Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tripRail}>
            {active.slice(0, 5).map((pool) => (
              <Pressable key={pool.pool_id} onPress={() => go(`/pool/${pool.pool_id}`)} style={styles.tripCard}>
                <View style={styles.tripTop}>
                  <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>ACTIVE</Text></View>
                  {(pool.confirmed_travelers?.length || 0) > 0 ? (
                    <View style={styles.peoplePill}><Ionicons name="people" size={12} color={colors.success} /><Text style={styles.peopleText}>{pool.confirmed_travelers?.length}</Text></View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.routeStrong}>{pool.from_location}</Text>
                <View style={styles.routeConnector}><View style={styles.routeLine} /><Ionicons name="arrow-down" size={13} color={colors.muted} /></View>
                <Text numberOfLines={1} style={styles.routeStrong}>{pool.to_location}</Text>
                <View style={styles.whenRow}><Ionicons name="time-outline" size={14} color={colors.muted} /><Text style={styles.whenText}>{when(pool.travel_datetime)}</Text></View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Useful right now</Text></View>
        <View style={styles.toolGrid}>
          <Tool icon="search-outline" title="Find a ride" sub="Browse open routes" onPress={() => go("/(tabs)")} colors={colors} styles={styles} />
          <Tool icon="flame-outline" title="Route demand" sub="See busy corridors" onPress={() => go("/heatmap")} colors={colors} styles={styles} accent />
          <Tool icon="chatbubbles-outline" title="Trip chats" sub="Open conversations" onPress={() => go("/(tabs)/messages")} colors={colors} styles={styles} />
          <Tool icon="shield-checkmark-outline" title="Student ID" sub="Verify or update profile" onPress={() => go("/(tabs)/profile")} colors={colors} styles={styles} />
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Time-pass</Text>
            <Text style={styles.sectionSub}>The games are still here — now they're actually easy to find.</Text>
          </View>
          <Pressable onPress={() => go("/(tabs)/games")}><Text style={styles.seeAll}>See all</Text></Pressable>
        </View>

        <View style={styles.gameRow}>
          <GameShortcut icon="flash" title="Rickshaw Rush" label="ARCADE" onPress={() => go("/games/rickshaw-rush")} colors={colors} styles={styles} />
          <GameShortcut icon="bulb" title="Travel Trivia" label="QUIZ" onPress={() => go("/games/trivia")} colors={colors} styles={styles} />
          <GameShortcut icon="grid" title="Memory Match" label="QUICK" onPress={() => go("/games/memory-match")} colors={colors} styles={styles} />
        </View>

        <Pressable onPress={shareReferral} style={styles.inviteCard}>
          <View style={styles.inviteIcon}><Ionicons name="people-outline" size={22} color={colors.indigo} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Bring your usual travel group</Text>
            <Text style={styles.cardSub}>More classmates on UniPool means faster, better matches.</Text>
          </View>
          <Ionicons name="share-social-outline" size={20} color={colors.saffron} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tool({ icon, title, sub, onPress, colors, styles, accent = false }: any) {
  return (
    <Pressable onPress={onPress} style={styles.toolCard}>
      <View style={[styles.toolIcon, accent && { backgroundColor: colors.cream }]}>
        <Ionicons name={icon} size={20} color={accent ? colors.saffron : colors.indigo} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{sub}</Text>
    </Pressable>
  );
}

function GameShortcut({ icon, title, label, onPress, colors, styles }: any) {
  return (
    <Pressable onPress={onPress} style={styles.gameCard}>
      <View style={styles.gameIcon}><Ionicons name={icon} size={22} color={colors.saffron} /></View>
      <Text style={styles.gameLabel}>{label}</Text>
      <Text style={styles.gameTitle}>{title}</Text>
      <Ionicons name="arrow-forward" size={17} color={colors.indigo} style={{ marginTop: 10 }} />
    </Pressable>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: SPACING.lg, paddingBottom: 130 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 26 },
  eyebrow: { color: colors.saffron, fontWeight: "900", fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", fontFamily: FONT_DISPLAY, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  postButton: { minHeight: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: colors.indigo, flexDirection: "row", alignItems: "center", gap: 6 },
  postButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6, marginBottom: 11 },
  sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  sectionSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  count: { minWidth: 25, height: 25, borderRadius: 13, backgroundColor: colors.surface2, color: colors.muted, textAlign: "center", lineHeight: 25, fontWeight: "800", fontSize: 11 },
  loadingCard: { minHeight: 110, borderRadius: RADIUS.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: colors.muted, fontSize: 12 },
  stateCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 15 },
  emptyTrip: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 15 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  tripRail: { gap: 10, paddingBottom: 4 },
  tripCard: { width: 260, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 15 },
  tripTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.surface2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: .6 },
  peoplePill: { flexDirection: "row", alignItems: "center", gap: 4 },
  peopleText: { color: colors.success, fontSize: 11, fontWeight: "800" },
  routeStrong: { color: colors.onSurface, fontWeight: "800", fontSize: 13 },
  routeConnector: { flexDirection: "row", alignItems: "center", gap: 6, height: 25, paddingLeft: 4 },
  routeLine: { width: 1, height: 17, backgroundColor: colors.borderStrong },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  whenText: { color: colors.muted, fontSize: 11 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  toolCard: { flexGrow: 1, flexBasis: 190, minHeight: 125, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  toolIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginBottom: 11 },
  cardTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "850" as any },
  cardSub: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  seeAll: { color: colors.indigo, fontSize: 12, fontWeight: "900" },
  gameRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 24 },
  gameCard: { flexGrow: 1, flexBasis: 190, minHeight: 150, backgroundColor: isDark ? colors.surface2 : colors.cream, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 15 },
  gameIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  gameLabel: { color: colors.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  gameTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", marginTop: 3 },
  inviteCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 15, marginTop: 4 },
  inviteIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
});
