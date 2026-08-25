import React, { useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { SPACING, RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

function Shimmer({ style }: { style?: any }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.78, duration: 850, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: colors.surface3 }, style, { opacity }]} />;
}

/** A compact travel-card placeholder, not a page-wide spreadsheet. */
export function PoolCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card} testID="pool-card-skeleton">
      <View style={styles.topRow}>
        <View style={styles.personRow}>
          <Shimmer style={styles.avatar} />
          <View style={styles.personCopy}>
            <Shimmer style={styles.nameLine} />
            <Shimmer style={styles.metaLine} />
          </View>
        </View>
        <Shimmer style={styles.timePill} />
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.routeRow}><Shimmer style={styles.routeDot} /><Shimmer style={styles.routeLong} /></View>
        <View style={styles.routeStem} />
        <View style={styles.routeRow}><Shimmer style={styles.routeDot} /><Shimmer style={styles.routeShort} /></View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.pills}><Shimmer style={styles.smallPill} /><Shimmer style={styles.smallPill2} /></View>
        <Shimmer style={styles.actionPill} />
      </View>
    </View>
  );
}

export function PoolFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={stylesShell.wrap} accessibilityLabel="Loading rides">
      {Array.from({ length: count }).map((_, i) => <PoolCardSkeleton key={i} />)}
    </View>
  );
}

const stylesShell = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 780, alignSelf: "center" },
});

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACING.md },
  personRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: SPACING.md },
  personCopy: { flex: 1, maxWidth: 240, gap: 7 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  nameLine: { width: "72%", height: 12, borderRadius: 6 },
  metaLine: { width: "48%", height: 9, borderRadius: 5 },
  timePill: { width: 92, height: 26, borderRadius: RADIUS.pill },
  routeBlock: { marginTop: SPACING.lg, marginBottom: SPACING.lg, paddingLeft: 3 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeStem: { width: 2, height: 18, marginLeft: 4, marginVertical: 3, backgroundColor: colors.border },
  routeLong: { width: "54%", maxWidth: 300, height: 12, borderRadius: 6 },
  routeShort: { width: "38%", maxWidth: 220, height: 12, borderRadius: 6 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACING.md },
  pills: { flexDirection: "row", gap: SPACING.sm, flex: 1 },
  smallPill: { width: 76, height: 25, borderRadius: RADIUS.pill },
  smallPill2: { width: 92, height: 25, borderRadius: RADIUS.pill },
  actionPill: { width: 118, height: 36, borderRadius: RADIUS.pill },
});