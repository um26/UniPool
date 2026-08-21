import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";

const MONO = Platform.select({ ios: "Courier", android: "monospace", default: "monospace" });

export default function CollegeIdCard({
  name, rollNumber, schoolName, branchName, batchYear, degreeLevelName,
}: {
  name: string;
  rollNumber: string;
  schoolName?: string | null;
  branchName?: string | null;
  batchYear?: number | null;
  degreeLevelName?: string | null;
}) {
  return (
    <View style={styles.outer} testID="college-id-card">
      {/* lanyard strap */}
      <View style={styles.strap} />
      <View style={styles.hole} />

      <View style={styles.tilt}>
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

const styles = StyleSheet.create({
  outer: { alignItems: "center", width: "100%", maxWidth: 340, alignSelf: "center", paddingTop: 22 },
  strap: {
    width: 64, height: 20, borderRadius: 10,
    backgroundColor: "rgba(26,35,126,0.5)",
    marginBottom: -10, zIndex: 0,
  },
  hole: {
    position: "absolute", top: 26, width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: "rgba(26,35,126,0.35)",
    zIndex: 2,
  },
  tilt: {
    width: "100%",
    transform: [{ rotate: "-1.5deg" }],
    shadowColor: "#1A237E",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
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
