import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { COLORS } from "@/src/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const COLORS_POOL = [COLORS.saffron, COLORS.indigo, "#F57F17", "#3949AB", COLORS.success, "#FFECC2"];
const PARTICLE_COUNT = 36;

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  shape: "square" | "circle";
  left: number;
};

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }).map(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    rotate: new Animated.Value(0),
    opacity: new Animated.Value(1),
    color: COLORS_POOL[Math.floor(Math.random() * COLORS_POOL.length)],
    size: 6 + Math.random() * 6,
    shape: Math.random() > 0.5 ? "square" : "circle",
    left: Math.random() * SCREEN_W,
  }));
}

/**
 * Fire-and-forget confetti burst. Bump `burstKey` (any changing value, e.g.
 * a counter) to trigger a new burst. Renders as a full-screen, non-blocking
 * overlay (pointerEvents="none") that auto-clears itself.
 */
export default function Confetti({ burstKey }: { burstKey: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const prevKey = useRef(burstKey);

  useEffect(() => {
    if (burstKey === prevKey.current && burstKey === 0) return;
    prevKey.current = burstKey;
    if (burstKey === 0) return;

    const fresh = makeParticles();
    setParticles(fresh);

    const anims = fresh.map((p) => {
      const fallDistance = SCREEN_H * (0.5 + Math.random() * 0.4);
      const drift = (Math.random() - 0.5) * 140;
      const duration = 1400 + Math.random() * 900;
      return Animated.parallel([
        Animated.timing(p.y, { toValue: fallDistance, duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.x, { toValue: drift, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 2 + Math.random() * 3, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(duration * 0.55),
          Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.45, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.parallel(anims).start(() => setParticles([]));
  }, [burstKey]);

  if (particles.length === 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: p.left,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === "circle" ? p.size / 2 : 2,
              opacity: p.opacity,
              transform: [
                { translateY: p.y },
                { translateX: p.x },
                { rotate: p.rotate.interpolate({ inputRange: [0, 5], outputRange: ["0deg", "1800deg"] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  particle: { position: "absolute", top: -20 },
});
