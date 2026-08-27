import React from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { SPACING, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

const INSTAGRAM_HANDLE = "binary.bots_01";
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export default function BrandFooter({ light = false }: { light?: boolean }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const color = light ? "rgba(255,236,194,0.85)" : colors.muted;
  const onProfile = pathname.includes("profile");

  return (
    <View style={styles.wrap}>
      {onProfile ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open your Travel Network"
        onPress={() => router.push("/network" as any)}
        style={[styles.network, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.networkIcon, { backgroundColor: colors.surface2 }]}><Ionicons name="git-network-outline" size={17} color={colors.indigo} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.networkTitle, { color: colors.onSurface }]}>Travel Network</Text><Text style={[styles.networkSub, { color: colors.muted }]}>Reliability, completed rides and travel history</Text></View>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable> : null}

      <View style={styles.row}>
        <Text style={[styles.text, { color }]}>Made with </Text>
        <Ionicons name="heart" size={12} color={light ? colors.saffron : colors.error} />
        <Text style={[styles.text, { color }]}> by BinaryBots</Text>
        <Pressable
          testID="brand-instagram-link"
          onPress={() => Linking.openURL(INSTAGRAM_URL)}
          style={styles.igRow}
          hitSlop={8}
        >
          <Text style={[styles.text, { color }]}>  ·  </Text>
          <Ionicons name="logo-instagram" size={14} color={color} />
          <Text style={[styles.text, { color, marginLeft: 3 }]}>@{INSTAGRAM_HANDLE}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  network: { width: "100%", maxWidth: 620, alignSelf: "center", minHeight: 68, borderWidth: 1, borderRadius: 18, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  networkIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  networkTitle: { fontSize: 12, fontWeight: "900" },
  networkSub: { fontSize: 9, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", paddingVertical: SPACING.md },
  igRow: { flexDirection: "row", alignItems: "center" },
  text: { fontSize: FONT.sm },
});