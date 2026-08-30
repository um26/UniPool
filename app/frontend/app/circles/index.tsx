import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { circlesApi } from "@/src/api/circles";
import { storage } from "@/src/utils/storage";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { RADIUS, SPACING, FONT_DISPLAY } from "@/src/theme";

const BUDGET_KEY = "unipool.circles.monthly_budget.v1";
const money = (paise = 0) => `₹${(Math.abs(Number(paise || 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

type Circle = { group_id: string; name: string; emoji?: string; my_balance_paise?: number; member_count?: number; expense_count?: number; invite_code?: string };

export default function CirclesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [groups, setGroups] = useState<Circle[]>([]);
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState(0);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetText, setBudgetText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g, savedBudget] = await Promise.all([circlesApi.dashboard(), circlesApi.list(), storage.secureGet(BUDGET_KEY, "0")]);
      setDashboard(d); setGroups(g || []); setBudget(Number(savedBudget || 0));
    } catch (e: any) { Alert.alert("Couldn't load Circles", e.message || "Try again"); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createCircle = async () => {
    if (name.trim().length < 2) return Alert.alert("Name your Circle", "Use at least 2 characters.");
    setSaving(true);
    try { const result = await circlesApi.create({ name: name.trim(), member_ids: [], emoji: "💸" }); setMode("none"); setName(""); router.push(`/circles/${result.group.group_id}` as any); }
    catch (e: any) { Alert.alert("Couldn't create Circle", e.message); }
    finally { setSaving(false); }
  };
  const joinCircle = async () => {
    if (!invite.trim()) return;
    setSaving(true);
    try { const result = await circlesApi.join(invite.trim()); setInvite(""); setMode("none"); router.push(`/circles/${result.group.group_id}` as any); }
    catch (e: any) { Alert.alert("Couldn't join", e.message); }
    finally { setSaving(false); }
  };
  const saveBudget = async () => {
    const rupees = Number(budgetText || 0);
    if (!Number.isFinite(rupees) || rupees < 0) return Alert.alert("Check budget", "Enter a valid monthly amount.");
    const paise = Math.round(rupees * 100); setBudget(paise); await storage.secureSet(BUDGET_KEY, String(paise)); setEditingBudget(false);
  };

  const spent = Number(dashboard?.spent_paise || 0);
  const owe = Number(dashboard?.owe_paise || 0);
  const owed = Number(dashboard?.owed_to_me_paise || 0);
  const spendable = Math.max(0, budget - spent);

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>MONEY · CIRCLES</Text><Text style={styles.title}>College money, without the chaos</Text><Text style={styles.sub}>Track shared expenses, settle friends and simplify a whole group without changing the original expense history.</Text></View></View>

    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Balancing your circles…</Text></View> : <>
      <View style={styles.metrics}>
        <Metric label="Spent this month" value={money(spent)} icon="wallet-outline" colors={colors} styles={styles} />
        <Metric label="You owe" value={money(owe)} icon="arrow-up-circle-outline" colors={colors} styles={styles} bad={owe > 0} />
        <Metric label="You are owed" value={money(owed)} icon="arrow-down-circle-outline" colors={colors} styles={styles} good={owed > 0} />
      </View>

      <View style={styles.budgetCard}><View style={styles.budgetTop}><View><Text style={styles.eyebrow}>WHAT CAN I SPEND?</Text><Text style={styles.budgetValue}>{budget ? money(spendable) : "Set a monthly budget"}</Text></View><Pressable onPress={() => { setBudgetText(budget ? String(budget / 100) : ""); setEditingBudget((v) => !v); }} style={styles.editBtn}><Ionicons name="create-outline" size={16} color={colors.indigo} /><Text style={styles.editText}>{budget ? "Edit" : "Set budget"}</Text></Pressable></View>{budget ? <Text style={styles.muted}>Budget {money(budget)} − your recorded share of this month's expenses {money(spent)}. Outstanding debt ({money(owe)}) and money friends owe you ({money(owed)}) stay visible separately instead of being double-counted.</Text> : <Text style={styles.muted}>Set a personal monthly discretionary budget. UniPool keeps this separate from group balances.</Text>}{editingBudget ? <View style={styles.inline}><TextInput value={budgetText} onChangeText={setBudgetText} keyboardType="decimal-pad" placeholder="Monthly budget in ₹" placeholderTextColor={colors.muted} style={styles.input} /><Pressable onPress={saveBudget} style={styles.smallPrimary}><Text style={styles.smallPrimaryText}>Save</Text></Pressable></View> : null}</View>

      <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Your Circles</Text><Text style={styles.muted}>Hostel, flat, project team, fest, trip or just your friend group.</Text></View><View style={styles.actions}><Pressable onPress={() => setMode(mode === "join" ? "none" : "join")} style={styles.secondary}><Text style={styles.secondaryText}>Join</Text></Pressable><Pressable onPress={() => setMode(mode === "create" ? "none" : "create")} style={styles.primary}><Ionicons name="add" size={17} color="#fff" /><Text style={styles.primaryText}>New Circle</Text></Pressable></View></View>

      {mode === "create" ? <View style={styles.form}><Text style={styles.formTitle}>Create a Circle</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Flat 302, Hostel Gang, Fest Core" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={saving} onPress={createCircle} style={styles.primaryWide}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create Circle</Text>}</Pressable></View> : null}
      {mode === "join" ? <View style={styles.form}><Text style={styles.formTitle}>Join with invite code</Text><TextInput value={invite} onChangeText={setInvite} autoCapitalize="characters" placeholder="8-character invite code" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={saving} onPress={joinCircle} style={styles.primaryWide}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Join Circle</Text>}</Pressable></View> : null}

      <View style={styles.grid}>{groups.map((group) => { const balance = Number(group.my_balance_paise || 0); return <Pressable key={group.group_id} onPress={() => router.push(`/circles/${group.group_id}` as any)} style={styles.circleCard}><View style={styles.emoji}><Text style={{ fontSize: 23 }}>{group.emoji || "💸"}</Text></View><View style={{ flex: 1 }}><Text style={styles.circleTitle}>{group.name}</Text><Text style={styles.muted}>{group.member_count || 1} members · {group.expense_count || 0} expenses</Text><Text style={[styles.balance, balance > 0 && { color: colors.success }, balance < 0 && { color: colors.error }]}>{balance > 0 ? `You are owed ${money(balance)}` : balance < 0 ? `You owe ${money(balance)}` : "All settled"}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>; })}</View>
      {!groups.length ? <View style={styles.empty}><Ionicons name="people-circle-outline" size={31} color={colors.indigo} /><Text style={styles.formTitle}>No Circles yet</Text><Text style={styles.muted}>Create one for your friend group and start with the next chai, cab, grocery run or flat bill.</Text></View> : null}
    </>}
  </ScrollView></SafeAreaView>;
}

function Metric({ label, value, icon, colors, styles, good, bad }: any) { return <View style={styles.metric}><Ionicons name={icon} size={19} color={good ? colors.success : bad ? colors.error : colors.indigo} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface }, page: { width: "100%", maxWidth: 1100, alignSelf: "center", padding: SPACING.lg, paddingBottom: 140 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 22 }, iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: c.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { color: c.onSurface, fontFamily: FONT_DISPLAY, fontSize: 29, fontWeight: "900", marginTop: 4 }, sub: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 720 },
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 10 }, muted: { color: c.muted, fontSize: 11, lineHeight: 16 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }, metric: { flexGrow: 1, flexBasis: 180, minHeight: 105, borderRadius: RADIUS.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 14, justifyContent: "space-between" }, metricValue: { color: c.onSurface, fontSize: 22, fontWeight: "900" }, metricLabel: { color: c.muted, fontSize: 10, fontWeight: "800" },
  budgetCard: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 15, marginBottom: 25 }, budgetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, budgetValue: { color: c.onSurface, fontSize: 20, fontWeight: "900", marginTop: 3 }, editBtn: { flexDirection: "row", gap: 5, alignItems: "center", minHeight: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: c.card }, editText: { color: c.indigo, fontSize: 10, fontWeight: "900" },
  sectionHead: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 12 }, sectionTitle: { color: c.onSurface, fontSize: 18, fontWeight: "900" }, actions: { flexDirection: "row", gap: 8 }, primary: { minHeight: 40, borderRadius: 20, paddingHorizontal: 13, backgroundColor: c.indigo, flexDirection: "row", alignItems: "center", gap: 5 }, primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" }, secondary: { minHeight: 40, borderRadius: 20, paddingHorizontal: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: "center" }, secondaryText: { color: c.onSurface, fontSize: 11, fontWeight: "900" },
  form: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 14, gap: 9, marginBottom: 12 }, formTitle: { color: c.onSurface, fontSize: 14, fontWeight: "900" }, input: { flex: 1, minHeight: 44, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.onSurface, paddingHorizontal: 12, fontSize: 12 }, primaryWide: { minHeight: 42, borderRadius: 21, backgroundColor: c.indigo, alignItems: "center", justifyContent: "center" }, inline: { flexDirection: "row", gap: 8, marginTop: 10 }, smallPrimary: { minWidth: 70, borderRadius: 12, backgroundColor: c.indigo, alignItems: "center", justifyContent: "center" }, smallPrimaryText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  grid: { gap: 9 }, circleCard: { minHeight: 96, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 13 }, emoji: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }, circleTitle: { color: c.onSurface, fontSize: 14, fontWeight: "900" }, balance: { color: c.muted, fontSize: 10, fontWeight: "900", marginTop: 6 }, empty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 20 },
});
