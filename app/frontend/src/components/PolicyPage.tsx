import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { FONT_DISPLAY, RADIUS, SPACING } from "@/src/theme";

export type PolicySection = { title: string; body: string };

export default function PolicyPage({ eyebrow, title, intro, updated = "30 August 2026", sections }: { eyebrow: string; title: string; intro: string; updated?: string; sections: PolicySection[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text><Text style={styles.updated}>Last updated {updated}</Text></View>
      </View>
      <View style={styles.hero}><Text style={styles.intro}>{intro}</Text></View>
      {sections.map((section) => <View key={section.title} style={styles.section}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.body}>{section.body}</Text></View>)}
      <View style={styles.contact}><Ionicons name="mail-outline" size={18} color={colors.indigo} /><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Questions?</Text><Text style={styles.body}>Contact BinaryBots at binary.bots.0110@gmail.com.</Text></View><Pressable onPress={() => Linking.openURL("mailto:binary.bots.0110@gmail.com?subject=UniPool%20policy%20question")}><Text style={styles.link}>Email us</Text></Pressable></View>
    </ScrollView>
  </SafeAreaView>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, page: { width: "100%", maxWidth: 880, alignSelf: "center", padding: SPACING.lg, paddingBottom: 120 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 18 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, title: { color: colors.onSurface, fontSize: 30, fontWeight: "900", fontFamily: FONT_DISPLAY, marginTop: 3 }, updated: { color: colors.muted, fontSize: 10, marginTop: 4 },
  hero: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.xl, padding: 20, marginBottom: 24 }, intro: { color: colors.onSurface2, fontSize: 14, lineHeight: 22, fontWeight: "600" },
  section: { marginBottom: 22 }, sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900", marginBottom: 6 }, body: { color: colors.onSurface2, fontSize: 12, lineHeight: 20 },
  contact: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.lg, padding: 14 }, link: { color: colors.indigo, fontSize: 11, fontWeight: "900" },
});
