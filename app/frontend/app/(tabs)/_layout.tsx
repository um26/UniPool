import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import ExperienceDock from "@/src/components/ExperienceDock";

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const barBg = isDark ? "rgba(11,18,32,0.96)" : "rgba(255,255,255,0.96)";
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.saffron,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 4 },
        tabBarStyle: { position: "absolute", borderTopWidth: 1, borderTopColor: colors.border, elevation: 0, height: 74, paddingTop: 8, backgroundColor: Platform.OS === "android" ? barBg : "transparent" },
        tabBarBackground: () => <BlurView intensity={isDark ? 18 : 24} tint={isDark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { backgroundColor: barBg }]} />,
        tabBarAccessibilityLabel: route.name === "index" ? "Pool" : route.name === "matches" ? "Matches" : route.name === "messages" ? "Chats" : route.name === "games" ? "Play games" : route.name === "plan" ? "Plan" : "Profile",
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, any> = { index: focused ? "car-sport" : "car-sport-outline", matches: focused ? "sparkles" : "sparkles-outline", messages: focused ? "chatbubble" : "chatbubble-outline", games: focused ? "game-controller" : "game-controller-outline", plan: focused ? "compass" : "compass-outline", profile: focused ? "person-circle" : "person-circle-outline" };
          return <View style={[styles.iconWrap, focused && { backgroundColor: isDark ? "rgba(255,184,77,0.14)" : "rgba(244,166,42,0.12)" }]}><Ionicons name={map[route.name] || "ellipse"} size={21} color={color} /></View>;
        },
      })}>
        <Tabs.Screen name="index" options={{ title: "Pool" }} />
        <Tabs.Screen name="matches" options={{ title: "Matches" }} />
        <Tabs.Screen name="messages" options={{ title: "Chats" }} />
        <Tabs.Screen name="plan" options={{ title: "Plan" }} />
        <Tabs.Screen name="games" options={{ title: "Play" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
      <ExperienceDock />
    </View>
  );
}

const styles = StyleSheet.create({ iconWrap: { padding: 6, borderRadius: RADIUS.pill } });
