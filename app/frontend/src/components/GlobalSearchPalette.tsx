import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { RADIUS, SPACING } from "@/src/theme";

export default function GlobalSearchPalette({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>({ locations: [], rides: [], people: [], chats: [] });

  useEffect(() => {
    if (!visible) { setQ(""); setResults({ locations: [], rides: [], people: [], chats: [] }); return; }
  }, [visible]);

  useEffect(() => {
    if (!visible || q.trim().length < 2) { setResults({ locations: [], rides: [], people: [], chats: [] }); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      try { setResults(await api.globalSearch(q.trim())); } catch { setResults({ locations: [], rides: [], people: [], chats: [] }); }
      finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(handle);
  }, [q, visible]);

  if (Platform.OS !== "web") return null;
  const go = (path: any) => { onClose(); router.push(path); };
  const hasResults = Object.values(results).some((items: any) => items?.length);

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.panel} onPress={(e) => e.stopPropagation?.()}>
        <View style={styles.searchRow}><Ionicons name="search" size={19} color={colors.muted} /><TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search rides, people, places or chats…" placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.key}><Text style={styles.keyText}>ESC</Text></View></View>
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
          {q.trim().length < 2 ? <Hint icon="command" text="Type two characters to search across UniPool." styles={styles} colors={colors} /> : loading ? <View style={styles.loading}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Searching UniPool…</Text></View> : !hasResults ? <Hint icon="search-outline" text="No results yet. Try a route, airport code, station or student name." styles={styles} colors={colors} /> : <>
            <Group title="Places" items={results.locations} render={(item: any) => <Result key={item.id || item.name} icon={item.kind === "airport" ? "airplane" : item.kind === "railway" ? "train" : item.kind === "university" ? "school" : "location"} title={item.name} sub={[item.short_name, item.city].filter(Boolean).join(" · ")} onPress={() => go({ pathname: "/post-request", params: { from: item.name } })} styles={styles} colors={colors} />} />
            <Group title="Rides" items={results.rides} render={(item: any) => <Result key={item.pool_id} icon="car-outline" title={`${item.from_location} → ${item.to_location}`} sub={`${item.user_name || "Traveller"} · ${new Date(item.travel_datetime).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`} onPress={() => go(`/pool/${item.pool_id}`)} styles={styles} colors={colors} />} />
            <Group title="People" items={results.people} render={(item: any) => <Result key={item.user_id} icon="person-outline" title={item.name} sub={[item.username ? `@${item.username}` : null, item.college_verified ? "Verified student" : null, item.branch_name].filter(Boolean).join(" · ")} onPress={() => go({ pathname: "/chat/[userId]", params: { userId: item.user_id, name: item.name } })} styles={styles} colors={colors} />} />
            <Group title="Chats" items={results.chats} render={(item: any) => <Result key={item.conversation_id} icon="chatbubbles-outline" title={item.name || "Trip chat"} sub="Open conversation" onPress={() => go(`/chat/group/${item.conversation_id}`)} styles={styles} colors={colors} />} />
          </>}
        </ScrollView>
        <View style={styles.footer}><Text style={styles.muted}>⌘K / Ctrl+K from anywhere</Text><Text style={styles.muted}>Enter a result to continue</Text></View>
      </Pressable>
    </Pressable>
  </Modal>;
}

function Group({ title, items, render }: any) { if (!items?.length) return null; return <View style={{ marginBottom: 12 }}><Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1, opacity: .65, marginHorizontal: 12, marginBottom: 5 }}>{title.toUpperCase()}</Text>{items.map(render)}</View>; }
function Result({ icon, title, sub, onPress, styles, colors }: any) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.surface2 }]}><View style={styles.resultIcon}><Ionicons name={icon} size={17} color={colors.indigo} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.resultTitle}>{title}</Text>{sub ? <Text numberOfLines={1} style={styles.resultSub}>{sub}</Text> : null}</View><Ionicons name="arrow-forward" size={15} color={colors.muted} /></Pressable>; }
function Hint({ icon, text, styles, colors }: any) { return <View style={styles.hint}><View style={styles.resultIcon}><Ionicons name={icon} size={19} color={colors.indigo} /></View><Text style={styles.muted}>{text}</Text></View>; }

const makeStyles = (colors: any) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.42)", alignItems: "center", paddingTop: 90, paddingHorizontal: SPACING.lg },
  panel: { width: "100%", maxWidth: 650, maxHeight: 620, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, overflow: "hidden", shadowColor: "#000", shadowOpacity: .24, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  searchRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: colors.border }, input: { flex: 1, color: colors.onSurface, fontSize: 15, outlineStyle: "none" } as any, key: { borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, paddingHorizontal: 6, paddingVertical: 3 }, keyText: { color: colors.muted, fontSize: 8, fontWeight: "900" },
  results: { minHeight: 140, maxHeight: 480, paddingVertical: 10 }, loading: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 8 }, hint: { minHeight: 150, padding: 24, alignItems: "center", justifyContent: "center", gap: 10 }, muted: { color: colors.muted, fontSize: 10 },
  result: { minHeight: 54, marginHorizontal: 7, borderRadius: RADIUS.md, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 10 }, resultIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }, resultTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "850" as any }, resultSub: { color: colors.muted, fontSize: 9, marginTop: 2 },
  footer: { minHeight: 37, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 13 },
});
