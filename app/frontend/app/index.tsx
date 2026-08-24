import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, TextInput, KeyboardAvoidingView, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
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
          [-140, -80, width * 0.05, width * 0.30, MU_POSITION, width * 0.62, width * 0.80, width * 0.96]
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
        scale: interpolate(travel.value, [0.08, 0.52], [0.60, 1])
      }
    ]
  }));

  // The second aircraft runs along the runway first, reaches MU, then climbs away.
  const departingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0.77, 0.80, 0.88, 0.96, 1.00], [0, 1, 1, 1, 0]),
    transform: [
      {
        translateX: interpolate(
          travel.value,
          [0.77, 0.80, 0.84, 0.88, 0.92, 0.96, 1.00],
          [-100, width * 0.03, width * 0.25, width * 0.40, MU_POSITION, width * 0.72, width + 100]
        )
      },
      {
        translateY: interpolate(travel.value, [0.77, 0.84, 0.88, 0.92, 0.96, 1.00], [0, 0, 0, -35, -100, -180])
      },
      {
        rotate: `${interpolate(travel.value, [0.77, 0.88, 0.92, 0.96, 1.00], [0, 0, -7, -14, -20])}deg`
      },
      {
        scale: interpolate(travel.value, [0.77, 0.96, 1.00], [1, 0.9, 0.65])
      }
    ]
  }));

  // The cab runs only after the first aircraft has landed and finishes before
  // the second aircraft begins its takeoff sequence. It starts quickly, eases
  // into a stop in front of MU for ~1.5s, then accelerates away.
  const cabStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      travel.value,
      [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8],
      [0,     1,     1,     1,    1,    1,     1,    0]
    ),
    transform: [
      {
        translateX: interpolate(
          travel.value,
          [0.535, 0.55, 0.565, 0.58, 0.595, 0.61, 0.625, 0.64, 0.70, 0.705, 0.72, 0.74, 0.765],
          [-100, width * 0.07, width * 0.16, width * 0.25, width * 0.33, width * 0.39, MU_POSITION - 42, MU_POSITION - 18, MU_POSITION - 18, MU_POSITION - 10, width * 0.58, width * 0.74, width + 100]
        )
      },
      {
        // Keep the cab perfectly level; no initial 5-degree visual drift.
        translateY: interpolate(travel.value, [0.535, 0.765], [0, 0])
      },
      {
        scale: interpolate(travel.value, [0.535, 0.625, 0.765], [0.82, 1, 1])
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
          <View style={styles.cabVisual}>
            <FontAwesome5 name="car-side" size={52} color={COLORS.saffron} solid />
            <Text style={styles.cabLabel}>CAB</Text>
          </View>
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
  animatedCab: { position: "absolute", left: 0, top: 395, zIndex: 7, width: 96, height: 58, alignItems: "center", justifyContent: "center" },
  cabVisual: { width: 96, height: 58, alignItems: "center", justifyContent: "center" },
  cabLabel: { position: "absolute", top: -2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.92)", color: "#1B2745", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
  bottomCard: { padding: 28, paddingBottom: 44 },
  heading: { fontSize: 25, fontWeight: "800", color: COLORS.text, fontFamily: FONT_DISPLAY },
  subheading: { marginTop: 6, color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  googleBtnWrap: { marginTop: 20, minHeight: 44, alignItems: "center", justifyContent: "center" },
  googleBtn: { minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, paddingHorizontal: 18 },
  googleText: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  gLogo: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  emailToggleBtn: { minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  emailToggleText: { color: COLORS.indigo, fontWeight: "800" },
  segmentRow: { flexDirection: "row", backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: 3, marginTop: 18, marginBottom: 14 },
  segment: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.lg },
  segmentActive: { backgroundColor: COLORS.indigo },
  segmentText: { color: COLORS.muted, fontWeight: "800" },
  segmentTextActive: { color: "#fff" },
  input: { minHeight: 50, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, marginTop: 10, color: COLORS.text, backgroundColor: COLORS.surface },
  errorText: { marginTop: 10, color: "#C62828", fontWeight: "700" },
  footerRow: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  fallbackLink: { color: COLORS.indigo, fontWeight: "700", fontSize: 12 },
  signingInText: { marginTop: 6, color: COLORS.muted, fontSize: 12, textAlign: "center" },
});
