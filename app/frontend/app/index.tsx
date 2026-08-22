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
const airportHero = require("../assets/mu-airport-hero.svg");

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

  useEffect(() => { travel.value = withRepeat(withTiming(1, { duration: 15000, easing: Easing.linear }), -1, false); }, []);
  useEffect(() => { if (Platform.OS === "web" && !loading && !user) renderGoogleButton("google-signin-container"); }, [loading, user, renderGoogleButton]);
  useEffect(() => { if (user) router.replace("/(tabs)"); }, [user]);

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
        <Image source={airportHero} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.heroShade} />
        <View style={styles.brandOverlay}>
          <View style={styles.logoRow}><View style={styles.logoBadge}><Ionicons name="car-sport" size={25} color={COLORS.saffron} /></View><Text style={styles.logo}>UniPool</Text></View>
          <Text style={styles.tagline}>Share the ride. Split the fare. <Text style={styles.taglineAccent}>Save the day.</Text></Text>
        </View>
        <Animated.View style={[styles.animatedPlane, arrivingPlaneStyle]}><Ionicons name="airplane" size={38} color="#fff" /></Animated.View>
        <Animated.View style={[styles.animatedPlane, departingPlaneStyle]}><Ionicons name="airplane" size={38} color="#fff" /></Animated.View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.formArea}>
        <ScrollView contentContainerStyle={styles.card} keyboardShouldPersistTaps="handled">
          <View style={styles.cardHeader}>
            <View><Text style={styles.heading}>Welcome, traveller</Text><Text style={styles.subheading}>Sign in with your college email to post cab-pool requests and get matched instantly.</Text></View>
            {showPasswordForm && <View style={styles.segmentRow}><Pressable testID="mode-login" onPress={() => { setMode("login"); setLocalError(null); }} style={[styles.segment, mode === "login" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>Log in</Text></Pressable><Pressable testID="mode-signup" onPress={() => { setMode("signup"); setLocalError(null); }} style={[styles.segment, mode === "signup" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Sign up</Text></Pressable></View>}
          </View>

          {!showPasswordForm ? <>
            {Platform.OS === "web" ? <View style={styles.googleArea}>{loading ? <ActivityIndicator color={COLORS.indigo} /> : signingIn ? <View style={{ alignItems: "center" }}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.signingInText}>Signing you in…</Text></View> : <><View nativeID="google-signin-container" /><Pressable testID="signin-fallback" onPress={signIn} style={styles.fallback}><Text style={styles.fallbackLink}>Use Google sign-in</Text></Pressable>{signInError ? <Text testID="signin-error" style={styles.errorText}>{signInError}</Text> : null}</>}</View> : <Pressable testID="google-signin-button" onPress={signIn} disabled={loading} style={styles.googleBtn}>{loading ? <ActivityIndicator color={COLORS.indigo} /> : <><Text style={styles.gLogo}>G</Text><Text style={styles.googleText}>Continue with Google</Text></>}</Pressable>}
            <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
            <Pressable testID="show-password-form" onPress={() => { setLocalError(null); setShowPasswordForm(true); }} style={styles.emailToggleBtn}><Ionicons name="mail-outline" size={18} color={COLORS.indigo} /><Text style={styles.emailToggleText}>Continue with email &amp; password</Text></Pressable>
          </> : <View>
            {mode === "signup" && <TextInput testID="signup-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="words" />}
            <TextInput testID="auth-identifier" value={identifier} onChangeText={setIdentifier} placeholder={mode === "login" ? "Email or username" : "Email"} placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" keyboardType={mode === "signup" ? "email-address" : "default"} />
            <TextInput testID="auth-password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={COLORS.muted} style={styles.input} secureTextEntry />
            {(localError || signInError) ? <Text testID="password-auth-error" style={styles.errorText}>{localError || signInError}</Text> : null}
            <Turnstile onToken={setTurnstileToken} resetKey={turnstileResetKey} />
            <Pressable testID="password-auth-submit" onPress={submitPasswordForm} disabled={signingIn} style={[styles.primaryButton, signingIn && { opacity: 0.7 }]}>{signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "Log in" : "Create account"}</Text>}</Pressable>
            <Pressable testID="back-to-google" onPress={() => { setShowPasswordForm(false); setLocalError(null); }} style={styles.fallback}><Text style={styles.fallbackLink}>Back to Google sign-in</Text></Pressable>
          </View>}

          <View style={styles.trustRow}><Ionicons name="shield-checkmark" size={15} color={COLORS.muted} /><Text style={styles.footerText}>Safe rides. Real people. Verified emails.</Text></View><BrandFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071735" },
  hero: { height: 440, position: "relative", overflow: "hidden" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(19,48,119,0.04)" },
  brandOverlay: { position: "absolute", top: 34, left: 48, zIndex: 5 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(7,23,53,0.26)", borderWidth: 1.2, borderColor: "rgba(255,211,107,0.7)", alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: 0.2, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,255,255,0.94)", marginTop: 10, fontSize: 16, fontWeight: "600" },
  taglineAccent: { color: COLORS.saffron },
  animatedPlane: { position: "absolute", left: 0, top: 365, zIndex: 8, width: 48, height: 40, alignItems: "center", justifyContent: "center" },
  formArea: { maxHeight: "58%", marginTop: -2 },
  card: { backgroundColor: "#fbfcfe", borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 48, paddingTop: 30, paddingBottom: 24, minHeight: 390, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 20 },
  heading: { fontSize: 27, fontWeight: "800", color: "#1d273a", fontFamily: FONT_DISPLAY },
  subheading: { color: "#66738b", fontSize: 15, marginTop: 6, maxWidth: 760 },
  segmentRow: { flexDirection: "row", backgroundColor: "#f1f3f7", borderRadius: 12, padding: 3, minWidth: 300, alignSelf: "flex-start" },
  segment: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: "center" },
  segmentActive: { backgroundColor: COLORS.indigo },
  segmentText: { color: "#66738b", fontWeight: "700" },
  segmentTextActive: { color: "#fff" },
  googleArea: { alignItems: "center", minHeight: 52, justifyContent: "center" },
  googleBtn: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#d9dee8", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  gLogo: { fontSize: 19, fontWeight: "900", color: "#4285F4" },
  googleText: { color: "#263248", fontWeight: "700", fontSize: 15 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e4e7ed" },
  dividerText: { color: "#8a95a7", fontSize: 13 },
  emailToggleBtn: { height: 52, borderRadius: 12, backgroundColor: "#f1f4ff", borderWidth: 1, borderColor: "#dce4ff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  emailToggleText: { color: COLORS.indigo, fontWeight: "800", fontSize: 15 },
  input: { height: 54, borderRadius: 12, borderWidth: 1, borderColor: "#dce1e9", backgroundColor: "#fff", paddingHorizontal: 16, color: "#1d273a", marginBottom: 12, fontSize: 15 },
  primaryButton: { height: 54, borderRadius: 13, backgroundColor: COLORS.indigo, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 20 },
  footerText: { color: "#7d8797", fontSize: 12 },
  fallback: { alignItems: "center", marginTop: 10 },
  fallbackLink: { color: COLORS.indigo, fontWeight: "700", fontSize: 13 },
  signingInText: { color: "#69758a", fontSize: 12, marginTop: 7 },
  errorText: { color: "#c53b4b", textAlign: "center", marginTop: 8, fontSize: 13 },
});
