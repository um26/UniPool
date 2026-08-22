import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withDelay } from "react-native-reanimated";

import { COLORS, FONT_DISPLAY } from "@/src/theme";

const { width } = Dimensions.get("window");
const TRAVEL = Math.min(width * 0.6, 220);

export default function AnimatedSplash() {
  const carX = useSharedValue(0);
  const bob = useSharedValue(0);
  const pulse = useSharedValue(0.85);

  useEffect(() => {
    carX.value = withRepeat(
      withDelay(150, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })),
      -1,
      true
    );
    bob.value = withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);

  const carStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: carX.value * TRAVEL },
      { translateY: -4 + bob.value * 4 },
      { scaleX: -1 }, // face the direction of travel
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5,
    transform: [{ scale: 0.9 + pulse.value * 0.2 }],
  }));

  return (
    <View style={styles.container} testID="animated-splash">
      <LinearGradient colors={[COLORS.indigo, "#3949AB", COLORS.saffron]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={styles.center}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="car-sport" size={22} color={COLORS.saffron} />
          </View>
          <Text style={styles.logo}>UniPool</Text>
        </View>

        <View style={styles.trackWrap}>
          <View style={styles.dashedLine} />
          <Animated.View style={[styles.pinDot, styles.pinStart, dotStyle]} />
          <View style={[styles.pinDot, styles.pinEnd]} />
          <Animated.View style={[styles.carWrap, carStyle]}>
            <Ionicons name="car-sport" size={26} color="#fff" />
          </Animated.View>
        </View>

        <Text style={styles.tagline}>Getting your ride ready…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 40 },
  logoBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 26, fontWeight: "800", color: "#fff", fontFamily: FONT_DISPLAY, letterSpacing: 0.5 },
  trackWrap: { width: TRAVEL + 40, height: 40, justifyContent: "center" },
  dashedLine: {
    height: 2, borderStyle: "dashed", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 1, marginHorizontal: 8,
  },
  pinDot: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFECC2", top: 16 },
  pinStart: { left: 4 },
  pinEnd: { right: 4, backgroundColor: "rgba(255,236,194,0.4)" },
  carWrap: { position: "absolute", left: 4, top: 6 },
  tagline: { marginTop: 36, color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
});
