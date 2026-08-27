import React from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

export default function DateTimeField({ mode, value, onChangeText, placeholder }: { mode: "date" | "time"; value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  const nativeWebProps = Platform.OS === "web" ? ({ type: mode } as any) : {};
  return <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Ionicons name={mode === "date" ? "calendar-outline" : "time-outline"} size={18} color={colors.indigo} />
    <TextInput
      {...nativeWebProps}
      accessibilityLabel={mode === "date" ? "Departure date" : "Departure time"}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || (mode === "date" ? "Select date" : "Select time")}
      placeholderTextColor={colors.muted}
      style={[styles.input, { color: colors.onSurface }]}
    />
  </View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  input: { flex: 1, minWidth: 0, fontSize: 13, paddingVertical: 10, backgroundColor: "transparent" },
});