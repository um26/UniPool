import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { POLICY_VERSION, utilityApi } from "@/src/api/utility";
import { useAuth } from "@/src/auth/AuthContext";
import { storage } from "@/src/utils/storage";
import { RADIUS, SPACING, FONT_DISPLAY } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";

const CONSENT_KEY_PREFIX = "unipool.policy-consent.v1";

export default function PolicyConsentGate({ children, bypass = false }: { children: React.ReactNode; bypass?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [checking, setChecking] = useState(!bypass);
  const [accepted, setAccepted] = useState(bypass);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localKey = useMemo(
    () => user?.user_id ? `${CONSENT_KEY_PREFIX}.${user.user_id}.${POLICY_VERSION}` : null,
    [user?.user_id],
  );

  const rememberLocalConsent = useCallback(async () => {
    if (!localKey) return;
    await storage.secureSet(localKey, JSON.stringify({ policy_version: POLICY_VERSION, accepted_at: new Date().toISOString() }));
  }, [localKey]);

  const syncConsentInBackground = useCallback(() => {
    utilityApi.policyConsent()
      .then((state) => state?.accepted ? null : utilityApi.recordPolicyConsent("account-gate-sync"))
      .catch(() => null);
  }, []);

  const check = useCallback(async () => {
    if (bypass) { setAccepted(true); setChecking(false); return; }
    setChecking(true); setError(null);
    try {
      const locallyAccepted = localKey ? await storage.secureGet(localKey, null) : null;
      if (locallyAccepted) {
        setAccepted(true);
        syncConsentInBackground();
        return;
      }

      const state = await utilityApi.policyConsent();
      const isAccepted = Boolean(state?.accepted);
      if (isAccepted) await rememberLocalConsent();
      setAccepted(isAccepted);
    } catch (e: any) {
      setError(e?.message || "Couldn't verify your privacy choices.");
    } finally { setChecking(false); }
  }, [bypass, localKey, rememberLocalConsent, syncConsentInBackground]);

  useEffect(() => { check(); }, [check]);

  const accept = async () => {
    setSaving(true); setError(null);
    try {
      await rememberLocalConsent();
      setAccepted(true);
      utilityApi.recordPolicyConsent("account-gate").catch(() => null);
    } finally { setSaving(false); }
  };

  if (bypass || accepted) return <>{children}</>;
  if (checking) return <View style={styles.screen}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Checking account preferences…</Text></View>;

  return <View style={styles.screen}>
    <View style={styles.card}>
      <View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={28} color={colors.indigo} /></View>
      <Text style={styles.eyebrow}>ONE-TIME ACCOUNT CHECK</Text>
      <Text style={styles.title}>Before you continue</Text>
      <Text style={styles.body}>UniPool coordinates student travel, chats and shared expenses. Please review and accept the current Terms and Privacy Policy before using your account.</Text>
      <View style={styles.links}>
        <Pressable onPress={() => router.push("/terms" as any)} style={styles.link}><Text style={styles.linkText}>Read Terms</Text><Ionicons name="open-outline" size={15} color={colors.indigo} /></Pressable>
        <Pressable onPress={() => router.push("/privacy" as any)} style={styles.link}><Text style={styles.linkText}>Read Privacy</Text><Ionicons name="open-outline" size={15} color={colors.indigo} /></Pressable>
      </View>
      {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={16} color={colors.error} /><Text style={styles.errorText}>{error}</Text><Pressable onPress={check}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
      <Pressable disabled={saving} onPress={accept} style={[styles.accept, saving && { opacity: .65 }]}>{saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.acceptText}>I agree and continue</Text></>}</Pressable>
      <Text style={styles.fine}>Your acceptance is versioned for this account and synced to UniPool. You can revisit these documents from Settings at any time.</Text>
    </View>
  </View>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  card: { width: "100%", maxWidth: 520, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.xl, padding: 28 },
  icon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  eyebrow: { color: colors.saffron, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: "900", marginTop: 5 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18 },
  link: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", gap: 6 },
  linkText: { color: colors.indigo, fontWeight: "900", fontSize: 11 },
  error: { marginTop: 16, padding: 11, borderRadius: RADIUS.md, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", gap: 7 },
  errorText: { color: colors.error, flex: 1, fontSize: 11 }, retry: { color: colors.indigo, fontWeight: "900", fontSize: 11 },
  accept: { minHeight: 48, borderRadius: 24, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, marginTop: 18 },
  acceptText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  fine: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: "center", marginTop: 11 },
  muted: { color: colors.muted, marginTop: 10, fontSize: 11 },
});