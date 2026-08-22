import React, { useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { SPACING, RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

function Shimmer({ style }: { style?: any }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[{ backgroundColor: colors.borderStrong }, style, { opacity }]} />;
}

/** Mimics the shape of a Pool feed card while data loads. */
export function PoolCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card} testID="pool-card-skeleton">
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md }}>
        <Shimmer style={{ width: 44, height: 44, borderRadius: 22 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Shimmer style={{ width: "55%", height: 14, borderRadius: 6 }} />
          <Shimmer style={{ width: "35%", height: 11, borderRadius: 6 }} />
        </View>
      </View>
      <Shimmer style={{ width: "80%", height: 12, borderRadius: 6, marginBottom: 10 }} />
      <Shimmer style={{ width: "60%", height: 12, borderRadius: 6, marginBottom: 14 }} />
      <Shimmer style={{ width: "100%", height: 40, borderRadius: RADIUS.pill }} />
    </View>
  );
}

export function PoolFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => <PoolCardSkeleton key={i} />)}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: colors.border,
  },
});
