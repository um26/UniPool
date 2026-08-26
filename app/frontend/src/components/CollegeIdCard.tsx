import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Modal, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS, RADIUS, FONT, FONT_DISPLAY, SPACING } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

const MONO = Platform.select({ ios: "Courier", android: "monospace", default: "monospace" });
const isWeb = Platform.OS === "web";

type Props = {
  name: string;
  rollNumber: string;
  schoolName?: string | null;
  branchName?: string | null;
  batchYear?: number | null;
  degreeLevelName?: string | null;
  email?: string;
  collegeEmail?: string | null;
  phone?: string | null;
  bloodGroup?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  ridesCompleted?: number;
  onProfileUpdated?: () => void;
};

type ModalStyleSet = ReturnType<typeof makeModalStyles>;

export default function CollegeIdCard(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<View>(null);
  const { colors, isDark } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors, isDark), [colors, isDark]);

  // Web-only cursor-follow 3D tilt — computes rotation from pointer position
  // relative to the card's bounding box.
  const onMouseMove = (e: any) => {
    if (!isWeb) return;
    const rect = e.currentTarget.getBoundingClientRect?.();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (py - 0.5) * -14, y: (px - 0.5) * 14 });
  };
  const onMouseLeave = () => setTilt({ x: 0, y: 0 });

  const webHandlers = isWeb ? { onMouseMove, onMouseLeave } as any : {};

  return (
    <>
      <View style={styles.outer} testID="college-id-card">
        <View style={styles.strap} />
        <View style={[styles.hole, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} />

        <Pressable
          onPress={() => { setExpanded(true); Haptics.selectionAsync(); }}
          testID="college-id-card-press"
          {...webHandlers}
        >
          <View
            ref={cardRef}
            style={[
              styles.tiltWrap,
              isWeb ? ({ transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` } as any) : { transform: [{ rotate: "-1.5deg" }] },
            ]}
          >
            <IdCardFace {...props} compact />
          </View>
        </Pressable>
      </View>

      <Modal visible={expanded} animationType="fade" transparent onRequestClose={() => setExpanded(false)}>
        <View style={modalStyles.backdrop}>
          <ScrollView contentContainerStyle={modalStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <Pressable testID="id-modal-close" onPress={() => setExpanded(false)} style={modalStyles.closeBtn} hitSlop={12}>
              <Ionicons name="close-circle" size={30} color="#fff" />
            </Pressable>

            <View style={modalStyles.bigCardWrap}>
              <IdCardFace {...props} />
            </View>

            <ProfileDetails {...props} modalStyles={modalStyles} colors={colors} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function IdCardFace({ name, rollNumber, schoolName, branchName, batchYear, degreeLevelName, compact }: Props & { compact?: boolean }) {
  return (
    <View style={[styles.shadowLayer, compact && styles.shadowLayerCompact]}>
      <LinearGradient colors={["#283593", "#3949AB", "#F57F17"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.sheen} />

        <View style={styles.topRow}>
          <View>
            <Text style={styles.uniName}>MAHINDRA UNIVERSITY</Text>
            <Text style={styles.cardType}>STUDENT ID</Text>
          </View>
          <View style={styles.seal}>
            <Ionicons name="shield-checkmark" size={12} color="#1A237E" />
            <Text style={styles.sealText}>VERIFIED</Text>
          </View>
        </View>

        <View style={styles.chip}>
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
        </View>

        <View style={styles.bodyRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || "U"}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.roll}>{rollNumber}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
          <Detail label="School" value={schoolName} />
          <Detail label="Batch" value={batchYear ? String(batchYear) : undefined} />
        </View>
        <View style={styles.detailsRow}>
          <Detail label="Branch" value={branchName} />
          <Detail label="Level" value={degreeLevelName} />
        </View>
      </LinearGradient>
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ProfileDetails(props: Props & { modalStyles: ModalStyleSet; colors: any }) {
  const { email, collegeEmail, phone, bloodGroup, ratingAvg, ratingCount, ridesCompleted, onProfileUpdated, modalStyles, colors } = props;
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingBlood, setEditingBlood] = useState(false);
  const [phoneVal, setPhoneVal] = useState(phone || "");
  const [bloodVal, setBloodVal] = useState(bloodGroup || "");
  const [saving, setSaving] = useState(false);

  const save = async (patch: Record<string, string>, closeFn: () => void) => {
    setSaving(true);
    try {
      await api.updateProfile(patch);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeFn();
      onProfileUpdated?.();
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={modalStyles.detailsCard}>
      <Text style={modalStyles.sectionTitle}>Profile</Text>

      <Stat icon="mail-outline" label="Login email" value={email} modalStyles={modalStyles} colors={colors} />
      <Stat icon="school-outline" label="College email" value={collegeEmail} modalStyles={modalStyles} colors={colors} />

      <View style={modalStyles.statRowEditable}>
        <Ionicons name="call-outline" size={16} color={colors.muted} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={modalStyles.statLabel}>Phone</Text>
          {editingPhone ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <TextInput
                testID="phone-input"
                value={phoneVal}
                onChangeText={setPhoneVal}
                placeholder="Add phone number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={modalStyles.inlineInput}
                autoFocus
              />
              <Pressable testID="save-phone" onPress={() => save({ phone: phoneVal }, () => setEditingPhone(false))} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.indigo} /> : <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
              </Pressable>
            </View>
          ) : (
            <Pressable testID="edit-phone" onPress={() => setEditingPhone(true)}>
              <Text style={modalStyles.statValue}>{phone || "Tap to add"}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={modalStyles.statRowEditable}>
        <Ionicons name="water-outline" size={16} color={colors.muted} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={modalStyles.statLabel}>Blood group</Text>
          {editingBlood ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <TextInput
                testID="blood-input"
                value={bloodVal}
                onChangeText={setBloodVal}
                placeholder="e.g. O+"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={modalStyles.inlineInput}
                autoFocus
              />
              <Pressable testID="save-blood" onPress={() => save({ blood_group: bloodVal }, () => setEditingBlood(false))} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.indigo} /> : <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
              </Pressable>
            </View>
          ) : (
            <Pressable testID="edit-blood" onPress={() => setEditingBlood(true)}>
              <Text style={modalStyles.statValue}>{bloodGroup || "Tap to add"}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={modalStyles.statsGrid}>
        <View style={modalStyles.statBox}>
          <Ionicons name="star" size={18} color={colors.saffron} />
          <Text style={modalStyles.statBig}>{ratingAvg != null ? ratingAvg.toFixed(1) : "—"}</Text>
          <Text style={modalStyles.statSmall}>{ratingCount || 0} rating{ratingCount === 1 ? "" : "s"}</Text>
        </View>
        <View style={modalStyles.statBox}>
          <Ionicons name="car-sport" size={18} color={colors.success} />
          <Text style={modalStyles.statBig}>{ridesCompleted ?? 0}</Text>
          <Text style={modalStyles.statSmall}>trips together</Text>
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, label, value, modalStyles, colors }: { icon: any; label: string; value?: string | null; modalStyles: ModalStyleSet; colors: any }) {
  return (
    <View style={modalStyles.statRow}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={modalStyles.statLabel}>{label}</Text>
        <Text style={modalStyles.statValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: "center", width: "100%", maxWidth: 340, alignSelf: "center", paddingTop: 22 },
  strap: {
    width: 64, height: 20, borderRadius: 10,
    backgroundColor: "rgba(26,35,126,0.5)",
    marginBottom: -10, zIndex: 0,
  },
  hole: {
    position: "absolute", top: 26, width: 14, height: 14, borderRadius: 7,
    borderWidth: 2,
    zIndex: 2,
  },
  tiltWrap: { width: "100%" },
  shadowLayer: {
    borderRadius: RADIUS.lg + 6,
    ...(isWeb
      ? { boxShadow: "0 18px 34px rgba(26,35,126,0.35)" } as any
      : { shadowColor: "#1A237E", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 10 }),
  },
  shadowLayerCompact: {},
  card: {
    borderRadius: RADIUS.lg + 6,
    padding: 18,
    aspectRatio: 1.55,
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
  },
  sheen: {
    position: "absolute", top: -40, left: -40, width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.12)", transform: [{ rotate: "35deg" }],
  },
  chip: {
    width: 24, height: 17, borderRadius: 4,
    backgroundColor: "rgba(255,236,194,0.9)",
    justifyContent: "center", paddingHorizontal: 4, gap: 2,
    marginTop: 8,
  },
  chipLine: { height: 1.2, backgroundColor: "rgba(26,35,126,0.45)", borderRadius: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  uniName: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  cardType: { color: "rgba(255,255,255,0.75)", fontSize: 8, fontWeight: "700", letterSpacing: 1.4, marginTop: 2 },
  seal: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff", borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  sealText: { color: "#1A237E", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  bodyRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  name: { color: "#fff", fontSize: FONT.base, fontWeight: "800", fontFamily: FONT_DISPLAY },
  roll: { color: "#FFECC2", fontSize: 13, fontWeight: "700", letterSpacing: 1.5, marginTop: 2, fontFamily: MONO },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  detailsRow: { flexDirection: "row" },
  detailLabel: { color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: "700", letterSpacing: 0.6 },
  detailValue: { color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 1 },
});

const makeModalStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: isDark ? "rgba(5,7,12,0.94)" : "rgba(15,15,20,0.85)" },
  scrollContent: { padding: SPACING.xl, paddingTop: 60, alignItems: "center" },
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 10 },
  bigCardWrap: { width: "100%", maxWidth: 380, marginBottom: SPACING.xl },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isWeb ? { boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.36)" : "0 18px 48px rgba(0,0,0,0.16)" } as any : {}),
  },
  sectionTitle: { fontSize: FONT.lg, fontWeight: "800", color: colors.onSurface, marginBottom: SPACING.md, fontFamily: FONT_DISPLAY },
  statRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  statRowEditable: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  statLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: FONT.base, fontWeight: "600", color: colors.onSurface, marginTop: 2 },
  inlineInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: FONT.base,
    color: colors.onSurface,
    backgroundColor: colors.surface2,
  },
  statsGrid: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg },
  statBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBig: { fontSize: FONT.xl, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  statSmall: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
