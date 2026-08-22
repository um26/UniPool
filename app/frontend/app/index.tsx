import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, TextInput, KeyboardAvoidingView, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withDelay, interpolate } from "react-native-reanimated";

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
    travel.value = withRepeat(
      withDelay(500, withTiming(1, { duration: 9000, easing: Easing.linear })),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && !loading && !user) {
      renderGoogleButton("google-signin-container");
    }
  }, [loading, user, renderGoogleButton]);

  useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  // The animation is intentionally staged like a tiny airport turnaround:
  // inbound aircraft descends onto the runway, taxis to the stand, then the
  // outbound aircraft departs from that same stand and takes off.
  const arrivingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.04, 0.72, 0.76], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(travel.value, [0, 0.24, 0.48, 0.72], [-100, -15, 42, 88]) },
      { translateY: interpolate(travel.value, [0, 0.24, 0.48, 0.72], [-46, -8, 12, 12]) },
      { rotate: `${interpolate(travel.value, [0, 0.24, 0.48, 0.72], [-12, -4, 0, 0])}deg` },
    ],
  }));

  const departingPlaneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, 0.48, 0.54, 0.76, 1], [0, 0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(travel.value, [0.48, 0.65, 0.82, 1], [88, 150, width * 0.58, width + 110]) },
      { translateY: interpolate(travel.value, [0.48, 0.7, 0.84, 1], [12, 12, -12, -64]) },
      { rotate: `${interpolate(travel.value, [0.48, 0.7, 0.84, 1], [0, 0, -8, -13])}deg` },
    ],
  }));

  const submitPasswordForm = async () => {
    setLocalError(null);
    if (!identifier.trim() || !password) {
      setLocalError("Please fill in all fields.");
      return;
    }
    try {
      if (mode === "login") {
        await signInWithPassword(identifier.trim(), password, turnstileToken);
      } else {
        if (!name.trim()) { setLocalError("Please enter your name."); return; }
        await signUpWithPassword(identifier.trim(), password, name.trim(), undefined, turnstileToken);
      }
    } catch {
      // signInError from context already surfaces the message
    } finally {
      setTurnstileResetKey((k) => k + 1);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <LinearGradient
        colors={[COLORS.indigo, "#263B9A", "#172033"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={{ uri: "https://images.pexels.com/photos/9693916/pexels-photo-9693916.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
        style={[StyleSheet.absoluteFill, { opacity: 0.055 }]}
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

      {/* Mini airport scene: terminal + runway + a staged plane turnaround. */}
      <View style={styles.airportScene}>
        <View style={styles.horizonGlow} />
        <View style={styles.airportTerminal}>
          <View style={styles.terminalRoof} />
          <View style={styles.terminalWindows}>
            <View style={styles.window} /><View style={styles.window} /><View style={styles.window} /><View style={styles.window} />
          </View>
          <View style={styles.terminalSign}><Ionicons name="airplane" size={11} color={COLORS.onSurface} /><Text style={styles.terminalSignText}>UNI</Text></View>
        </View>
        <View style={styles.controlTower}>
          <View style={styles.towerTop}><Ionicons name="radio" size={12} color={COLORS.saffron} /></View>
          <View style={styles.towerStem} />
        </View>
        <View style={styles.runway}>
          <View style={styles.runwayLine} />
          <View style={styles.runwayEdge} />
        </View>
        <View style={styles.gate}>
          <View style={styles.gateLight} /><Text style={styles.gateLabel}>A1</Text>
        </View>
        <Animated.View style={[styles.planeIcon, arrivingPlaneStyle]}>
          <Ionicons name="airplane" size={30} color={COLORS.cream} />
        </Animated.View>
        <Animated.View style={[styles.planeIcon, departingPlaneStyle]}>
          <Ionicons name="airplane" size={30} color={COLORS.cream} />
        </Animated.View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ maxHeight: "62%" }}>
        <ScrollView contentContainerStyle={styles.bottomCard} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Welcome, traveller</Text>
          <Text style={styles.subheading}>
            Sign in with your college email to post cab-pool requests and get matched instantly.
          </Text>

          {!showPasswordForm ? (
            <>
              {Platform.OS === "web" ? (
                <View style={styles.googleBtnWrap}>
                  {loading ? (
                    <ActivityIndicator color={COLORS.indigo} />
                  ) : signingIn ? (
                    <View style={{ alignItems: "center" }}>
                      <ActivityIndicator color={COLORS.indigo} />
                      <Text style={styles.signingInText}>Signing you in… this can take up to a minute if the server was asleep.</Text>
                    </View>
                  ) : (
                    <>
                      <View nativeID="google-signin-container" />
                      <Pressable testID="signin-fallback" onPress={signIn} hitSlop={8} style={{ marginTop: SPACING.sm }}>
                        <Text style={styles.fallbackLink}>Button not showing? Tap here</Text>
                      </Pressable>
                      {signInError ? <Text testID="signin-error" style={styles.errorText}>{signInError}</Text> : null}
                    </>
                  )}
                </View>
              ) : (
                <Pressable testID="google-signin-button" onPress={signIn} disabled={loading} style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}>
                  {loading ? <ActivityIndicator color={COLORS.indigo} /> : <><View style={styles.gLogo}><Text style={{ fontWeight: "800", color: "#4285F4", fontSize: 18 }}>G</Text></View><Text style={styles.googleText}>Continue with Google</Text></>}
                </Pressable>
              )}

              <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>

              <Pressable testID="show-password-form" onPress={() => { setLocalError(null); setShowPasswordForm(true); }} style={styles.emailToggleBtn}>
                <Ionicons name="mail-outline" size={18} color={COLORS.indigo} />
                <Text style={styles.emailToggleText}>Continue with email &amp; password</Text>
              </Pressable>
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

              <Pressable testID="password-auth-submit" onPress={submitPasswordForm} disabled={signingIn} style={[styles.googleBtn, styles.primaryButton, signingIn && { opacity: 0.7 }]}>
                {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{mode === "login" ? "Log in" : "Create account"}</Text>}
              </Pressable>

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
  top: { paddingTop: 72, paddingHorizontal: SPACING.xl, alignItems: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  logoBadge: { width: 50, height: 50, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,244,222,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,244,222,0.32)", shadowColor: COLORS.saffron, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  logo: { fontSize: 38, fontWeight: "800", color: COLORS.cream, letterSpacing: 0.3, fontFamily: FONT_DISPLAY },
  tagline: { color: "rgba(255,244,222,0.86)", marginTop: SPACING.md, fontSize: FONT.lg, textAlign: "center" },

  airportScene: { flex: 1, minHeight: 170, maxHeight: 210, marginTop: 4, position: "relative", overflow: "hidden" },
  horizonGlow: { position: "absolute", left: "14%", right: "12%", top: "34%", height: 80, borderRadius: 80, backgroundColor: "rgba(142,162,255,0.10)" },
  airportTerminal: { position: "absolute", left: 28, bottom: 54, width: 118, height: 68, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: "rgba(255,255,255,0.90)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  terminalRoof: { position: "absolute", left: -8, right: -8, top: -8, height: 12, borderRadius: 6, backgroundColor: "rgba(246,184,90,0.95)" },
  terminalWindows: { position: "absolute", left: 10, right: 10, top: 25, flexDirection: "row", justifyContent: "space-between" },
  window: { width: 17, height: 24, borderRadius: 4, backgroundColor: "#C8D7F5", borderWidth: 1, borderColor: "#AABBE0" },
  terminalSign: { position: "absolute", bottom: 7, left: 39, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF1F5", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  terminalSignText: { fontSize: 9, fontWeight: "900", color: COLORS.onSurface, letterSpacing: 1 },
  controlTower: { position: "absolute", right: 52, bottom: 54, alignItems: "center" },
  towerTop: { width: 27, height: 19, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  towerStem: { width: 7, height: 43, backgroundColor: "rgba(255,255,255,0.72)", borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  runway: { position: "absolute", left: 0, right: 0, bottom: 28, height: 28, backgroundColor: "rgba(7,12,20,0.38)", transform: [{ skewX: "-8deg" }] },
  runwayLine: { position: "absolute", left: 12, right: 12, top: 13, borderTopWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,244,222,0.70)" },
  runwayEdge: { position: "absolute", left: 0, right: 0, bottom: 3, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  gate: { position: "absolute", left: "43%", bottom: 58, alignItems: "center" },
  gateLight: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.saffron, shadowColor: COLORS.saffron, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  gateLabel: { marginTop: 2, color: "rgba(255,244,222,0.75)", fontSize: 9, fontWeight: "800" },
  planeIcon: { position: "absolute", left: 0, top: "42%", width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  bottomCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: SPACING.xl, paddingBottom: SPACING.xxxl, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  heading: { fontSize: FONT["2xl"], fontWeight: "800", color: COLORS.onSurface, marginBottom: SPACING.sm, fontFamily: FONT_DISPLAY, letterSpacing: -0.3 },
  subheading: { fontSize: FONT.base, color: COLORS.muted, marginBottom: SPACING.xl, lineHeight: 20 },
  googleBtnWrap: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  fallbackLink: { color: COLORS.muted, fontSize: FONT.sm, textDecorationLine: "underline" },
  signingInText: { color: COLORS.muted, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 260 },
  errorText: { color: COLORS.error, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center", maxWidth: 280 },
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
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.pill, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryButton: { backgroundColor: COLORS.indigo, marginTop: SPACING.md },
  primaryButtonText: { color: COLORS.onIndigo, fontSize: FONT.lg, fontWeight: "800" },
  gLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  googleText: { fontSize: FONT.lg, fontWeight: "700", color: COLORS.onSurface },
  footerRow: { marginTop: SPACING.lg, flexDirection: "row", alignItems: "center", gap: SPACING.sm, justifyContent: "center" },
  footerText: { color: COLORS.muted, fontSize: FONT.sm },
});
