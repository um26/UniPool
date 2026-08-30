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
  const { colors } = useTheme(); const pathname = usePathname(); const router = useRouter();
  const color = light ? "rgba(255,236,194,0.85)" : colors.muted; const onProfile = pathname.includes("profile");
  if (onProfile) return <View style={styles.wrap}><View style={styles.profileLinks}>
    <ProfileLink icon="people-outline" iconColor={colors.indigo} title="People" sub="Find students by name, email, branch or batch" onPress={() => router.push("/people" as any)} colors={colors} styles={styles} />
    <ProfileLink icon="wallet-outline" iconColor={colors.saffron} title="Circles" sub="Shared expenses and personal money" onPress={() => router.push("/circles" as any)} colors={colors} styles={styles} />
    <ProfileLink icon="game-controller-outline" iconColor={colors.indigo} title="Time-pass" sub="Travel trivia, XP and quick games" onPress={() => router.push("/(tabs)/games" as any)} colors={colors} styles={styles} />
    <ProfileLink icon="git-network-outline" iconColor={colors.indigo} title="Travel Network" sub="Reliability, completed rides and history" onPress={() => router.push("/network" as any)} colors={colors} styles={styles} />
    <ProfileLink icon="settings-outline" iconColor={colors.saffron} title="Settings" sub="Notifications, appearance, privacy and help" onPress={() => router.push("/settings" as any)} colors={colors} styles={styles} />
  </View></View>;
  return <View style={styles.wrap}><View style={styles.row}>
    <Pressable onPress={() => Linking.openURL(INSTAGRAM_URL)} style={styles.link}><Text style={[styles.text, { color }]}>Made with </Text><Ionicons name="heart" size={12} color={light ? colors.saffron : colors.error} /><Text style={[styles.text, { color }]}> by BinaryBots</Text></Pressable>
    <Text style={[styles.text, { color }]}> · </Text><Pressable onPress={() => router.push("/terms" as any)}><Text style={[styles.text, { color }]}>Terms</Text></Pressable>
    <Text style={[styles.text, { color }]}> · </Text><Pressable onPress={() => router.push("/privacy" as any)}><Text style={[styles.text, { color }]}>Privacy</Text></Pressable>
    <Text style={[styles.text, { color }]}> · </Text><Pressable onPress={() => router.push("/faq" as any)}><Text style={[styles.text, { color }]}>FAQ</Text></Pressable>
    <Text style={[styles.text, { color }]}> · </Text><Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=UniPool%20contact`)}><Text style={[styles.text, { color }]}>Contact</Text></Pressable>
  </View></View>;
}

function ProfileLink({ icon, iconColor, title, sub, onPress, colors, styles }: any) { return <Pressable accessibilityLabel={`Open ${title}`} onPress={onPress} style={[styles.network, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.networkIcon, { backgroundColor: colors.surface2 }]}><Ionicons name={icon} size={18} color={iconColor} /></View><View style={{ flex: 1 }}><Text style={[styles.networkTitle, { color: colors.onSurface }]}>{title}</Text><Text style={[styles.networkSub, { color: colors.muted }]}>{sub}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} /></Pressable>; }

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }, profileLinks: { width: "100%", maxWidth: 920, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", gap: 9 }, network: { flexGrow: 1, flexBasis: 280, minHeight: 72, borderWidth: 1, borderRadius: 18, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 }, networkIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }, networkTitle: { fontSize: 12, fontWeight: "900" }, networkSub: { fontSize: 9, marginTop: 2 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", paddingVertical: SPACING.md }, link: { flexDirection: "row", alignItems: "center" }, text: { fontSize: FONT.sm },
});