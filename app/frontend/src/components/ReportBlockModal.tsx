import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import { api } from "@/src/api/client";

const REASONS = [
  { id: "no-show", label: "No-show" },
  { id: "unsafe", label: "Unsafe behaviour" },
  { id: "harassment", label: "Harassment" },
  { id: "spam", label: "Spam / fake pool" },
  { id: "other", label: "Other" },
];

export default function ReportBlockModal({
  visible, onClose, userId, userName, poolId, onBlocked,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  poolId?: string;
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reported, setReported] = useState(false);

  const reset = () => { setReason(null); setDetails(""); setReported(false); };

  const submitReport = async () => {
    if (!reason) return Alert.alert("Pick a reason", "Please select why you're reporting this user.");
    setSubmittingReport(true);
    try {
      await api.submitReport(userId, reason, details.trim() || undefined, poolId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReported(true);
    } catch (e: any) {
      Alert.alert("Couldn't submit report", e.message || "Try again");
    } finally {
      setSubmittingReport(false);
    }
  };

  const block = () => {
    Alert.alert(
      `Block ${userName.split(" ")[0]}?`,
      "You won't see their pools anymore, and they won't be able to message or request to join yours. You can unblock them any time from your profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block", style: "destructive", onPress: async () => {
            setBlocking(true);
            try {
              await api.blockUser(userId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onBlocked?.();
              reset();
              onClose();
            } catch (e: any) {
              Alert.alert("Couldn't block", e.message || "Try again");
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable testID="report-close" onPress={() => { reset(); onClose(); }} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={COLORS.onSurface} />
          </Pressable>

          <Ionicons name="shield-outline" size={44} color={COLORS.error} />
          <Text style={styles.title}>Report {userName.split(" ")[0]}</Text>

          {reported ? (
            <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
              <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
              <Text style={styles.sub}>Thanks — our team will review this.</Text>
              <Pressable testID="report-done" onPress={() => { reset(); onClose(); }} style={[styles.submitBtn, { marginTop: SPACING.lg }]}>
                <Text style={styles.submitText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.sub}>Let us know what happened. Reports are confidential.</Text>

              <View style={styles.reasonsWrap}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.id}
                    testID={`reason-${r.id}`}
                    onPress={() => { setReason(r.id); Haptics.selectionAsync(); }}
                    style={[styles.reasonChip, reason === r.id && styles.reasonChipActive]}
                  >
                    <Text style={[styles.reasonText, reason === r.id && styles.reasonTextActive]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                testID="report-details"
                value={details}
                onChangeText={setDetails}
                placeholder="Optional details"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                multiline
              />

              <Pressable testID="report-submit" onPress={submitReport} disabled={submittingReport} style={[styles.submitBtn, submittingReport && { opacity: 0.6 }]}>
                {submittingReport ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit report</Text>}
              </Pressable>

              <View style={styles.divider} />

              <Pressable testID="block-user-btn" onPress={block} disabled={blocking} style={[styles.blockBtn, blocking && { opacity: 0.6 }]}>
                {blocking ? <ActivityIndicator color={COLORS.error} /> : (
                  <>
                    <Ionicons name="ban-outline" size={18} color={COLORS.error} />
                    <Text style={styles.blockText}>Block this user</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,20,25,0.6)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  card: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.xl, width: "100%", maxWidth: 400, alignItems: "center" },
  closeBtn: { position: "absolute", top: SPACING.md, right: SPACING.md },
  title: { fontSize: FONT.xl, fontWeight: "800", color: COLORS.onSurface, marginTop: SPACING.sm, fontFamily: FONT_DISPLAY },
  sub: { color: COLORS.muted, textAlign: "center", marginTop: 4, marginBottom: SPACING.lg },
  reasonsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: SPACING.md, justifyContent: "center" },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  reasonChipActive: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  reasonText: { fontSize: 13, fontWeight: "700", color: COLORS.onSurface },
  reasonTextActive: { color: "#fff" },
  input: { alignSelf: "stretch", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, minHeight: 60, textAlignVertical: "top", color: COLORS.onSurface, marginBottom: SPACING.lg },
  submitBtn: { alignSelf: "stretch", backgroundColor: COLORS.error, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: FONT.lg },
  divider: { alignSelf: "stretch", height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.lg },
  blockBtn: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: COLORS.error, borderRadius: RADIUS.pill, paddingVertical: 12 },
  blockText: { color: COLORS.error, fontWeight: "700" },
});
