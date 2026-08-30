import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { circlesApi } from "@/src/api/circles";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { RADIUS, SPACING, FONT_DISPLAY } from "@/src/theme";

const money = (paise = 0) => `₹${(Math.abs(Number(paise || 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const CATEGORIES = ["food", "groceries", "rent", "travel", "academics", "entertainment", "utilities", "other"];
type SplitMode = "equal" | "exact" | "percentage" | "shares";
type Member = { user_id: string; name: string; username?: string; college_verified?: boolean };

function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => total * w / sum);
  const values = raw.map(Math.floor);
  let remainder = total - values.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let i = 0; i < remainder; i++) values[order[i % order.length].i] += 1;
  return values;
}

export default function CircleDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showExpense, setShowExpense] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [payer, setPayer] = useState("");
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const next = await circlesApi.get(groupId); setData(next);
      const ids = (next.members || []).map((m: Member) => m.user_id); setParticipants(new Set(ids));
      if (!payer) setPayer(user?.user_id || ids[0] || "");
      if (!settleFrom) setSettleFrom(user?.user_id || ids[0] || "");
      if (!settleTo) setSettleTo(ids.find((id: string) => id !== (user?.user_id || ids[0])) || "");
    } catch (e: any) { Alert.alert("Couldn't load Circle", e.message); }
    finally { setLoading(false); }
  }, [groupId, user?.user_id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const members: Member[] = data?.members || [];
  const memberName = (id: string) => members.find((m) => m.user_id === id)?.name || "Student";
  const invite = data?.group?.invite_code || "";

  const shareInvite = async () => {
    const text = `Join my UniPool Circle “${data?.group?.name}”. Invite code: ${invite}\nOpen UniPool → Explore → Circles → Join.`;
    await Share.share({ title: `Join ${data?.group?.name}`, message: text });
  };
  const searchPeople = async (value: string) => {
    setSearch(value);
    if (value.trim().length < 2) return setResults([]);
    try { const response = await api.globalSearch(value.trim()); const existing = new Set(members.map((m) => m.user_id)); setResults((response.people || []).filter((p: any) => !existing.has(p.user_id))); } catch { setResults([]); }
  };
  const addMember = async (id: string) => {
    try { await circlesApi.addMember(groupId!, id); setSearch(""); setResults([]); await load(); }
    catch (e: any) { Alert.alert("Couldn't add member", e.message); }
  };

  const buildSplits = () => {
    const ids = members.map((m) => m.user_id).filter((id) => participants.has(id));
    const total = Math.round(Number(amount) * 100);
    if (!ids.length || !Number.isFinite(total) || total <= 0) throw new Error("Choose participants and enter a valid amount.");
    let values: number[];
    if (splitMode === "equal") values = allocate(total, ids.map(() => 1));
    else if (splitMode === "exact") {
      values = ids.map((id) => Math.round(Number(splitInputs[id] || 0) * 100));
      if (values.reduce((a, b) => a + b, 0) !== total) throw new Error("Exact splits must add up to the total.");
    } else if (splitMode === "percentage") {
      const weights = ids.map((id) => Number(splitInputs[id] || 0));
      if (Math.abs(weights.reduce((a, b) => a + b, 0) - 100) > 0.001) throw new Error("Percentages must add up to 100%.");
      values = allocate(total, weights);
    } else {
      const weights = ids.map((id) => Number(splitInputs[id] || 0));
      if (weights.some((v) => !Number.isFinite(v) || v <= 0)) throw new Error("Every selected member needs at least one share.");
      values = allocate(total, weights);
    }
    return ids.map((user_id, index) => ({ user_id, amount_paise: values[index] }));
  };
  const addExpense = async () => {
    if (!description.trim()) return Alert.alert("What was it for?", "Add a short description.");
    setSaving(true);
    try {
      const splits = buildSplits();
      await circlesApi.addExpense(groupId!, { description: description.trim(), amount_paise: Math.round(Number(amount) * 100), paid_by: payer, splits, split_type: splitMode, category, notes: null });
      setDescription(""); setAmount(""); setSplitInputs({}); setShowExpense(false); await load();
    } catch (e: any) { Alert.alert("Couldn't add expense", e.message); }
    finally { setSaving(false); }
  };
  const settle = async (from = settleFrom, to = settleTo, amountPaise?: number) => {
    const paise = amountPaise ?? Math.round(Number(settleAmount) * 100);
    if (!from || !to || from === to || !paise) return Alert.alert("Check settlement", "Choose two people and an amount.");
    setSaving(true);
    try { await circlesApi.settle(groupId!, { from_user_id: from, to_user_id: to, amount_paise: paise }); setSettleAmount(""); setShowSettle(false); await load(); }
    catch (e: any) { Alert.alert("Couldn't settle", e.message); }
    finally { setSaving(false); }
  };
  const removeExpense = (expense: any) => Alert.alert("Remove expense?", expense.description, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: async () => { try { await circlesApi.deleteExpense(groupId!, expense.expense_id); await load(); } catch (e: any) { Alert.alert("Couldn't remove", e.message); } } }]);

  if (loading && !data) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={colors.indigo} /><Text style={styles.muted}>Opening ledger…</Text></View></SafeAreaView>;
  if (!data) return null;
  const myBalance = Number(data.my_balance_paise || 0);

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>CIRCLE</Text><Text style={styles.title}>{data.group.emoji || "💸"} {data.group.name}</Text><Text style={styles.sub}>{members.length} members · invite {invite}</Text></View><Pressable onPress={shareInvite} style={styles.share}><Ionicons name="share-social-outline" size={17} color={colors.indigo} /><Text style={styles.shareText}>Invite</Text></Pressable></View>

    <View style={styles.hero}><Text style={styles.eyebrow}>YOUR POSITION</Text><Text style={[styles.heroValue, myBalance > 0 && { color: colors.success }, myBalance < 0 && { color: colors.error }]}>{myBalance > 0 ? `You are owed ${money(myBalance)}` : myBalance < 0 ? `You owe ${money(myBalance)}` : "All settled"}</Text><Text style={styles.muted}>This is your net position after every recorded expense and settlement in this Circle.</Text></View>

    <View style={styles.actions}><Pressable onPress={() => setShowExpense((v) => !v)} style={styles.primary}><Ionicons name="add" size={17} color="#fff" /><Text style={styles.primaryText}>Add expense</Text></Pressable><Pressable onPress={() => setShowSettle((v) => !v)} style={styles.secondary}><Ionicons name="checkmark-circle-outline" size={17} color={colors.indigo} /><Text style={styles.secondaryText}>Settle up</Text></Pressable><Pressable onPress={() => setShowMembers((v) => !v)} style={styles.secondary}><Ionicons name="person-add-outline" size={17} color={colors.indigo} /><Text style={styles.secondaryText}>Members</Text></Pressable></View>

    {showExpense ? <View style={styles.form}><Text style={styles.sectionTitle}>New expense</Text><View style={styles.row}><TextInput value={description} onChangeText={setDescription} placeholder="Dinner, groceries, Wi-Fi…" placeholderTextColor={colors.muted} style={[styles.input, { flex: 2 }]} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="₹ Amount" placeholderTextColor={colors.muted} style={styles.input} /></View><Text style={styles.label}>Paid by</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{members.map((m) => <Chip key={m.user_id} active={payer === m.user_id} text={m.user_id === user?.user_id ? "You" : m.name.split(" ")[0]} onPress={() => setPayer(m.user_id)} styles={styles} />)}</ScrollView><Text style={styles.label}>Who shares this?</Text><View style={styles.wrap}>{members.map((m) => <Chip key={m.user_id} active={participants.has(m.user_id)} text={m.user_id === user?.user_id ? "You" : m.name.split(" ")[0]} onPress={() => setParticipants((current) => { const next = new Set(current); next.has(m.user_id) ? next.delete(m.user_id) : next.add(m.user_id); return next; })} styles={styles} />)}</View><Text style={styles.label}>Split</Text><View style={styles.wrap}>{(["equal", "exact", "percentage", "shares"] as SplitMode[]).map((mode) => <Chip key={mode} active={splitMode === mode} text={mode[0].toUpperCase() + mode.slice(1)} onPress={() => { setSplitMode(mode); setSplitInputs({}); }} styles={styles} />)}</View>{splitMode !== "equal" ? <View style={styles.splitGrid}>{members.filter((m) => participants.has(m.user_id)).map((m) => <View key={m.user_id} style={styles.splitRow}><Text style={styles.splitName}>{m.user_id === user?.user_id ? "You" : m.name}</Text><TextInput value={splitInputs[m.user_id] || ""} onChangeText={(v) => setSplitInputs((old) => ({ ...old, [m.user_id]: v }))} keyboardType="decimal-pad" placeholder={splitMode === "exact" ? "₹" : splitMode === "percentage" ? "%" : "shares"} placeholderTextColor={colors.muted} style={styles.splitInput} /></View>)}</View> : null}<Text style={styles.label}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{CATEGORIES.map((item) => <Chip key={item} active={category === item} text={item[0].toUpperCase() + item.slice(1)} onPress={() => setCategory(item)} styles={styles} />)}</ScrollView><Pressable disabled={saving} onPress={addExpense} style={styles.primaryWide}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Add to ledger</Text>}</Pressable></View> : null}

    {showSettle ? <View style={styles.form}><Text style={styles.sectionTitle}>Record a settlement</Text><Text style={styles.muted}>This records money already paid. UniPool does not move money itself.</Text><Text style={styles.label}>From</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{members.map((m) => <Chip key={m.user_id} active={settleFrom === m.user_id} text={m.user_id === user?.user_id ? "You" : m.name.split(" ")[0]} onPress={() => setSettleFrom(m.user_id)} styles={styles} />)}</ScrollView><Text style={styles.label}>To</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{members.map((m) => <Chip key={m.user_id} active={settleTo === m.user_id} text={m.user_id === user?.user_id ? "You" : m.name.split(" ")[0]} onPress={() => setSettleTo(m.user_id)} styles={styles} />)}</ScrollView><TextInput value={settleAmount} onChangeText={setSettleAmount} keyboardType="decimal-pad" placeholder="₹ Amount paid" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={saving} onPress={() => settle()} style={styles.primaryWide}><Text style={styles.primaryText}>Mark as settled</Text></Pressable></View> : null}

    {showMembers ? <View style={styles.form}><Text style={styles.sectionTitle}>Members</Text><View style={styles.wrap}>{members.map((m) => <View key={m.user_id} style={styles.memberPill}><Text style={styles.memberName}>{m.name}</Text>{m.college_verified ? <Ionicons name="shield-checkmark" size={14} color={colors.indigo} /> : null}</View>)}</View><TextInput value={search} onChangeText={searchPeople} placeholder="Search a UniPool student to add" placeholderTextColor={colors.muted} style={styles.input} />{results.map((p) => <Pressable key={p.user_id} onPress={() => addMember(p.user_id)} style={styles.searchRow}><View style={{ flex: 1 }}><Text style={styles.memberName}>{p.name}</Text><Text style={styles.muted}>@{p.username || "student"}</Text></View><Ionicons name="add-circle" size={22} color={colors.indigo} /></Pressable>)}</View> : null}

    <Section title="Simplify group debts" sub="Same net balances, fewer payments. Original expenses never change.">
      {data.simplified?.length ? <View style={styles.stack}>{data.simplified.map((s: any, i: number) => <View key={`${s.from_user_id}-${s.to_user_id}-${i}`} style={styles.settleCard}><View style={{ flex: 1 }}><Text style={styles.settleText}>{s.from_name} pays {s.to_name}</Text><Text style={styles.settleAmount}>{money(s.amount_paise)}</Text></View>{user?.user_id === s.from_user_id || user?.user_id === s.to_user_id || data.group.admins?.includes(user?.user_id) ? <Pressable onPress={() => settle(s.from_user_id, s.to_user_id, s.amount_paise)} style={styles.markBtn}><Text style={styles.markText}>Mark paid</Text></Pressable> : null}</View>)}</View> : <View style={styles.allGood}><Ionicons name="checkmark-done-circle" size={24} color={colors.success} /><Text style={styles.sectionTitle}>Nothing to simplify</Text><Text style={styles.muted}>Everyone's current net balance is settled.</Text></View>}
    </Section>

    <Section title="Balances"><View style={styles.balanceGrid}>{data.balances.map((b: any) => <View key={b.user_id} style={styles.balanceCard}><Text style={styles.memberName}>{b.user_id === user?.user_id ? "You" : b.name}</Text><Text style={[styles.balanceValue, b.amount_paise > 0 && { color: colors.success }, b.amount_paise < 0 && { color: colors.error }]}>{b.amount_paise > 0 ? `gets ${money(b.amount_paise)}` : b.amount_paise < 0 ? `owes ${money(b.amount_paise)}` : "settled"}</Text></View>)}</View></Section>

    <Section title="This month" sub={`${money(data.month?.total_paise || 0)} recorded in this Circle.`}><View style={styles.wrap}>{Object.entries(data.month?.categories || {}).sort((a: any, b: any) => b[1] - a[1]).map(([key, value]: any) => <View key={key} style={styles.category}><Text style={styles.categoryName}>{key}</Text><Text style={styles.categoryValue}>{money(value)}</Text></View>)}</View></Section>

    <Section title="Expenses"><View style={styles.stack}>{data.expenses?.map((e: any) => <Pressable key={e.expense_id} onLongPress={() => removeExpense(e)} style={styles.expenseCard}><View style={styles.expenseIcon}><Ionicons name={e.category === "food" ? "restaurant-outline" : e.category === "travel" ? "car-outline" : e.category === "rent" ? "home-outline" : "receipt-outline"} size={18} color={colors.saffron} /></View><View style={{ flex: 1 }}><Text style={styles.expenseTitle}>{e.description}</Text><Text style={styles.muted}>{e.paid_by_name} paid · {e.split_type} split · {new Date(e.created_at).toLocaleDateString()}</Text></View><Text style={styles.expenseAmount}>{money(e.amount_paise)}</Text></Pressable>)}{!data.expenses?.length ? <Text style={styles.muted}>No expenses yet. Add the next shared chai, dinner, rent or grocery run.</Text> : null}</View></Section>

    <Section title="Activity"><View style={styles.stack}>{data.activity?.slice(0, 12).map((a: any) => <View key={a.activity_id} style={styles.activity}><View style={styles.activityDot} /><View style={{ flex: 1 }}><Text style={styles.activityText}><Text style={{ fontWeight: "900" }}>{a.actor_name}</Text> {a.label}</Text><Text style={styles.muted}>{new Date(a.created_at).toLocaleString()}</Text></View></View>)}</View></Section>
  </ScrollView></SafeAreaView>;
}

function Chip({ active, text, onPress, styles }: any) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text></Pressable>; }
function Section({ title, sub, children }: any) { const { colors } = useTheme(); return <View style={{ marginTop: 26 }}><Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "900" }}>{title}</Text>{sub ? <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3, marginBottom: 10 }}>{sub}</Text> : <View style={{ height: 10 }} />}{children}</View>; }

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface }, page: { width: "100%", maxWidth: 1050, alignSelf: "center", padding: SPACING.lg, paddingBottom: 150 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginBottom: 18 }, iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }, eyebrow: { color: c.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1 }, title: { color: c.onSurface, fontSize: 27, fontFamily: FONT_DISPLAY, fontWeight: "900", marginTop: 3 }, sub: { color: c.muted, fontSize: 11, marginTop: 3 }, share: { minHeight: 38, borderRadius: 19, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 11 }, shareText: { color: c.indigo, fontSize: 10, fontWeight: "900" }, muted: { color: c.muted, fontSize: 10, lineHeight: 15 },
  hero: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.xl, padding: 18, marginBottom: 12 }, heroValue: { color: c.onSurface, fontSize: 24, fontWeight: "900", marginVertical: 6 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }, primary: { minHeight: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: c.indigo, flexDirection: "row", alignItems: "center", gap: 6 }, primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" }, secondary: { minHeight: 42, borderRadius: 21, paddingHorizontal: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }, secondaryText: { color: c.indigo, fontSize: 10, fontWeight: "900" },
  form: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 14, gap: 9, marginTop: 4 }, sectionTitle: { color: c.onSurface, fontSize: 14, fontWeight: "900" }, label: { color: c.muted, fontSize: 9, fontWeight: "900", letterSpacing: .6, marginTop: 3 }, input: { flex: 1, minHeight: 44, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.onSurface, paddingHorizontal: 11, fontSize: 12 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chips: { gap: 6, paddingVertical: 2 }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center", paddingHorizontal: 11 }, chipActive: { backgroundColor: c.indigo, borderColor: c.indigo }, chipText: { color: c.muted, fontSize: 10, fontWeight: "800" }, chipTextActive: { color: "#fff" }, primaryWide: { minHeight: 44, backgroundColor: c.indigo, borderRadius: 22, alignItems: "center", justifyContent: "center", marginTop: 3 },
  splitGrid: { gap: 6 }, splitRow: { flexDirection: "row", alignItems: "center", gap: 8 }, splitName: { flex: 1, color: c.onSurface, fontSize: 11, fontWeight: "800" }, splitInput: { width: 110, minHeight: 38, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, color: c.onSurface, paddingHorizontal: 9 }, memberPill: { minHeight: 34, borderRadius: 17, backgroundColor: c.surface2, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10 }, memberName: { color: c.onSurface, fontSize: 11, fontWeight: "900" }, searchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 7 },
  stack: { gap: 8 }, settleCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 12 }, settleText: { color: c.onSurface, fontSize: 11, fontWeight: "800" }, settleAmount: { color: c.indigo, fontSize: 18, fontWeight: "900", marginTop: 3 }, markBtn: { minHeight: 34, borderRadius: 17, backgroundColor: c.surface2, justifyContent: "center", paddingHorizontal: 10 }, markText: { color: c.indigo, fontSize: 9, fontWeight: "900" }, allGood: { minHeight: 110, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", gap: 6 },
  balanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, balanceCard: { flexGrow: 1, flexBasis: 170, minHeight: 75, borderRadius: RADIUS.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 11 }, balanceValue: { color: c.muted, fontSize: 12, fontWeight: "900", marginTop: 8 }, category: { minWidth: 130, minHeight: 60, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: 10 }, categoryName: { color: c.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" }, categoryValue: { color: c.onSurface, fontSize: 15, fontWeight: "900", marginTop: 5 },
  expenseCard: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: 11 }, expenseIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }, expenseTitle: { color: c.onSurface, fontSize: 12, fontWeight: "900" }, expenseAmount: { color: c.onSurface, fontSize: 13, fontWeight: "900" }, activity: { minHeight: 44, flexDirection: "row", alignItems: "flex-start", gap: 9 }, activityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.saffron, marginTop: 5 }, activityText: { color: c.onSurface2, fontSize: 10, lineHeight: 15 },
});
