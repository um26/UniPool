import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";

import { COLORS, SPACING, RADIUS, FONT } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";

type Msg = {
  message_id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  created_at: string;
};

export default function ChatThread() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const thread = await api.getThread(userId);
      setMsgs(thread);
    } catch (e) {
      console.warn(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(() => load(true), 4000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [load])
  );

  const send = async () => {
    const t = text.trim();
    if (!t || !userId) return;
    setSending(true);
    setText("");
    try {
      const sent = await api.sendMessage(userId, t);
      setMsgs((prev) => [...prev, sent]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setText(t);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="chat-back" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.headerName}>{name || "Chat"}</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.indigo} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: SPACING.lg }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={COLORS.borderStrong} />
                <Text style={{ color: COLORS.muted, marginTop: SPACING.sm }}>Say hi and coordinate your ride!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.from_user_id === user?.user_id;
              return (
                <View style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            multiline
          />
          <Pressable testID="chat-send" onPress={send} disabled={sending || !text.trim()} style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerName: { fontSize: FONT.lg, fontWeight: "800", color: COLORS.onSurface },
  bubbleRow: { flexDirection: "row", marginBottom: SPACING.sm },
  bubble: { maxWidth: "78%", borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: COLORS.indigo, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FONT.base, color: COLORS.onSurface },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  input: { flex: 1, backgroundColor: "#fff", borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, fontSize: FONT.base, color: COLORS.onSurface },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.saffron, alignItems: "center", justifyContent: "center" },
});
