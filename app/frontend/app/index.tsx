import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withDelay } from "react-native-reanimated";

import { useAuth } from "@/src/auth/AuthContext";
import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import BrandFooter from "@/src/components/BrandFooter";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const { user, loading, signingIn, signInError, signIn, renderGoogleButton } = useAuth();
  const router = useRouter();
  const planeX = useSharedValue(-80);

  useEffect(() => {
    planeX.value = withRepeat(
      withDelay(200, withTiming(width + 80, { duration: 6000, easing: Easing.inOut(Easing.quad) })),
      -1,
      false
    );
  }, []);

  // Web: mount Google's own Sign-In button (most reliable way to trigger the flow).
  useEffect(() => {
    if (Platform.OS === "web" && !loading && !user) {
      renderGoogleButton("google-signin-container");
    }
  }, [loading, user, renderGoogleButton]);

  useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  const planeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: planeX.value }] }));

  return (
    <View style={styles.container} testID="login-screen">
      <LinearGradient
        colors={[COLORS.indigo, "#3949AB", COLORS.saffron]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={{ uri: "https://images.pexels.com/photos/9693916/pexels-photo-9693916.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
        style={[StyleSheet.absoluteFill, { opacity: 0.08 }]}
        contentFit="cover"
      />

      <View style={styles.top}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="car-sport" size={26} color={COLORS.saffron} />
          </View>
          <Text style={styles.logo}>UniPool</Text>
        </View>
        <Text style={styles.tagline}>Share the ride. Split the fare. Save the day.</Text>
      </View>

      {/* Animated route strip */}
      <View style={styles.routeStrip}>
        <View style={styles.dashedLine} />
        <Animated.View style={[styles.planeIcon, planeStyle]}>
          <Ionicons name="airplane" size={28} color={COLORS.cream} />
        </Animated.View>
      </View>

      <View style={styles.bottomCard}>
        <Text style={styles.heading}>Welcome, traveller</Text>
        <Text style={styles.subheading}>
          Sign in with your college email to post cab-pool requests and get matched instantly.
        </Text>
        {Platform.OS === "web" ? (
          // Google's own rendered button (most reliable way to trigger Sign-In on web).
          <View style={styles.googleBtnWrap}>
            {loading ? (
              <ActivityIndicator color={COLORS.indigo} />
            ) : signingIn ? (
              <View style={{ alignItems: "center" }}>
                <ActivityIndicator color={COLORS.indigo} />
                <Text style={styles.signingInText}>
                  Signing you in… this can take up to a minute if the server was asleep.
                </Text>
              </View>
            ) : (
              <>
                <View nativeID="google-signin-container" />
                <Pressable testID="signin-fallback" onPress={signIn} hitSlop={8} style={{ marginTop: SPACING.sm }}>
                  <Text style={styles.fallbackLink}>Button not showing? Tap here</Text>
                </Pressable>
                {signInError ? (
                  <Text testID="signin-error" style={styles.errorText}>{signInError}</Text>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <Pressable
            testID="google-signin-button"
            onPress={signIn}
            disabled={loading}
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.indigo} />
            ) : (
              <>
                <View style={styles.gLogo}>
                  <Text style={{ fontWeight: "800", color: "#4285F4", fontSize: 18 }}>G</Text>
                </View>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>
        )}

        <View style={styles.footerRow}>
          <Ionicons name="shield-checkmark" size={14} color={COLORS.muted} />
          <Text style={styles.footerText}>Safe rides. Real people. Verified emails.</Text>
        </View>
        <BrandFooter />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.indigo },
  top: { paddingTop: 88, paddingHorizontal: SPACING.xl, alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  logoBadge: {
    width: 50, height: 50, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,236,194,0.18)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,236,194,0.4)",
    shadowColor: COLORS.saffron, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  logo: { fontSize: 38, fontWeight: "800", color: COLORS.cream, letterSpacing: 0.3, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,236,194,0.9)", marginTop: SPACING.md, fontSize: FONT.lg, textAlign: "center" },

  routeStrip: { flex: 1, justifyContent: "center", overflow: "hidden" },
  dashedLine: {
    height: 2, marginHorizontal: SPACING.xl, borderStyle: "dashed", borderTopWidth: 2,
    borderColor: "rgba(255,236,194,0.6)",
  },
  planeIcon: { position: "absolute", top: "50%", marginTop: -22 },

  bottomCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 12,
  },
  heading: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, marginBottom: SPACING.sm, fontFamily: FONT_DISPLAY, letterSpacing: -0.3 },
  subheading: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.xl, lineHeight: 20 },
  googleBtnWrap: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  fallbackLink: { color: COLORS.muted, fontSize: FONT.sm, textDecorationLine: "underline" },
  signingInText: { color: COLORS.muted, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 260 },
  errorText: { color: COLORS.error, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 280 },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.md,
    backgroundColor: "#fff", borderRadius: RADIUS.pill, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  gLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee" },
  googleText: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface },
  footerRow: { marginTop: SPACING.lg, flexDirection: "row", alignItems: "center", gap: SPACING.sm, justifyContent: "center" },
  footerText: { color: COLORS.muted, fontSize: FONT.sm },
});
