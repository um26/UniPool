import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { utilityApi } from "@/src/api/utility";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { FONT_DISPLAY, RADIUS, SPACING } from "@/src/theme";

type Person = { user_id: string; name?: string; email?: string; username?: string; picture?: string | null; school_name?: string; branch_name?: string; batch_year?: number; college_verified?: boolean };

function normalize(value: any): Person[] {
  const rows = Array.isArray(value) ? value : Array.isArray(value?.people) ? value.people : [];
  return rows.filter((p: any) => p?.user_id).map((p: any) => ({ ...p, name: p.name || p.username || "Student" }));
}

export default function PeopleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (raw = query) => {
    const q = raw.trim();
    if (q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true); setError(null); setSearched(true);
    const [directory, legacy] = await Promise.allSettled([utilityApi.searchDirectory(q), api.globalSearch(q)]);
    const merged = new Map<string, Person>();
    if (legacy.status === "fulfilled") for (const person of normalize(legacy.value)) merged.set(person.user_id, person);
    if (directory.status === "fulfilled") for (const person of normalize(directory.value)) merged.set(person.user_id, { ...(merged.get(person.user_id) || {}), ...person });
    merged.delete(user?.user_id || "");
    const rows = [...merged.values()].sort((a, b) => Number(Boolean(b.college_verified)) - Number(Boolean(a.college_verified)) || String(a.name).localeCompare(String(b.name)));
    setResults(rows);
    if (!rows.length && directory.status === "rejected" && legacy.status === "rejected") setError("Student search is temporarily unavailable.");
    setLoading(false);
  };

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>STUDENT NETWORK</Text><Text style={styles.title}>Find people on UniPool</Text><Text style={styles.sub}>Search by name, email, username, branch or batch when that information is available.</Text></View></View>

    <View style={styles.searchBox}><Ionicons name="search" size={20} color={colors.indigo} /><TextInput value={query} onChangeText={(v) => { setQuery(v); if (v.trim().length < 2) { setResults([]); setSearched(false); } }} onSubmitEditing={() => search()} returnKeyType="search" autoCapitalize="none" placeholder="Name, email, branch, batch…" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={query.trim().length < 2 || loading} onPress={() => search()} style={[styles.searchBtn, (query.trim().length < 2 || loading) && { opacity: .5 }]}>{loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchBtnText}>Search</Text>}</Pressable></View>

    <View style={styles.tip}><Ionicons name="shield-checkmark-outline" size={18} color={colors.saffron} /><Text style={styles.tipText}>Use mutual trip, Circle and verified-college context before coordinating with someone new. UniPool does not expose private contact details beyond what the person uses for account discovery.</Text></View>

    {error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={26} color={colors.error} /><Text style={styles.stateTitle}>Search unavailable</Text><Text style={styles.stateSub}>{error}</Text><Pressable onPress={() => search()}><Text style={styles.retry}>Try again</Text></Pressable></View> : searched && !loading && !results.length ? <View style={styles.state}><Ionicons name="person-add-outline" size={28} color={colors.indigo} /><Text style={styles.stateTitle}>No UniPool account found</Text><Text style={styles.stateSub}>If this is someone you want in a Circle, open that Circle and invite them by email.</Text></View> : null}

    <View style={styles.grid}>{results.map((person) => <View key={person.user_id} style={styles.card}>
      <View style={styles.personTop}><View style={styles.avatar}><Text style={styles.avatarText}>{String(person.name || "S").slice(0,1).toUpperCase()}</Text></View><View style={{ flex: 1, minWidth: 0 }}><View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{person.name}</Text>{person.college_verified ? <Ionicons name="shield-checkmark" size={16} color={colors.indigo} /> : null}</View><Text numberOfLines={1} style={styles.meta}>{person.username ? `@${person.username}` : person.email || "UniPool student"}</Text></View></View>
      {(person.school_name || person.branch_name || person.batch_year) ? <View style={styles.context}>{person.school_name ? <Tag text={person.school_name} styles={styles} /> : null}{person.branch_name ? <Tag text={person.branch_name} styles={styles} /> : null}{person.batch_year ? <Tag text={`Batch ${person.batch_year}`} styles={styles} /> : null}</View> : null}
      <View style={styles.actions}><Pressable onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: person.user_id, name: person.name || "Student" } } as any)} style={styles.primary}><Ionicons name="chatbubble-outline" size={16} color="#fff" /><Text style={styles.primaryText}>Message</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/network", params: { userId: person.user_id } } as any)} style={styles.secondary}><Ionicons name="git-network-outline" size={16} color={colors.indigo} /><Text style={styles.secondaryText}>Context</Text></Pressable></View>
    </View>)}</View>
  </ScrollView></SafeAreaView>;
}

function Tag({ text, styles }: { text: string; styles: any }) { return <View style={styles.tag}><Text numberOfLines={1} style={styles.tagText}>{text}</Text></View>; }

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, page: { width: "100%", maxWidth: 980, alignSelf: "center", padding: SPACING.lg, paddingBottom: 130 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 }, back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.onSurface, fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: "900", marginTop: 3 }, sub: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 58, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, paddingHorizontal: 14 }, input: { flex: 1, minWidth: 0, color: colors.onSurface, fontSize: 14, outlineStyle: "none" } as any,
  searchBtn: { minHeight: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center" }, searchBtnText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 13, marginTop: 12, borderRadius: RADIUS.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }, tipText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 }, card: { flexGrow: 1, flexBasis: 300, maxWidth: 470, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 15 }, personTop: { flexDirection: "row", alignItems: "center", gap: 11 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.indigo, fontSize: 17, fontWeight: "900" }, nameRow: { flexDirection: "row", alignItems: "center", gap: 5 }, name: { color: colors.onSurface, fontSize: 14, fontWeight: "900", flexShrink: 1 }, meta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  context: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }, tag: { maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.surface2 }, tagText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 }, primary: { flex: 1, minHeight: 39, borderRadius: 20, backgroundColor: colors.indigo, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontWeight: "900", fontSize: 10 }, secondary: { flex: 1, minHeight: 39, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, secondaryText: { color: colors.indigo, fontWeight: "900", fontSize: 10 },
  state: { alignItems: "center", paddingVertical: 55, paddingHorizontal: 20 }, stateTitle: { color: colors.onSurface, fontWeight: "900", fontSize: 16, marginTop: 9 }, stateSub: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 4 }, retry: { color: colors.indigo, fontWeight: "900", marginTop: 10, fontSize: 11 },
});