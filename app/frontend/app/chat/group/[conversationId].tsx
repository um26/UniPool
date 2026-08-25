import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SPACING, RADIUS, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";

type Msg = {
  message_id: string;
  from_user_id: string;
  text: string;
  created_at: string;
  read_by?: string[];
};

type Member = { user_id: string; name: string };

const QUICK_REPLIES = [
  "What time should we leave?",
  "Where should we meet?",
  "I'm ready — see you there!",
];

export default function GroupChatThread() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState("Trip chat");
  const [members, setMembers] = useState<Member[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!conversationId) return;
    if (!silent) setLoading(true);
    try {
      const result = await api.getGroupThread(conversationId);
      setName(result.name || "Trip chat");
      setMembers(result.members || []);
      setMsgs(result.messages || []);
    } catch (e) {
      console.warn(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId]);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(() => load(true), 3500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]));

  const send = async () => {
    const value = text.trim();
    if (!value || !conversationId || sending) return;
    setSending(true);
    setText("");
    try {
      const sent = await api.sendGroupMessage(conversationId, value);
      setMsgs((prev) => [...prev, sent]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e) {
      setText(value);
      console.warn(e);
    } finally {
      setSending(false);
    }
  };

  const initials = (label: string) => label.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerName, { color: colors.onSurface }]} numberOfLines={1}>{name}</Text>
            <View style={styles.memberRow}>
              <Ionicons name="people-outline" size={13} color={colors.muted} />
              <Text style={[styles.memberText, { color: colors.muted }]}>{members.length} traveller{members.length === 1 ? "" : "s"}</Text>
            </View>
          </View>
          <View style={[styles.groupIcon, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="car-sport" size={18} color={colors.saffron} />
          </View>
        </View>

        <View style={[styles.memberStrip, { backgroundColor: colors.surface2, borderBottomColor: colors.border }]}>
          {members.slice(0, 5).map((member) => (
            <View key={member.user_id} style={styles.memberChip}>
              <View style={[styles.miniAvatar, { backgroundColor: colors.cream }]}><Text style={[styles.miniAvatarText, { color: colors.onCream }]}>{initials(member.name)}</Text></View>
              <Text style={[styles.memberName, { color: colors.onSurface2 }]} numberOfLines={1}>{member.user_id === user?.user_id ? "You" : member.name.split(" ")[0]}</Text>
            </View>
          ))}
          {members.length > 5 ? <Text style={[styles.moreMembers, { color: colors.muted }]}>+{members.length - 5}</Text> : null}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.indigo} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.md, flexGrow: msgs.length === 0 ? 1 : 0 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surface2 }]}><Ionicons name="people-outline" size={30} color={colors.indigo} /></View>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Your trip chat is ready</Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>Coordinate pickup points, timing and the ride with everyone here.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.from_user_id === user?.user_id;
              const sender = members.find((m) => m.user_id === item.from_user_id)?.name || "Traveller";
              return (
                <View style={[styles.row, mine && { justifyContent: "flex-end" }]}>
                  <View style={[styles.wrap, mine && { alignItems: "flex-end" }]}>
                    {!mine && <Text style={[styles.sender, { color: colors.muted }]}>{sender}</Text>}
                    <View style={[styles.bubble, { backgroundColor: mine ? colors.indigo : colors.card, borderColor: colors.border }, mine ? styles.mine : styles.theirs]}>
                      <Text style={[styles.bubbleText, { color: mine ? "#fff" : colors.onSurface }]}>{item.text}</Text>
                    </View>
                    {mine ? <Text style={[styles.receipt, { color: colors.muted }]}>{item.read_by && item.read_by.length > 1 ? "Seen" : "Sent"}</Text> : null}
                  </View>
                </View>
              );
            }}
          />
        )}

        {text.trim().length === 0 && (
          <FlatList
            horizontal
            data={QUICK_REPLIES}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplies}
            renderItem={({ item }) => (
              <Pressable onPress={() => setText(item)} style={[styles.quickReply, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Text style={[styles.quickReplyText, { color: colors.onSurface2 }]}>{item}</Text>
              </Pressable>
            )}
          />
        )}

        <View style={[styles.inputRow, { backgroundColor: colors.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            placeholder="Message the trip..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.onSurface }]}
            multiline
            maxLength={500}
          />
          <Pressable onPress={send} disabled={sending || !text.trim()} style={[styles.sendBtn, { backgroundColor: colors.saffron }, (!text.trim() || sending) && { opacity: 0.45 }]} accessibilityLabel="Send message">
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: SPACING.md },
  headerName: { fontSize: FONT.lg, fontWeight: "800", maxWidth: 280 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  memberText: { fontSize: 11, fontWeight: "600" },
  groupIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  memberStrip: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  memberChip: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 95 },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { fontSize: 8, fontWeight: "800" },
  memberName: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  moreMembers: { fontSize: 11, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xxl },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT.lg, fontWeight: "800" },
  emptyText: { marginTop: 6, textAlign: "center", lineHeight: 20 },
  row: { flexDirection: "row", width: "100%", marginBottom: SPACING.sm },
  wrap: { maxWidth: "82%", minWidth: 52 },
  sender: { fontSize: 10, fontWeight: "700", marginBottom: 3, marginLeft: 5 },
  bubble: { borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  mine: { borderBottomRightRadius: 4 },
  theirs: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FONT.base, lineHeight: 20 },
  receipt: { fontSize: 9, marginTop: 2, marginRight: 4 },
  quickReplies: { gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  quickReply: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 13, paddingVertical: 9 },
  quickReplyText: { fontSize: 12, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  input: { flex: 1, borderRadius: RADIUS.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, fontSize: FONT.base },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
