import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/theme_context/ThemeContext";

/** Subtle depth layer: decorative only, never competing with content. */
export default function AmbientDepth() {
  const { colors, isDark } = useTheme();
  const float = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 5200, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 5200, useNativeDriver: true }),
    ]));
    const rotating = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 22000, useNativeDriver: true }));
    floating.start(); rotating.start();
    return () => { floating.stop(); rotating.stop(); };
  }, [float, spin]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] });
  const accent = isDark ? "#7FA2FF" : colors.indigo;
  const warm = isDark ? "#FFB84D" : colors.saffron;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.orb, styles.orbOne, { transform: [{ translateY }] }]}><LinearGradient colors={[`${accent}2A`, `${accent}03`]} style={styles.orbFill} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 0.9 }} /></Animated.View>
    <Animated.View style={[styles.orb, styles.orbTwo, { transform: [{ translateY: Animated.multiply(translateY, -0.65) }] }]}><LinearGradient colors={[`${warm}20`, `${warm}02`]} style={styles.orbFill} start={{ x: 0.1, y: 0.1 }} end={{ x: 0.9, y: 0.9 }} /></Animated.View>
    <Animated.View style={[styles.cube, { transform: [{ perspective: 900 }, { rotateX: "10deg" }, { rotateY: rotate }, { translateY }] }]}>
      <View style={[styles.cubeFace, styles.cubeTop, { backgroundColor: `${accent}0C`, borderColor: `${accent}18` }]} />
      <View style={[styles.cubeFace, styles.cubeFront, { backgroundColor: `${accent}08`, borderColor: `${accent}14` }]} />
      <View style={[styles.cubeFace, styles.cubeSide, { backgroundColor: `${warm}08`, borderColor: `${warm}12` }]} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  orb: { position: "absolute", borderRadius: 999, overflow: "hidden" }, orbFill: { flex: 1 },
  orbOne: { width: 180, height: 180, right: -55, top: 120, opacity: 0.35 }, orbTwo: { width: 120, height: 120, left: -38, bottom: 190, opacity: 0.25 },
  cube: { position: "absolute", width: 86, height: 86, right: 42, top: 265, opacity: 0.30 }, cubeFace: { position: "absolute", width: 72, height: 72, borderWidth: 1, borderRadius: 14 }, cubeTop: { left: 7, top: 0, transform: [{ skewX: "-18deg" }] }, cubeFront: { left: 0, top: 12 }, cubeSide: { left: 17, top: 18, transform: [{ skewY: "18deg" }] },
});
