import React from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { SPACING, FONT } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

const INSTAGRAM_HANDLE = "binary.bots_01";
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
const CONTACT_EMAIL = "binary.bots.0110@gmail.com";

export default function BrandFooter({ light = false }: { light?: boolean }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const color = light ? "rgba(255,236,194,0.85)" : colors.muted;
  const onProfile = pathname.includes("profile");

  return <View style={styles.wrap}>
    {onProfile ? <View style={styles.profileLinks}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open your Travel Network" onPress={() => router.push("/network" as any)} style={[styles.network, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.networkIcon, { backgroundColor: colors.surface2 }]}><Ionicons name="git-network-outline" size={18} color={colors.indigo} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.networkTitle, { color: colors.onSurface }]}>Travel Network</Text><Text style={[styles.networkSub, { color: colors.muted }]}>Reliability, completed rides and history</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open UniPool settings" onPress={() => router.push("/settings" as any)} style={[styles.network, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.networkIcon, { backgroundColor: colors.surface2 }]}><Ionicons name="settings-outline" size={18} color={colors.saffron} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.networkTitle, { color: colors.onSurface }]}>Settings</Text><Text style={[styles.networkSub, { color: colors.muted }]}>Notifications, appearance, pickups and privacy</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
    </View> : <View style={styles.row}>
      <Text style={[styles.text, { color }]}>Made with </Text><Ionicons name="heart" size={12} color={light ? colors.saffron : colors.error} /><Text style={[styles.text, { color }]}> by BinaryBots</Text>
      <Pressable testID="brand-instagram-link" onPress={() => Linking.openURL(INSTAGRAM_URL)} style={styles.link} hitSlop={8}><Text style={[styles.text, { color }]}> · </Text><Ionicons name="logo-instagram" size={14} color={color} /><Text style={[styles.text, { color, marginLeft: 3 }]}>@{INSTAGRAM_HANDLE}</Text></Pressable>
      <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=UniPool%20contact`)} style={styles.link} hitSlop={8}><Text style={[styles.text, { color }]}> · </Text><Ionicons name="mail-outline" size={14} color={color} /><Text style={[styles.text, { color, marginLeft: 3 }]}>Contact</Text></Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  profileLinks: { width: "100%", maxWidth: 920, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: 9 },
  network: { flexGrow: 1, flexBasis: 280, minHeight: 72, borderWidth: 1, borderRadius: 18, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  networkIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  networkTitle: { fontSize: 12, fontWeight: "900" }, networkSub: { fontSize: 9, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", paddingVertical: SPACING.md }, link: { flexDirection: "row", alignItems: "center" }, text: { fontSize: FONT.sm },
});