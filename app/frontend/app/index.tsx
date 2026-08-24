import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, TextInput, KeyboardAvoidingView, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from "react-native-reanimated";

import { useAuth } from "@/src/auth/AuthContext";
import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import BrandFooter from "@/src/components/BrandFooter";
import Turnstile from "@/src/components/Turnstile";

const { width } = Dimensions.get("window");
const HERO_URL = "https://raw.githubusercontent.com/um26/UniPool/5b90d0fd059122e21621eb2f5648da2fa64f0505/app/frontend/assets/mu-airport-hero.svg";
const MU_POSITION = width * 0.50;

export default function LoginScreen() {
  const { user, loading, signingIn, signInError, signIn, renderGoogleButton, signInWithPassword, signUpWithPassword } = useAuth();
  const router = useRouter();
  const travel = useSharedValue(0);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    travel.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && !loading && !user) renderGoogleButton("google-signin-container");
  }, [loading, user, renderGoogleButton]);

  useEffect(() => { if (user) router.replace("/(tabs)"); }, [user]);

  // Incoming aircraft approaches from the left, lands directly in front of MU,
  // then stays level and taxis straight across the runway.
  const arrivingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      travel.value,
      [0.00, 0.08, 0.18, 0.28, 0.42, 0.52, 0.72, 0.80],
      [0,    0,    1,    1,    1,    1,    1,    0]
    ),
    transform: [
      {
        translateX: interpolate(
          travel.value,
          [0.08, 0.18, 0.28, 0.40, 0.52, 0.62, 0.72, 0.80],
          [
            -140,
            -80,
            width * 0.05,
            width * 0.30,
            MU_POSITION,
            width * 0.62,
            width * 0.80,
            width * 0.96
          ]
        )
      },
      {
        translateY: interpolate(
          travel.value,
          [0.08, 0.18, 0.28, 0.40, 0.52, 0.62, 0.72, 0.80],
          [-110, -90, -60, -25, 0, 0, 0, 0]
        )
      },
      {
        rotate: `${interpolate(
          travel.value,
          [0.08, 0.18, 0.28, 0.40, 0.52, 0.62, 0.72, 0.80],
          [-18, -14, -8, -3, 0, 0, 0, 0]
        )}deg`
      },
      {
        scale: interpolate(
          travel.value,
          [0.08, 0.52],
          [0.60, 1]
        )
      }
    ]
  }));

  // The second aircraft runs along the runway first, reaches MU, then climbs away.
  const departingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      travel.value,
      [0.76, 0.80, 0.88, 0.96, 1.00],
      [0,    1,    1,    1,    0]
    ),
    transform: [
      {
        translateX: interpolate(
          travel.value,
          [0.76, 0.80, 0.84, 0.88, 0.92, 0.96, 1.00],
          [-100, width * 0.03, width * 0.25, width * 0.40, MU_POSITION, width * 0.72, width + 100]
        )
      },
      {
        translateY: interpolate(
          travel.value,
          [0.76, 0.84, 0.88, 0.92, 0.96, 1.00],
          [0, 0, 0, -35, -100, -180]
        )
      },
      {
        rotate: `${interpolate(
          travel.value,
          [0.76, 0.88, 0.92, 0.96, 1.00],
          [0, 0, -7, -14, -20]
        )}deg`
      },
      {
        scale: interpolate(
          travel.value,
          [0.76, 0.96, 1.00],
          [1, 0.9, 0.65]
        )
      }
    ]
  }));

  // A road cab uses a separate, lower lane. It eases into MU, pauses for ~2.7s,
  // then accelerates away so it reads as a real pickup/drop-off rather than a loop.
  const cabStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      travel.value,
      [0.02, 0.06, 0.18, 0.30, 0.40, 0.44, 0.59, 0.66, 0.78],
      [0,    1,    1,    1,    1,    1,    1,    1,    0]
    ),
    transform: [
      {
        translateX: interpolate(
          travel.value,
          [0.06, 0.18, 0.30, 0.38, 0.42, 0.44, 0.59, 0.66, 0.78],
          [-90, width * 0.08, width * 0.22, width * 0.36, MU_POSITION - 18, MU_POSITION, MU_POSITION, width * 0.70, width + 90]
        )
      },
      {
        translateY: interpolate(
          travel.value,
          [0.06, 0.42, 0.59, 0.78],
          [10, 0, 0, 0]
        )
      },
      {
        scale: interpolate(
          travel.value,
          [0.06, 0.42, 0.59, 0.78],
          [0.82, 1, 1, 0.96]
        )
      }
    ]
  }));

  const submitPasswordForm = async () => {
    setLocalError(null);
    if (!identifier.trim() || !password) { setLocalError("Please fill in all fields."); return; }
    try {
      if (mode === "login") await signInWithPassword(identifier.trim(), password, turnstileToken);
      else { if (!name.trim()) { setLocalError("Please enter your name."); return; } await signUpWithPassword(identifier.trim(), password, name.trim(), undefined, turnstileToken); }
    } catch {} finally { setTurnstileResetKey((k) => k + 1); }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <View style={styles.hero}>
        <Image source={{ uri: HERO_URL }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.heroShade} />
        <View style={styles.brandOverlay}>
          <View style={styles.logoRow}><View style={styles.logoBadge}><Ionicons name="car-sport" size={25} color={COLORS.saffron} /></View><Text style={styles.logo}>UniPool</Text></View>
          <Text style={styles.tagline}>Share the ride. Split the fare. <Text style={styles.taglineAccent}>Save the day.</Text></Text>
        </View>
        <Animated.View style={[styles.animatedPlane, arrivingPlaneStyle]}><Ionicons name="airplane" size={40} color="#fff" /></Animated.View>
        <Animated.View style={[styles.animatedPlane, departingPlaneStyle]}><Ionicons name="airplane" size={40} color="#fff" /></Animated.View>
        <Animated.View style={[styles.animatedCab, cabStyle]}>
          <View style={styles.cabSign}><Text style={styles.cabSignText}>TAXI</Text></View>
          <Ionicons name="car-sport" size={34} color={COLORS.saffron} />
        </Animated.View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ maxHeight: "62%" }}>
        <ScrollView contentContainerStyle={styles.bottomCard} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Welcome, traveller</Text>
          <Text style={styles.subheading}>Sign in with your college email to post cab-pool requests and get matched instantly.</Text>

          {!showPasswordForm ? (
            <>
              {Platform.OS === "web" ? (
                <View style={styles.googleBtnWrap}>
                  {loading ? <ActivityIndicator color={COLORS.indigo} /> : signingIn ? <View style={{ alignItems: "center" }}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.signingInText}>Signing you in… this can take up to a minute if the server was asleep.</Text></View> : <><View nativeID="google-signin-container" /><Pressable testID="signin-fallback" onPress={signIn} hitSlop={8} style={{ marginTop: SPACING.sm }}><Text style={styles.fallbackLink}>Button not showing? Tap here</Text></Pressable>{signInError ? <Text testID="signin-error" style={styles.errorText}>{signInError}</Text> : null}</>}
                </View>
              ) : (
                <Pressable testID="google-signin-button" onPress={signIn} disabled={loading} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}>
                  {loading ? <ActivityIndicator color={COLORS.indigo} /> : <><View style={styles.gLogo}><Text style={{ fontWeight: "800", color: "#4285F4", fontSize: 18 }}>G</Text></View><Text style={styles.googleText}>Continue with Google</Text></>}
                </Pressable>
              )}
              <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
              <Pressable testID="show-password-form" onPress={() => { setLocalError(null); setShowPasswordForm(true); }} style={styles.emailToggleBtn}><Ionicons name="mail-outline" size={18} color={COLORS.indigo} /><Text style={styles.emailToggleText}>Continue with email &amp; password</Text></Pressable>
            </>
          ) : (
            <View>
              <View style={styles.segmentRow}><Pressable testID="mode-login" onPress={() => { setMode("login"); setLocalError(null); }} style={[styles.segment, mode === "login" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>Log in</Text></Pressable><Pressable testID="mode-signup" onPress={() => { setMode("signup"); setLocalError(null); }} style={[styles.segment, mode === "signup" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Sign up</Text></Pressable></View>
              {mode === "signup" && <TextInput testID="signup-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="words" />}
              <TextInput testID="auth-identifier" value={identifier} onChangeText={setIdentifier} placeholder={mode === "login" ? "Email or username" : "Email"} placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" keyboardType={mode === "signup" ? "email-address" : "default"} />
              <TextInput testID="auth-password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={COLORS.muted} style={styles.input} secureTextEntry />
              {(localError || signInError) ? <Text testID="password-auth-error" style={styles.errorText}>{localError || signInError}</Text> : null}
              <Turnstile onToken={setTurnstileToken} resetKey={turnstileResetKey} />
              <Pressable testID="password-auth-submit" onPress={submitPasswordForm} disabled={signingIn} style={[styles.googleBtn, { backgroundColor: COLORS.indigo, marginTop: SPACING.md }, signingIn && { opacity: 0.7 }]}>{signingIn ? <ActivityIndicator color="#fff" /> : <Text style={[styles.googleText, { color: "#fff" }]}>{mode === "login" ? "Log in" : "Create account"}</Text>}</Pressable>
              <Pressable testID="back-to-google" onPress={() => { setShowPasswordForm(false); setLocalError(null); }} hitSlop={8} style={{ marginTop: SPACING.md, alignSelf: "center" }}><Text style={styles.fallbackLink}>Back to Google sign-in</Text></Pressable>
            </View>
          )}

          <View style={styles.footerRow}><Ionicons name="shield-checkmark" size={14} color={COLORS.muted} /><Text style={styles.footerText}>Safe rides. Real people. Verified emails.</Text></View>
          <BrandFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071735" },
  hero: { height: 440, position: "relative", overflow: "hidden" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(19,48,119,0.02)" },
  brandOverlay: { position: "absolute", top: 34, left: 48, zIndex: 5 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(7,23,53,0.26)", borderWidth: 1.2, borderColor: "rgba(255,211,107,0.7)", alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: 0.2, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,255,255,0.94)", marginTop: 10, fontSize: 16, fontWeight: "600" },
  taglineAccent: { color: COLORS.saffron },
  animatedPlane: { position: "absolute", left: 0, top: 365, zIndex: 8, width: 52, height: 42, alignItems: "center", justifyContent: "center" },
  animatedCab: { position: "absolute", left: 0, top: 398, zIndex: 7, width: 50, height: 38, alignItems: "center", justifyContent: "center" },
  cabSign: { position: "absolute", top: -5, left: 17, minWidth: 20, height: 8, paddingHorizontal: 3, borderRadius: 3, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  cabSignText: { fontSize: 4.5, lineHeight: 6, fontWeight: "900", color: "#18243b", letterSpacing: 0.2 },
  bottomCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: SPACING.xl, paddingBottom: SPACING.xxxl, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  heading: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, marginBottom: SPACING.sm, fontFamily: FONT_DISPLAY, letterSpacing: -0.3 },
  subheading: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.xl, lineHeight: 20 },
  googleBtnWrap: { alignItems: "center", justifyContent: "center", minHeight: 44 }, fallbackLink: { color: COLORS.muted, fontSize: FONT.sm, textDecorationLine: "underline" }, signingInText: { color: COLORS.muted, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 260 }, errorText: { color: COLORS.error, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 280 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginVertical: SPACING.lg }, dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border }, dividerText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: "600" },
  emailToggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.indigo, borderRadius: RADIUS.pill, paddingVertical: 14 }, emailToggleText: { color: COLORS.indigo, fontWeight: "700", fontSize: FONT.base },
  segmentRow: { flexDirection: "row", backgroundColor: COLORS.surface2, borderRadius: RADIUS.pill, padding: 4, marginBottom: SPACING.lg }, segment: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: "center" }, segmentActive: { backgroundColor: COLORS.indigo }, segmentText: { fontWeight: "700", color: COLORS.muted, fontSize: FONT.sm }, segmentTextActive: { color: "#fff" },
  input: { backgroundColor: "#fff", borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.base, color: COLORS.onSurface, marginBottom: SPACING.md },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.md, backgroundColor: "#fff", borderRadius: RADIUS.pill, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  gLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee" }, googleText: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface }, footerRow: { marginTop: SPACING.lg, flexDirection: "row", alignItems: "center", gap: SPACING.sm, justifyContent: "center" }, footerText: { color: COLORS.muted, fontSize: FONT.sm },
});
