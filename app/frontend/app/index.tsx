import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from "react-native-reanimated";
import { COLORS, FONT_DISPLAY } from "@/src/theme";

const { width } = Dimensions.get("window");
const HERO_URL = "https://raw.githubusercontent.com/um26/UniPool/feat/premium-theme-and-airport-login/app/frontend/assets/mu-airport-hero.svg";

export default function LoginScreen() {
  const router = useRouter();
  const travel = useSharedValue(0);

  useEffect(() => {
    travel.value = withRepeat(withTiming(1, { duration: 15000, easing: Easing.linear }), -1, false);
  }, []);

  const arrivingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.035, 0.55, 0.64, 0.69], [0, 1, 1, 1, 0]),
    transform: [
      { translateX: interpolate(travel.value, [0, 0.10, 0.18, 0.28, 0.40, 0.52, 0.60], [-90, -55, -10, width * 0.14, width * 0.30, width * 0.42, width * 0.50]) },
      { translateY: interpolate(travel.value, [0, 0.10, 0.18, 0.28, 0.40, 0.52, 0.60], [-65, -45, -25, -10, 2, 8, 8]) },
      { rotate: `${interpolate(travel.value, [0, 0.10, 0.18, 0.28, 0.40], [-17, -12, -7, -2, 0])}deg` },
      { scale: interpolate(travel.value, [0, 0.18, 0.60], [0.78, 0.94, 1]) },
    ],
  }));

  const departingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0.65, 0.69, 0.73, 0.96, 1], [0, 1, 1, 1, 0]),
    transform: [
      { translateX: interpolate(travel.value, [0.69, 0.73, 0.82, 0.90, 0.96, 1], [width * 0.50, width * 0.52, width * 0.64, width * 0.79, width * 0.94, width + 100]) },
      { translateY: interpolate(travel.value, [0.69, 0.82, 0.90, 0.96, 1], [8, 8, 6, -10, -65]) },
      { rotate: `${interpolate(travel.value, [0.69, 0.86, 0.94, 1], [0, 0, -7, -16])}deg` },
      { scale: interpolate(travel.value, [0.69, 0.94, 1], [1, 1, 0.78]) },
    ],
  }));

  return (
    <View style={styles.container} testID="login-screen">
      <View style={styles.hero}>
        <Image source={{ uri: HERO_URL }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.heroShade} />
        <View style={styles.brandOverlay}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}><Ionicons name="car-sport" size={25} color={COLORS.saffron} /></View>
            <Text style={styles.logo}>UniPool</Text>
          </View>
          <Text style={styles.tagline}>Share the ride. Split the fare. <Text style={styles.taglineAccent}>Save the day.</Text></Text>
        </View>
        <Animated.View style={[styles.animatedPlane, arrivingPlaneStyle]}><Ionicons name="airplane" size={38} color="#fff" /></Animated.View>
        <Animated.View style={[styles.animatedPlane, departingPlaneStyle]}><Ionicons name="airplane" size={38} color="#fff" /></Animated.View>
      </View>

      <View style={styles.card}>
        <View>
          <Text style={styles.heading}>Welcome, traveller</Text>
          <Text style={styles.subheading}>Explore UniPool and see the new experience before we switch authentication back on.</Text>
        </View>
        <Pressable testID="enter-app" onPress={() => router.replace("/(tabs)")} style={({ pressed }) => [styles.enterButton, pressed && styles.enterButtonPressed]}>
          <Text style={styles.enterText}>Enter UniPool</Text>
          <Ionicons name="arrow-forward" size={21} color="#fff" />
        </Pressable>
        <Text style={styles.note}>Preview mode · authentication temporarily bypassed</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071735" },
  hero: { height: 440, position: "relative", overflow: "hidden" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(19,48,119,0.03)" },
  brandOverlay: { position: "absolute", top: 34, left: 48, zIndex: 5 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(7,23,53,0.26)", borderWidth: 1.2, borderColor: "rgba(255,211,107,0.7)", alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: 0.2, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,255,255,0.94)", marginTop: 10, fontSize: 16, fontWeight: "600" },
  taglineAccent: { color: COLORS.saffron },
  animatedPlane: { position: "absolute", left: 0, top: 365, zIndex: 8, width: 48, height: 40, alignItems: "center", justifyContent: "center" },
  card: { flex: 1, backgroundColor: "#fbfcfe", borderTopLeftRadius: 34, borderTopRightRadius: 34, marginTop: -2, paddingHorizontal: 48, paddingTop: 32, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } },
  heading: { fontSize: 29, fontWeight: "800", color: "#1d273a", fontFamily: FONT_DISPLAY, textAlign: "center" },
  subheading: { color: "#66738b", fontSize: 15, marginTop: 8, textAlign: "center", maxWidth: 720 },
  enterButton: { marginTop: 28, width: "100%", maxWidth: 680, height: 58, borderRadius: 15, backgroundColor: COLORS.indigo, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: COLORS.indigo, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  enterButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  enterText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  note: { marginTop: 12, color: "#8a95a7", fontSize: 12 },
});

// preview deployment trigger
