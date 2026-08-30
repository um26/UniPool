import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { utilityApi, POLICY_VERSION } from "@/src/api/utility";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { RADIUS, SPACING } from "@/src/theme";

export default function ConsentGate() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [checking, setChecking] = useState(false);
  const [needed, setNeeded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!user) { setNeeded(false); return; }
    setChecking(true); setError(null);
    try {
      const row = await utilityApi.policyConsent();
      const current = row?.terms_version === POLICY_VERSION && row?.privacy_version === POLICY_VERSION;
      setNeeded(!current);
      if (current) setChecked(false);
    } catch (e: any) {
      setNeeded(true);
      setError(e?.message || "Couldn't verify policy consent.");
    } finally { setChecking(false); }
  };

  useEffect(() => { check(); }, [user?.user_id]);
  if (!user || checking || !needed) return null;

  const accept = async () => {
    if (!checked || saving) return;
    setSaving(true); setError(null);
    try { await utilityApi.recordPolicyConsent("post_signin"); setNeeded(false); }
    catch (e: any) { setError(e?.message || "Couldn't save your acceptance."); }
    finally { setSaving(false); }
  };

  return <Modal visible transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={26} color={colors.indigo} /></View>
        <Text style={styles.title}>One quick account check</Text>
        <Text style={styles.sub}>Before continuing, review the current UniPool Terms and Privacy Policy. This is required once per policy version.</Text>
        <View style={styles.links}>
          <Pressable onPress={() => router.push("/terms" as any)}><Text style={styles.link}>Read Terms</Text></Pressable>
          <Pressable onPress={() => router.push("/privacy" as any)}><Text style={styles.link}>Read Privacy Policy</Text></Pressable>
        </View>
        <Pressable onPress={() => setChecked(v => !v)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
          <View style={[styles.box, checked && { backgroundColor: colors.indigo, borderColor: colors.indigo }]}>{checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View>
          <Text style={styles.checkText}>I have read and agree to the Terms & Conditions and Privacy Policy.</Text>
        </Pressable>
        {error ? <View style={styles.errorRow}><Ionicons name="alert-circle-outline" size={16} color={colors.error} /><Text style={styles.error}>{error}</Text><Pressable onPress={check}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
        <Pressable disabled={!checked || saving} onPress={accept} style={[styles.primary, (!checked || saving) && { opacity: .45 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Accept and continue</Text>}
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const makeStyles = (colors: any) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(5,10,20,.68)", alignItems: "center", justifyContent: "center", padding: 22 },
  card: { width: "100%", maxWidth: 520, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 24 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  title: { marginTop: 16, color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 7, color: colors.muted, lineHeight: 21 },
  links: { flexDirection: "row", gap: 18, marginTop: 18 }, link: { color: colors.indigo, fontWeight: "900" },
  checkRow: { marginTop: 22, flexDirection: "row", alignItems: "flex-start", gap: 11 }, box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 1 }, checkText: { flex: 1, color: colors.onSurface2, lineHeight: 20 },
  errorRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 7 }, error: { color: colors.error, flex: 1, fontSize: 12 }, retry: { color: colors.indigo, fontWeight: "900" },
  primary: { marginTop: 22, minHeight: 48, borderRadius: RADIUS.pill, backgroundColor: colors.indigo, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontWeight: "900" },
});
