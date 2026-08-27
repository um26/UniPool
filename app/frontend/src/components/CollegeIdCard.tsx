import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform, Pressable, Modal, ScrollView, TextInput, ActivityIndicator, Alert, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RADIUS, FONT, FONT_DISPLAY, SPACING } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { api } from "@/src/api/client";

const MONO = Platform.select({ ios: "Courier", android: "monospace", default: "monospace" });
const isWeb = Platform.OS === "web";

const SCHOOL_CODES: Record<string, string> = {
  se: "School of Engineering",
  sm: "School of Management",
  sl: "School of Law",
};

const DEGREE_LEVEL_NAMES: Record<string, string> = {
  u: "Undergraduate",
  m: "Masters",
  p: "PhD",
};

const BRANCH_CODES: Record<string, string> = {
  aee: "Aerospace Engineering",
  ari: "Artificial Intelligence",
  mbt: "5-Year Integrated M.Tech - Biotechnology",
  mcs: "5-Year Integrated M.Tech - Computer Science and Engineering",
  bit: "Biotechnology",
  cab: "Computational Biology",
  cie: "Civil Engineering",
  cam: "Computational Mathematics",
  cse: "Computer Science and Engineering",
  dsc: "Data Science",
  ece: "Electronics and Communication Engineering",
  ecm: "Electronics and Computer Engineering",
  mee: "Mechanical Engineering",
  mec: "Mechatronics",
  nan: "Nano-Technology",
  vls: "VLSI Design and Technology",
  inm: "Infrastructure Management",
  bef: "Applied Economics and Finance",
  efb: "Entrepreneurship and Family Business",
  bba: "Computational Business Analytics",
  bbd: "Digital Technologies",
};

type AcademicIdentity = {
  schoolName: string;
  batchYear: number;
  degreeLevelName: string;
  branchName: string;
};

function decodeAcademicIdentity(value?: string | null): AcademicIdentity | null {
  const roll = (value || "").trim().toLowerCase();
  if (!roll) return null;

  const lawIntegrated = roll.match(/^sl(\d{2})u(lbb|lba)$/);
  if (lawIntegrated) {
    return {
      schoolName: SCHOOL_CODES.sl,
      batchYear: 2000 + Number(lawIntegrated[1]),
      degreeLevelName: "Undergraduate",
      branchName: lawIntegrated[2] === "lbb" ? "BBA LLB" : "BA LLB",
    };
  }

  const lawMasters = roll.match(/^sl(\d{2})mllb$/);
  if (lawMasters) {
    return {
      schoolName: SCHOOL_CODES.sl,
      batchYear: 2000 + Number(lawMasters[1]),
      degreeLevelName: "Masters",
      branchName: "Masters in Law",
    };
  }

  const lawThreeYear = roll.match(/^sl(\d{2})(?:llba|ullb\d{3})$/);
  if (lawThreeYear) {
    return {
      schoolName: SCHOOL_CODES.sl,
      batchYear: 2000 + Number(lawThreeYear[1]),
      degreeLevelName: "Undergraduate",
      branchName: "LLB (3-year)",
    };
  }

  const lawPhd = roll.match(/^sl(\d{2})plaw\d{3}$/);
  if (lawPhd) {
    return {
      schoolName: SCHOOL_CODES.sl,
      batchYear: 2000 + Number(lawPhd[1]),
      degreeLevelName: "PhD",
      branchName: "Law",
    };
  }

  const match = roll.match(/^([a-z]{2})(\d{2})([ump])([a-z]+)(\d{3})$/);
  if (!match) return null;
  const [, schoolCode, yy, degreeCode, branchCode] = match;
  const schoolName = SCHOOL_CODES[schoolCode];
  const degreeLevelName = DEGREE_LEVEL_NAMES[degreeCode];
  const branchName = BRANCH_CODES[branchCode];
  if (!schoolName || !degreeLevelName || !branchName) return null;

  return {
    schoolName,
    batchYear: 2000 + Number(yy),
    degreeLevelName,
    branchName,
  };
}

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
  const { width } = useWindowDimensions();
  const desktopLarge = isWeb && width >= 1050;
  const { colors, isDark } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors, isDark, desktopLarge), [colors, isDark, desktopLarge]);

  const onMouseMove = (e: any) => {
    if (!isWeb) return;
    const rect = e.currentTarget.getBoundingClientRect?.();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (py - 0.5) * -10, y: (px - 0.5) * 10 });
  };
  const onMouseLeave = () => setTilt({ x: 0, y: 0 });
  const webHandlers = isWeb ? { onMouseMove, onMouseLeave } as any : {};

  return (
    <>
      <View style={[styles.outer, desktopLarge && styles.outerDesktop]} testID="college-id-card">
        <View style={[styles.strap, desktopLarge && styles.strapDesktop]} />
        <View style={[styles.hole, desktopLarge && styles.holeDesktop, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} />

        <Pressable
          onPress={() => { setExpanded(true); Haptics.selectionAsync(); }}
          testID="college-id-card-press"
          {...webHandlers}
          style={{ width: "100%" }}
        >
          <View
            ref={cardRef}
            style={[
              styles.tiltWrap,
              isWeb ? ({ transform: `perspective(850px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` } as any) : { transform: [{ rotate: "-1.5deg" }] },
            ]}
          >
            <IdCardFace {...props} compact large={desktopLarge} />
          </View>
        </Pressable>
      </View>

      <Modal visible={expanded} animationType="fade" transparent onRequestClose={() => setExpanded(false)}>
        <View style={modalStyles.backdrop}>
          <ScrollView contentContainerStyle={modalStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <Pressable testID="id-modal-close" onPress={() => setExpanded(false)} style={modalStyles.closeBtn} hitSlop={12}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </Pressable>

            <View style={modalStyles.bigCardWrap}>
              <IdCardFace {...props} large={desktopLarge} />
            </View>

            <ProfileDetails {...props} modalStyles={modalStyles} colors={colors} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function IdCardFace({ name, rollNumber, schoolName, branchName, batchYear, degreeLevelName, collegeEmail, compact, large }: Props & { compact?: boolean; large?: boolean }) {
  const verifiedRoll = collegeEmail?.includes("@") ? collegeEmail.split("@", 1)[0] : rollNumber;
  const decoded = decodeAcademicIdentity(verifiedRoll) || decodeAcademicIdentity(rollNumber);
  const displaySchool = decoded?.schoolName || schoolName;
  const displayBranch = decoded?.branchName || branchName;
  const displayBatch = decoded?.batchYear || batchYear;
  const displayLevel = decoded?.degreeLevelName || degreeLevelName;

  return (
    <View style={[styles.shadowLayer, compact && styles.shadowLayerCompact]}>
      <LinearGradient colors={["#283593", "#3949AB", "#F57F17"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, large && styles.cardLarge]}>
        <View style={[styles.sheen, large && styles.sheenLarge]} />

        <View style={styles.topRow}>
          <View>
            <Text style={[styles.uniName, large && styles.uniNameLarge]}>MAHINDRA UNIVERSITY</Text>
            <Text style={[styles.cardType, large && styles.cardTypeLarge]}>STUDENT ID</Text>
          </View>
          <View style={[styles.seal, large && styles.sealLarge]}>
            <Ionicons name="shield-checkmark" size={large ? 14 : 12} color="#1A237E" />
            <Text style={[styles.sealText, large && styles.sealTextLarge]}>VERIFIED</Text>
          </View>
        </View>

        <View style={[styles.chip, large && styles.chipLarge]}>
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
          <View style={styles.chipLine} />
        </View>

        <View style={styles.bodyRow}>
          <View style={[styles.avatar, large && styles.avatarLarge]}>
            <Text style={[styles.avatarText, large && styles.avatarTextLarge]}>{name?.[0]?.toUpperCase() || "U"}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: large ? 15 : 12 }}>
            <Text style={[styles.name, large && styles.nameLarge]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.roll, large && styles.rollLarge]}>{rollNumber}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={[styles.detailsRow, large && styles.detailsRowLarge]}>
          <Detail label="School" value={displaySchool} large={large} />
          <Detail label="Batch" value={displayBatch ? String(displayBatch) : undefined} large={large} />
        </View>
        <View style={[styles.detailsRow, large && styles.detailsRowLarge]}>
          <Detail label="Branch" value={displayBranch} large={large} />
          <Detail label="Level" value={displayLevel} large={large} />
        </View>
      </LinearGradient>
    </View>
  );
}

function Detail({ label, value, large }: { label: string; value?: string | null; large?: boolean }) {
  if (!value) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.detailLabel, large && styles.detailLabelLarge]}>{label.toUpperCase()}</Text>
      <Text style={[styles.detailValue, large && styles.detailValueLarge]} numberOfLines={large ? 2 : 1}>{value}</Text>
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
  outerDesktop: { maxWidth: 480, paddingTop: 28 },
  strap: {
    width: 64, height: 20, borderRadius: 10,
    backgroundColor: "rgba(26,35,126,0.5)",
    marginBottom: -10, zIndex: 0,
  },
  strapDesktop: { width: 80, height: 24, borderRadius: 12, marginBottom: -12 },
  hole: {
    position: "absolute", top: 26, width: 14, height: 14, borderRadius: 7,
    borderWidth: 2,
    zIndex: 2,
  },
  holeDesktop: { top: 33, width: 16, height: 16, borderRadius: 8 },
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
  cardLarge: { padding: 24, aspectRatio: 1.58, borderRadius: RADIUS.lg + 10 },
  sheen: {
    position: "absolute", top: -40, left: -40, width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.12)", transform: [{ rotate: "35deg" }],
  },
  sheenLarge: { top: -55, left: -50, width: 190, height: 190, borderRadius: 95 },
  chip: {
    width: 24, height: 17, borderRadius: 4,
    backgroundColor: "rgba(255,236,194,0.9)",
    justifyContent: "center", paddingHorizontal: 4, gap: 2,
    marginTop: 8,
  },
  chipLarge: { width: 31, height: 22, borderRadius: 5, paddingHorizontal: 5, marginTop: 10 },
  chipLine: { height: 1.2, backgroundColor: "rgba(26,35,126,0.45)", borderRadius: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  uniName: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  uniNameLarge: { fontSize: 13, letterSpacing: 1.2 },
  cardType: { color: "rgba(255,255,255,0.75)", fontSize: 8, fontWeight: "700", letterSpacing: 1.4, marginTop: 2 },
  cardTypeLarge: { fontSize: 10, letterSpacing: 1.6, marginTop: 3 },
  seal: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff", borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  sealLarge: { gap: 4, paddingHorizontal: 10, paddingVertical: 5 },
  sealText: { color: "#1A237E", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  sealTextLarge: { fontSize: 10 },
  bodyRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
  avatarLarge: { width: 56, height: 56, borderRadius: 28, borderWidth: 2 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  avatarTextLarge: { fontSize: 22 },
  name: { color: "#fff", fontSize: FONT.base, fontWeight: "800", fontFamily: FONT_DISPLAY },
  nameLarge: { fontSize: 20 },
  roll: { color: "#FFECC2", fontSize: 13, fontWeight: "700", letterSpacing: 1.5, marginTop: 2, fontFamily: MONO },
  rollLarge: { fontSize: 16, letterSpacing: 1.9, marginTop: 3 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  detailsRow: { flexDirection: "row" },
  detailsRowLarge: { gap: 18 },
  detailLabel: { color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: "700", letterSpacing: 0.6 },
  detailLabelLarge: { fontSize: 9.5, letterSpacing: 0.8 },
  detailValue: { color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 1 },
  detailValueLarge: { fontSize: 13.5, lineHeight: 16, marginTop: 2 },
});

const makeModalStyles = (colors: any, isDark: boolean, desktopLarge: boolean) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: isDark ? "rgba(5,7,12,0.94)" : "rgba(15,15,20,0.85)" },
  scrollContent: { padding: SPACING.xl, paddingTop: 60, alignItems: "center" },
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 10 },
  bigCardWrap: { width: "100%", maxWidth: desktopLarge ? 520 : 380, marginBottom: SPACING.xl },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: desktopLarge ? RADIUS.lg + 4 : RADIUS.lg,
    padding: desktopLarge ? SPACING.xl : SPACING.lg,
    width: "100%",
    maxWidth: desktopLarge ? 520 : 380,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isWeb ? { boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.36)" : "0 18px 48px rgba(0,0,0,0.16)" } as any : {}),
  },
  sectionTitle: { fontSize: desktopLarge ? FONT.xl : FONT.lg, fontWeight: "800", color: colors.onSurface, marginBottom: SPACING.md, fontFamily: FONT_DISPLAY },
  statRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: desktopLarge ? 12 : 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  statRowEditable: { flexDirection: "row", alignItems: "flex-start", paddingVertical: desktopLarge ? 12 : 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  statLabel: { fontSize: desktopLarge ? 12 : 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: desktopLarge ? FONT.lg : FONT.base, fontWeight: "600", color: colors.onSurface, marginTop: 2 },
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
    paddingVertical: desktopLarge ? SPACING.lg : SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBig: { fontSize: desktopLarge ? 26 : FONT.xl, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  statSmall: { fontSize: desktopLarge ? 12 : 11, color: colors.muted, marginTop: 2 },
});
