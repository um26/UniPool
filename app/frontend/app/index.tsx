import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, TextInput, KeyboardAvoidingView, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from "react-native-reanimated";

import { useAuth } from "@/src/auth/AuthContext";
import { utilityApi } from "@/src/api/utility";
import { COLORS, SPACING, RADIUS, FONT_DISPLAY } from "@/src/theme";
import BrandFooter from "@/src/components/BrandFooter";
import Turnstile from "@/src/components/Turnstile";

const { width } = Dimensions.get("window");
const HERO_URL = "https://raw.githubusercontent.com/um26/UniPool/5b90d0fd059122e21621eb2f5648da2fa64f0505/app/frontend/assets/mu-airport-hero.svg";
const MU_POSITION = width * 0.50;

const AUTH_COLORS = {
  text: "#F7F9FF",
  muted: "#AEBBD0",
  blue: "#8FB1FF",
  blueStrong: "#AFC6FF",
  border: "rgba(255,255,255,0.24)",
  borderStrong: "rgba(143,177,255,0.55)",
  surface: "rgba(255,255,255,0.07)",
  error: "#FF8591",
};

export default function LoginScreen() {
  const {
    user, loading, signingIn, signInError, clearSignInError, signIn, renderGoogleButton,
    signInWithPassword, signUpWithPassword,
  } = useAuth();
  const router = useRouter();
  const travel = useSharedValue(0);

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    travel.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false);
  }, []);
  useEffect(() => {
    if (Platform.OS === "web" && !loading && !user) renderGoogleButton("google-signin-container");
  }, [loading, user, renderGoogleButton]);
  useEffect(() => { if (user) router.replace("/(tabs)"); }, [user]);

  const arrivingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0.00,0.08,0.18,0.28,0.42,0.52,0.72,0.80,0.82], [0,0,1,1,1,1,1,1,0]),
    transform: [
      { translateX: interpolate(travel.value, [0.08,0.18,0.28,0.40,0.52,0.62,0.72,0.80,0.82], [-140,-80,width*0.05,width*0.30,MU_POSITION,width*0.62,width*0.80,width*0.96,width*1.02]) },
      { translateY: interpolate(travel.value, [0.08,0.18,0.28,0.40,0.52,0.62,0.72,0.80,0.82], [-110,-90,-60,-25,0,0,0,0,0]) },
      { rotate: `${interpolate(travel.value, [0.08,0.18,0.28,0.40,0.52,0.62,0.72,0.80,0.82], [-18,-14,-8,-3,0,0,0,0,0])}deg` },
      { scale: interpolate(travel.value, [0.08,0.52], [0.60,1]) },
    ],
  }));
  const departingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0.75,0.77,0.80,0.88,0.96,1.00], [0,1,1,1,1,0]),
    transform: [
      { translateX: interpolate(travel.value, [0.75,0.77,0.80,0.84,0.88,0.92,0.96,1.00], [-100,-20,width*0.03,width*0.25,width*0.40,MU_POSITION,width*0.72,width+100]) },
      { translateY: interpolate(travel.value, [0.75,0.84,0.88,0.92,0.96,1.00], [0,0,0,-35,-100,-180]) },
      { rotate: `${interpolate(travel.value, [0.75,0.88,0.92,0.96,1.00], [0,0,-7,-14,-20])}deg` },
      { scale: interpolate(travel.value, [0.75,0.96,1.00], [1,0.9,0.65]) },
    ],
  }));

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setLocalError(null);
    clearSignInError();
    if (next === "login") setLegalAccepted(false);
  };

  const submitPasswordForm = async () => {
    setLocalError(null);
    clearSignInError();
    if (!identifier.trim() || !password) return setLocalError("Please fill in all fields.");
    if (mode === "signup" && !name.trim()) return setLocalError("Please enter your name.");
    if (mode === "signup" && !legalAccepted) return setLocalError("Please accept the Terms and Privacy Policy to create your account.");

    try {
      if (mode === "login") {
        await signInWithPassword(identifier.trim(), password, turnstileToken);
      } else {
        await signUpWithPassword(identifier.trim(), password, name.trim(), undefined, turnstileToken);
        await utilityApi.recordPolicyConsent("email-signup").catch(() => {});
      }
    } catch {
      // AuthContext exposes the server-safe error text.
    } finally {
      setTurnstileResetKey((k) => k + 1);
    }
  };

  return <View style={styles.container} testID="login-screen">
    <View style={styles.hero}>
      <Image source={{ uri: HERO_URL }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.heroShade} />
      <View style={styles.brandOverlay}>
        <View style={styles.logoRow}><View style={styles.logoBadge}><Ionicons name="car-sport" size={25} color={COLORS.saffron} /></View><Text style={styles.logo}>UniPool</Text></View>
        <Text style={styles.tagline}>Share the ride. Split the fare. <Text style={styles.taglineAccent}>Save the day.</Text></Text>
      </View>
      <Animated.View style={[styles.animatedPlane, arrivingPlaneStyle]}><Ionicons name="airplane" size={40} color="#fff" /></Animated.View>
      <Animated.View style={[styles.animatedPlane, departingPlaneStyle]}><Ionicons name="airplane" size={40} color="#fff" /></Animated.View>
    </View>

    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ maxHeight: "62%" }}>
      <ScrollView contentContainerStyle={styles.bottomCard} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{mode === "signup" ? "Create your UniPool account" : "Welcome back"}</Text>
        <Text style={styles.subheading}>
          {mode === "signup"
            ? "Sign up with any email address. Google is optional if you prefer it."
            : "Log in with your UniPool email or username, or continue with Google."}
        </Text>

        <View style={styles.segmentRow}>
          <Pressable testID="mode-signup" onPress={() => switchMode("signup")} style={[styles.segment, mode === "signup" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Sign up</Text></Pressable>
          <Pressable testID="mode-login" onPress={() => switchMode("login")} style={[styles.segment, mode === "login" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>Log in</Text></Pressable>
        </View>

        {mode === "signup" && <TextInput testID="signup-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={AUTH_COLORS.muted} style={styles.input} autoCapitalize="words" />}
        <TextInput testID="auth-identifier" value={identifier} onChangeText={(value) => { setIdentifier(value); setLocalError(null); clearSignInError(); }} placeholder={mode === "login" ? "Email or username" : "Email address"} placeholderTextColor={AUTH_COLORS.muted} style={styles.input} autoCapitalize="none" keyboardType={mode === "signup" ? "email-address" : "default"} />
        <TextInput testID="auth-password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={AUTH_COLORS.muted} style={styles.input} secureTextEntry />

        {mode === "signup" ? <Pressable testID="signup-legal-consent" onPress={() => setLegalAccepted((v) => !v)} style={styles.consentRow}><View style={[styles.checkbox, legalAccepted && styles.checkboxOn]}>{legalAccepted ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View><Text style={styles.consentText}>I agree to the <Text style={styles.inlineLink} onPress={(e) => { e.stopPropagation?.(); router.push("/terms" as any); }}>Terms & Conditions</Text> and <Text style={styles.inlineLink} onPress={(e) => { e.stopPropagation?.(); router.push("/privacy" as any); }}>Privacy Policy</Text>.</Text></Pressable> : null}
        {(localError || signInError) ? <Text testID="password-auth-error" style={styles.errorText}>{localError || signInError}</Text> : null}
        <Turnstile onToken={setTurnstileToken} resetKey={turnstileResetKey} />
        <Pressable testID="password-auth-submit" onPress={submitPasswordForm} disabled={signingIn} style={[styles.googleBtn, styles.primaryBtn, signingIn && styles.disabled]}>
          {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={[styles.googleText, { color: "#fff" }]}>{mode === "signup" ? "Create account" : "Log in"}</Text>}
        </Pressable>

        <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or continue with Google</Text><View style={styles.dividerLine} /></View>
        {Platform.OS === "web" ? <View style={styles.googleBtnWrap}>
          {loading ? <ActivityIndicator color={AUTH_COLORS.blue} /> : signingIn ? <View style={{ alignItems: "center" }}><ActivityIndicator color={AUTH_COLORS.blue} /><Text style={styles.signingInText}>Signing you in… this can take longer if the travel server was asleep.</Text></View> : <><View nativeID="google-signin-container" /><Pressable testID="signin-fallback" onPress={signIn} hitSlop={8} style={{ marginTop: SPACING.sm }}><Text style={styles.fallbackLink}>Google button not showing? Tap here</Text></Pressable></>}
        </View> : <Pressable testID="google-signin-button" onPress={signIn} disabled={loading} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: .85 }]}>
          {loading ? <ActivityIndicator color={AUTH_COLORS.blue} /> : <><View style={styles.gLogo}><Text style={{ fontWeight: "800", color: "#4285F4", fontSize: 18 }}>G</Text></View><Text style={styles.googleText}>Continue with Google</Text></>}
        </Pressable>}
        <Text style={styles.googleLegal}>Google is optional. A regular UniPool account can be created with any valid email address.</Text>

        <View style={styles.footerRow}><Ionicons name="shield-checkmark" size={14} color={AUTH_COLORS.muted} /><Text style={styles.footerText}>Safe rides. Real people. Clear shared-money records.</Text></View>
        <BrandFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071735" },
  hero: { height: 440, position: "relative", overflow: "hidden" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(19,48,119,0.02)" },
  brandOverlay: { position: "absolute", top: 34, left: 48, zIndex: 5 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(7,23,53,0.26)", borderWidth: 1.2, borderColor: "rgba(255,211,107,0.7)", alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: .2, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,255,255,0.94)", marginTop: 10, fontSize: 16, fontWeight: "600" },
  taglineAccent: { color: COLORS.saffron },
  animatedPlane: { position: "absolute", left: 0, top: 365, zIndex: 8, width: 52, height: 42, alignItems: "center", justifyContent: "center" },
  bottomCard: { padding: 28, paddingBottom: 44, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(7,23,53,0.96)" },
  heading: { fontSize: 25, fontWeight: "800", color: AUTH_COLORS.text, fontFamily: FONT_DISPLAY },
  subheading: { marginTop: 6, color: AUTH_COLORS.muted, fontSize: 15, lineHeight: 22 },
  googleBtnWrap: { marginTop: 4, minHeight: 44, alignItems: "center", justifyContent: "center" },
  googleBtn: { minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: AUTH_COLORS.border, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, paddingHorizontal: 18 },
  primaryBtn: { backgroundColor: "#315CCB", marginTop: SPACING.md, borderColor: AUTH_COLORS.blue },
  disabled: { opacity: .6 },
  googleText: { fontSize: 15, fontWeight: "700", color: "#18202A" },
  gLogo: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  googleLegal: { color: AUTH_COLORS.muted, fontSize: 10, textAlign: "center", marginTop: 10, lineHeight: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: AUTH_COLORS.border },
  dividerText: { color: AUTH_COLORS.muted, fontSize: 11, fontWeight: "800" },
  segmentRow: { flexDirection: "row", backgroundColor: AUTH_COLORS.surface, borderRadius: RADIUS.lg, padding: 3, marginTop: 18, marginBottom: 14, borderWidth: 1, borderColor: AUTH_COLORS.border },
  segment: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.lg },
  segmentActive: { backgroundColor: "#315CCB" },
  segmentText: { color: AUTH_COLORS.muted, fontWeight: "800" },
  segmentTextActive: { color: "#fff" },
  input: { minHeight: 50, borderRadius: RADIUS.md, borderWidth: 1, borderColor: AUTH_COLORS.border, paddingHorizontal: 14, marginTop: 10, color: AUTH_COLORS.text, backgroundColor: AUTH_COLORS.surface },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 13, paddingVertical: 5 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: AUTH_COLORS.borderStrong, backgroundColor: AUTH_COLORS.surface, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#315CCB", borderColor: AUTH_COLORS.blue },
  consentText: { flex: 1, color: AUTH_COLORS.muted, fontSize: 11, lineHeight: 17 },
  inlineLink: { color: AUTH_COLORS.blueStrong, fontWeight: "800" },
  errorText: { marginTop: 10, color: AUTH_COLORS.error, fontWeight: "700", textAlign: "center" },
  footerRow: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { color: AUTH_COLORS.muted, fontSize: 12, fontWeight: "600" },
  fallbackLink: { color: AUTH_COLORS.blueStrong, fontWeight: "800", fontSize: 12 },
  signingInText: { marginTop: 6, color: AUTH_COLORS.muted, fontSize: 12, textAlign: "center" },
});