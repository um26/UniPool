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
    <View style={styles.wrap} testID="college-id-card">
      <LinearGradient colors={["#1A237E", "#283593", "#F57F17"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <View style={styles.chip}>
              <View style={styles.chipLine} />
              <View style={styles.chipLine} />
              <View style={styles.chipLine} />
            </View>
            <Text style={styles.uniName}>MAHINDRA UNIVERSITY</Text>
            <Text style={styles.cardType}>STUDENT ID</Text>
          </View>
          <View style={styles.seal}>
            <Ionicons name="shield-checkmark" size={14} color="#1A237E" />
            <Text style={styles.sealText}>VERIFIED</Text>
          </View>
        </View>

        <View style={styles.bodyRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || "U"}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.roll}>{rollNumber}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
          <Detail label="School" value={schoolName} />
          <Detail label="Branch" value={branchName} />
        </View>
        <View style={styles.detailsRow}>
          <Detail label="Batch" value={batchYear ? String(batchYear) : undefined} />
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

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 0 },
  card: {
    borderRadius: RADIUS.lg + 4,
    padding: 20,
    aspectRatio: 1.65,
    justifyContent: "space-between",
    shadowColor: "#1A237E",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: "hidden",
  },
  chip: {
    width: 26,
    height: 19,
    borderRadius: 4,
    backgroundColor: "rgba(255,236,194,0.9)",
    justifyContent: "center",
    paddingHorizontal: 4,
    gap: 2,
    marginBottom: 8,
  },
  chipLine: { height: 1.3, backgroundColor: "rgba(26,35,126,0.45)", borderRadius: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  uniName: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  cardType: { color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "700", letterSpacing: 1.5, marginTop: 2 },
  seal: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff", borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4 },
  sealText: { color: "#1A237E", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  bodyRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  name: { color: "#fff", fontSize: FONT.lg, fontWeight: "800", fontFamily: FONT_DISPLAY },
  roll: { color: "#FFECC2", fontSize: FONT.base, fontWeight: "700", letterSpacing: 2, marginTop: 2, fontFamily: MONO },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 12 },
  detailsRow: { flexDirection: "row", marginBottom: 8 },
  detailLabel: { color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  detailValue: { color: "#fff", fontSize: 12, fontWeight: "700", marginTop: 2 },
});
