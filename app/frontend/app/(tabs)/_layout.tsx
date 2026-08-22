import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.saffron,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          elevation: 0,
          height: 74,
          paddingTop: 8,
          backgroundColor: Platform.OS === "android" ? (isDark ? "rgba(18,16,22,0.96)" : "rgba(255,249,242,0.96)") : "transparent",
        },
        tabBarBackground: () => (
          <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ),
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, any> = {
            index: focused ? "car-sport" : "car-sport-outline",
            matches: focused ? "sparkles" : "sparkles-outline",
            messages: focused ? "chatbubble" : "chatbubble-outline",
            games: focused ? "game-controller" : "game-controller-outline",
            profile: focused ? "person-circle" : "person-circle-outline",
          };
          return (
            <View style={[styles.iconWrap, focused && { backgroundColor: isDark ? "rgba(255,183,77,0.18)" : "rgba(255,153,51,0.15)" }]}>
              <Ionicons name={map[route.name] || "ellipse"} size={22} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Pool" }} />
      <Tabs.Screen name="matches" options={{ title: "Matches" }} />
      <Tabs.Screen name="messages" options={{ title: "Chats" }} />
      <Tabs.Screen name="games" options={{ title: "Play" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { padding: 6, borderRadius: RADIUS.pill },
});
