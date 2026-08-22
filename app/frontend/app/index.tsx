import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, TextInput, KeyboardAvoidingView, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from "react-native-reanimated";

import { useAuth } from "@/src/auth/AuthContext";
import { COLORS, SPACING, RADIUS, FONT, FONT_DISPLAY } from "@/src/theme";
import BrandFooter from "@/src/components/BrandFooter";
import Turnstile from "@/src/components/Turnstile";

const { width } = Dimensions.get("window");

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
    // One deliberately slow airport turnaround: land -> taxi -> park ->
    // passenger handoff -> taxi -> take off. Then the scene loops.
    travel.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && !loading && !user) renderGoogleButton("google-signin-container");
  }, [loading, user, renderGoogleButton]);

  useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  const arrivingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.035, 0.56, 0.63, 0.68], [0, 1, 1, 1, 0]),
    transform: [
      { translateX: interpolate(travel.value, [0, 0.12, 0.28, 0.44, 0.56], [-76, -18, 36, 126, 188]) },
      { translateY: interpolate(travel.value, [0, 0.12, 0.28, 0.44, 0.56], [-58, -20, 7, 10, 10]) },
      { rotate: `${interpolate(travel.value, [0, 0.12, 0.28, 0.44, 0.56], [-16, -6, 0, 0, 0])}deg` },
      { scale: interpolate(travel.value, [0, 0.12, 0.56], [0.88, 1, 1]) },
    ],
  }));

  const departingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.62, 0.68, 0.98, 1], [0, 0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(travel.value, [0.62, 0.72, 0.84, 0.92, 1], [188, 208, width * 0.62, width * 0.82, width + 72]) },
      { translateY: interpolate(travel.value, [0.62, 0.80, 0.90, 1], [10, 10, -8, -74]) },
      { rotate: `${interpolate(travel.value, [0.62, 0.84, 0.92, 1], [0, 0, -7, -14])}deg` },
      { scale: interpolate(travel.value, [0.62, 0.92, 1], [1, 1, 0.82]) },
    ],
  }));

  const submitPasswordForm = async () => {
    setLocalError(null);
    if (!identifier.trim() || !password) { setLocalError("Please fill in all fields."); return; }
    try {
      if (mode === "login") await signInWithPassword(identifier.trim(), password, turnstileToken);
      else {
        if (!name.trim()) { setLocalError("Please enter your name."); return; }
        await signUpWithPassword(identifier.trim(), password, name.trim(), undefined, turnstileToken);
      }
    } catch {} finally {
      setTurnstileResetKey((k) => k + 1);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <LinearGradient colors={[COLORS.indigo, "#2D46B5", "#15213D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Image source={{ uri: "https://images.pexels.com/photos/9693916/pexels-photo-9693916.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }} style={[StyleSheet.absoluteFill, { opacity: 0.045 }]} contentFit="cover" />

      <View style={styles.top}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}><Ionicons name="car-sport" size={25} color={COLORS.saffron} /></View>
          <Text style={styles.logo}>UniPool</Text>
        </View>
        <Text style={styles.tagline}>Share the ride. Split the fare. Save the day.</Text>
      </View>

      <View style={styles.airportScene}>
        <View style={styles.horizonGlow} />
        <View style={[styles.cloud, styles.cloudOne]} />
        <View style={[styles.cloud, styles.cloudTwo]} />

        <View style={styles.muBuilding}>
          <View style={styles.muRoof} />
          <View style={styles.muUpperGlass}><View style={styles.glassColumn} /><View style={styles.glassColumn} /><View style={styles.glassColumn} /></View>
          <View style={styles.muWing}><View style={styles.muWindow} /><View style={styles.muWindow} /><View style={styles.muWindow} /><View style={styles.muWindow} /></View>
          <View style={styles.muWingRight}><View style={styles.muWindow} /><View style={styles.muWindow} /><View style={styles.muWindow} /><View style={styles.muWindow} /></View>
          <View style={styles.muSign}><Text style={styles.muSignTitle}>MU</Text><Text style={styles.muSignSub}>MAHINDRA UNIVERSITY</Text></View>
        </View>

        <View style={styles.controlTower}><View style={styles.towerTop}><Ionicons name="radio" size={11} color={COLORS.saffron} /></View><View style={styles.towerStem} /></View>
        <View style={styles.runway}><View style={styles.runwayCenter} /><View style={styles.runwayEdge} /></View>
        <View style={styles.gate}><View style={styles.gateLight} /><Text style={styles.gateLabel}>A1</Text></View>

        <Animated.View style={[styles.planeIcon, arrivingPlaneStyle]}><Ionicons name="airplane" size={29} color={COLORS.cream} /></Animated.View>
        <Animated.View style={[styles.planeIcon, departingPlaneStyle]}><Ionicons name="airplane" size={29} color={COLORS.cream} /></Animated.View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ maxHeight: "62%" }}>
        <ScrollView contentContainerStyle={styles.bottomCard} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Welcome, traveller</Text>
          <Text style={styles.subheading}>Sign in with your college email to post cab-pool requests and get matched instantly.</Text>

          {!showPasswordForm ? (
            <>
              {Platform.OS === "web" ? (
                <View style={styles.googleBtnWrap}>
                  {loading ? <ActivityIndicator color={COLORS.indigo} /> : signingIn ? (
                    <View style={{ alignItems: "center" }}><ActivityIndicator color={COLORS.indigo} /><Text style={styles.signingInText}>Signing you in… this can take a moment if the server was asleep.</Text></View>
                  ) : (
                    <><View nativeID="google-signin-container" /><Pressable testID="signin-fallback" onPress={signIn} hitSlop={8} style={{ marginTop: SPACING.sm }}><Text style={styles.fallbackLink}>Use Google sign-in</Text></Pressable>{signInError ? <Text testID="signin-error" style={styles.errorText}>{signInError}</Text> : null}</>
                  )}
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
              <View style={styles.segmentRow}>
                <Pressable testID="mode-login" onPress={() => { setMode("login"); setLocalError(null); }} style={[styles.segment, mode === "login" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>Log in</Text></Pressable>
                <Pressable testID="mode-signup" onPress={() => { setMode("signup"); setLocalError(null); }} style={[styles.segment, mode === "signup" && styles.segmentActive]}><Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Sign up</Text></Pressable>
              </View>
              {mode === "signup" && <TextInput testID="signup-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="words" />}
              <TextInput testID="auth-identifier" value={identifier} onChangeText={setIdentifier} placeholder={mode === "login" ? "Email or username" : "Email"} placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="none" keyboardType={mode === "signup" ? "email-address" : "default"} />
              <TextInput testID="auth-password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={COLORS.muted} style={styles.input} secureTextEntry />
              {(localError || signInError) ? <Text testID="password-auth-error" style={styles.errorText}>{localError || signInError}</Text> : null}
              <Turnstile onToken={setTurnstileToken} resetKey={turnstileResetKey} />
              <Pressable testID="password-auth-submit" onPress={submitPasswordForm} disabled={signingIn} style={[styles.primaryButton, signingIn && { opacity: 0.7 }]}>{signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "Log in" : "Create account"}</Text>}</Pressable>
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
  container: { flex: 1, backgroundColor: COLORS.indigo },
  top: { paddingTop: 60, paddingHorizontal: SPACING.xl, alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  logoBadge: { width: 50, height: 50, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,244,222,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,244,222,0.30)", shadowColor: COLORS.saffron, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  logo: { fontSize: 38, fontWeight: "800", color: COLORS.cream, letterSpacing: 0.3, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,244,222,0.84)", marginTop: SPACING.md, fontSize: FONT.lg, textAlign: "center" },
  airportScene: { flex: 1, minHeight: 190, maxHeight: 220, marginTop: 4, position: "relative", overflow: "hidden" },
  horizonGlow: { position: "absolute", left: "16%", right: "14%", top: "24%", height: 80, borderRadius: 80, backgroundColor: "rgba(145,168,255,0.08)" },
  cloud: { position: "absolute", height: 18, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.055)" },
  cloudOne: { width: 90, left: "12%", top: 20 },
  cloudTwo: { width: 120, right: "9%", top: 46 },
  muBuilding: { position: "absolute", left: "54%", bottom: 54, width: 238, height: 96, borderRadius: 6, backgroundColor: "rgba(245,247,251,0.96)", borderWidth: 1, borderColor: "rgba(255,255,255,0.62)", shadowColor: "#081126", shadowOpacity: 0.20, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  muRoof: { position: "absolute", left: -8, right: -8, top: -7, height: 9, borderRadius: 5, backgroundColor: "rgba(246,184,90,0.95)" },
  muUpperGlass: { position: "absolute", left: 78, top: 8, width: 82, height: 42, backgroundColor: "#8FA8D7", borderWidth: 1, borderColor: "rgba(255,255,255,0.65)", flexDirection: "row", justifyContent: "space-evenly", paddingHorizontal: 7 },
  glassColumn: { width: 2, backgroundColor: "rgba(255,255,255,0.56)" },
  muWing: { position: "absolute", left: 8, top: 48, width: 90, height: 35, backgroundColor: "#DDE4F0", flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", paddingHorizontal: 7 },
  muWingRight: { position: "absolute", right: 8, top: 48, width: 90, height: 35, backgroundColor: "#DDE4F0", flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", paddingHorizontal: 7 },
  muWindow: { width: 11, height: 20, borderRadius: 2, backgroundColor: "#9CB3DB", borderWidth: 1, borderColor: "#7E98C4" },
  muSign: { position: "absolute", left: 96, bottom: 4, alignItems: "center" },
  muSignTitle: { fontSize: 13, lineHeight: 14, fontWeight: "900", color: "#243B73", letterSpacing: 1 },
  muSignSub: { fontSize: 5.5, lineHeight: 7, fontWeight: "800", color: "#53627D", letterSpacing: 0.35 },
  controlTower: { position: "absolute", right: 7, bottom: 54, alignItems: "center" },
  towerTop: { width: 27, height: 19, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.88)", alignItems: "center", justifyContent: "center" },
  towerStem: { width: 7, height: 43, backgroundColor: "rgba(255,255,255,0.64)", borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  runway: { position: "absolute", left: -10, right: -10, bottom: 26, height: 30, backgroundColor: "rgba(7,12,20,0.42)" },
  runwayCenter: { position: "absolute", left: 10, right: 10, top: 14, borderTopWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,244,222,0.72)" },
  runwayEdge: { position: "absolute", left: 0, right: 0, bottom: 3, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  gate: { position: "absolute", left: "47%", bottom: 58, alignItems: "center" },
  gateLight: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.saffron, shadowColor: COLORS.saffron, shadowOpacity: 0.75, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } },
  gateLabel: { marginTop: 2, color: "rgba(255,244,222,0.76)", fontSize: 9, fontWeight: "800" },
  planeIcon: { position: "absolute", left: 0, top: "44%", width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  bottomCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: SPACING.xl, paddingBottom: SPACING.xxxl, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  heading: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, marginBottom: SPACING.sm, fontFamily: FONT_DISPLAY, letterSpacing: -0.3 },
  subheading: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.xl, lineHeight: 20 },
  googleBtnWrap: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  fallbackLink: { color: COLORS.muted, fontSize: FONT.sm, textDecorationLine: "underline" },
  signingInText: { color: COLORS.muted, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 300 },
  errorText: { color: COLORS.error, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 360 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginVertical: SPACING.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: "600" },
  emailToggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.indigo, borderRadius: RADIUS.pill, paddingVertical: 14 },
  emailToggleText: { color: COLORS.indigo, fontWeight: "700", fontSize: FONT.base },
  segmentRow: { flexDirection: "row", backgroundColor: COLORS.surface2, borderRadius: RADIUS.pill, padding: 4, marginBottom: SPACING.lg },
  segment: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: "center" },
  segmentActive: { backgroundColor: COLORS.indigo },
  segmentText: { fontWeight: "700", color: COLORS.muted, fontSize: FONT.sm },
  segmentTextActive: { color: "#fff" },
  input: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.base, color: COLORS.onSurface, marginBottom: SPACING.md },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.pill, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.border },
  primaryButton: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.indigo, borderRadius: RADIUS.pill, paddingVertical: 16, marginTop: SPACING.md },
  primaryButtonText: { color: COLORS.onIndigo, fontSize: FONT.lg, fontWeight: "800" },
  gLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  googleText: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface },
  footerRow: { marginTop: SPACING.lg, flexDirection: "row", alignItems: "center", gap: SPACING.sm, justifyContent: "center" },
  footerText: { color: COLORS.muted, fontSize: FONT.sm },
});
