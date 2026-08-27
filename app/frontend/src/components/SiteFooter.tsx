import React, { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme_context/ThemeContext";
import SocialShareSheet from "@/src/components/SocialShareSheet";

const INSTAGRAM_HANDLE = "binary.bots_01";
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
const CONTACT_EMAIL = "binary.bots.0110@gmail.com";
const HOME = "https://uni-pool-ruddy.vercel.app";

export default function SiteFooter() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [referOpen, setReferOpen] = useState(false);
  if (Platform.OS !== "web" || width < 900) return null;

  return <>
    <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      <View style={styles.left}><Text style={[styles.copy, { color: colors.muted }]}>Made with </Text><Ionicons name="heart" size={12} color={colors.error} /><Text style={[styles.copy, { color: colors.muted }]}> by BinaryBots</Text></View>
      <View style={styles.links}>
        <Pressable onPress={() => Linking.openURL(INSTAGRAM_URL)} style={styles.link}><Ionicons name="logo-instagram" size={14} color={colors.muted} /><Text style={[styles.linkText, { color: colors.muted }]}>Instagram</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=UniPool%20contact`)} style={styles.link}><Ionicons name="mail-outline" size={14} color={colors.muted} /><Text style={[styles.linkText, { color: colors.muted }]}>Contact</Text></Pressable>
        <Pressable onPress={() => setReferOpen(true)} style={styles.link}><Ionicons name="person-add-outline" size={14} color={colors.muted} /><Text style={[styles.linkText, { color: colors.muted }]}>Refer a friend</Text></Pressable>
        {user ? <Pressable onPress={() => router.push("/settings" as any)} style={styles.link}><Ionicons name="shield-checkmark-outline" size={14} color={colors.muted} /><Text style={[styles.linkText, { color: colors.muted }]}>Privacy & safety</Text></Pressable> : null}
      </View>
    </View>
    <SocialShareSheet visible={referOpen} onClose={() => setReferOpen(false)} payload={{ title: "Refer a friend to UniPool", text: "Join me on UniPool — a verified university ride-sharing network for easier campus, airport and station travel.", url: HOME }} />
  </>;
}

const styles = StyleSheet.create({
  footer: { minHeight: 42, borderTopWidth: 1, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  left: { flexDirection: "row", alignItems: "center" },
  copy: { fontSize: 10 },
  links: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "flex-end" },
  link: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  linkText: { fontSize: 10, fontWeight: "700" },
});