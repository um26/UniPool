import React from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, FONT } from "@/src/theme";

const INSTAGRAM_HANDLE = "binary.bots_01";
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export default function BrandFooter({ light = false }: { light?: boolean }) {
  const color = light ? "rgba(255,236,194,0.85)" : COLORS.muted;
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color }]}>Made with </Text>
      <Ionicons name="heart" size={12} color={light ? COLORS.saffron : COLORS.error} />
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
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", paddingVertical: SPACING.md },
  igRow: { flexDirection: "row", alignItems: "center" },
  text: { fontSize: FONT.sm },
});
