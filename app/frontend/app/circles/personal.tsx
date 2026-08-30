import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { circlesApi } from "@/src/api/circles";
import { BudgetSummary, moneyV3Api } from "@/src/api/moneyV3";
import { useTheme } from "@/src/theme_context/ThemeContext";
import { FONT_DISPLAY, RADIUS, SPACING } from "@/src/theme";

const CATEGORIES = ["food", "groceries", "travel", "academics", "rent", "utilities", "entertainment", "shopping", "salary", "allowance", "refund", "other"];
const BUDGET_CATEGORIES = ["food", "groceries", "travel", "academics", "rent", "utilities", "entertainment", "shopping", "other"];
const money = (paise = 0) => `₹${(Math.abs(Number(paise || 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const signedMoney = (paise = 0) => `${paise < 0 ? "−" : ""}${money(paise)}`;
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function PersonalMoneyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("food");
  const [budgetLimit, setBudgetLimit] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [ledgerResult, budgetResult] = await Promise.allSettled([circlesApi.personalDashboard(), moneyV3Api.budgets()]);
    if (ledgerResult.status === "fulfilled") setDashboard(ledgerResult.value);
    else Alert.alert("Couldn't load personal money", ledgerResult.reason?.message || "Try again");
    if (budgetResult.status === "fulfilled") setBudget(budgetResult.value);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const rupees = Number(amount);
    if (!description.trim()) return Alert.alert("Add a description", "For example: Mess dinner, allowance, books or cab.");
    if (!Number.isFinite(rupees) || rupees <= 0) return Alert.alert("Check amount", "Enter a valid amount above ₹0.");
    setSaving(true);
    try {
      await circlesApi.addPersonalTransaction({
        kind,
        amount_paise: Math.round(rupees * 100),
        description: description.trim(),
        category,
        notes: notes.trim() || null,
      });
      setAmount(""); setDescription(""); setNotes("");
      await load();
    } catch (e: any) { Alert.alert("Couldn't save transaction", e?.message || "Try again"); }
    finally { setSaving(false); }
  };

  const saveBudget = async () => {
    const rupees = Number(budgetLimit);
    if (!Number.isFinite(rupees) || rupees < 0) return Alert.alert("Check budget", "Enter a valid monthly limit.");
    setSaving(true);
    try {
      await moneyV3Api.setBudget(budgetCategory, Math.round(rupees * 100), budget?.month);
      setBudgetLimit(""); setShowBudgetForm(false); await load();
    } catch (e: any) { Alert.alert("Couldn't save budget", e?.message || "Try again"); }
    finally { setSaving(false); }
  };

  const removeBudget = async (categoryName: string) => {
    try { await moneyV3Api.deleteBudget(categoryName, budget?.month); await load(); }
    catch (e: any) { Alert.alert("Couldn't remove budget", e?.message || "Try again"); }
  };

  const remove = async (transactionId: string) => {
    try { await circlesApi.deletePersonalTransaction(transactionId); await load(); }
    catch (e: any) { Alert.alert("Couldn't remove transaction", e?.message || "Try again"); }
  };

  const income = Number(dashboard?.income_paise || budget?.income_paise || 0);
  const expense = Number(dashboard?.expense_paise || budget?.expense_paise || 0);
  const net = Number(dashboard?.net_cashflow_paise ?? income - expense);
  const transactions = dashboard?.transactions || [];
  const budgetRows = budget?.budgets || [];
  const largestCategory = Object.entries(budget?.spent_by_category || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.onSurface} /></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>PERSONAL MONEY</Text><Text style={styles.title}>Your monthly budget</Text><Text style={styles.sub}>Track cashflow, category limits and safe-to-spend guidance. Circle debts stay separate so they never distort this personal ledger.</Text></View>
    </View>

    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.indigo} /></View> : <>
      <Text style={styles.month}>{monthLabel(dashboard?.month || budget?.month || new Date().toISOString().slice(0, 7))}</Text>
      <View style={styles.metrics}>
        <Metric label="Money in" value={money(income)} icon="arrow-down-circle-outline" color={colors.success} styles={styles} />
        <Metric label="Money out" value={money(expense)} icon="arrow-up-circle-outline" color={colors.error} styles={styles} />
        <Metric label="Net cashflow" value={signedMoney(net)} icon="pulse-outline" color={net >= 0 ? colors.success : colors.error} styles={styles} />
        {budget ? <Metric label="Safe this week" value={money(budget.safe_to_spend_week_paise)} icon="calendar-outline" color={colors.indigo} styles={styles} /> : null}
      </View>

      {budget ? <View style={styles.budgetHero}>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>BUDGET HEALTH</Text><Text style={styles.budgetHeroValue}>{budget.total_budget_paise ? `${money(budget.remaining_budget_paise)} left` : "Set your first limit"}</Text><Text style={styles.muted}>{budget.total_budget_paise ? `${money(budget.total_budget_paise)} monthly budget · ${money(budget.safe_to_spend_per_day_paise)} safe/day` : "Category budgets turn your personal ledger into a plan, not just a history."}</Text></View>
        <Pressable onPress={() => setShowBudgetForm((v) => !v)} style={styles.budgetAction}><Ionicons name="add" size={16} color="#fff" /><Text style={styles.primaryText}>Budget</Text></Pressable>
      </View> : null}

      {showBudgetForm ? <View style={styles.form}>
        <Text style={styles.formTitle}>Set category limit</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{BUDGET_CATEGORIES.map((item) => <Pressable key={item} onPress={() => setBudgetCategory(item)} style={[styles.category, budgetCategory === item && { backgroundColor: colors.indigo, borderColor: colors.indigo }]}><Text style={[styles.categoryText, budgetCategory === item && { color: "#fff" }]}>{item}</Text></Pressable>)}</ScrollView>
        <View style={styles.amountWrap}><Text style={styles.rupee}>₹</Text><TextInput value={budgetLimit} onChangeText={setBudgetLimit} keyboardType="decimal-pad" placeholder="Monthly limit" placeholderTextColor={colors.muted} style={styles.amountInput} /></View>
        <Pressable disabled={saving} onPress={saveBudget} style={styles.primary}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save monthly limit</Text>}</Pressable>
      </View> : null}

      {budget ? <View style={styles.sectionBlock}>
        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Category budgets</Text><Text style={styles.muted}>{largestCategory ? `Largest spend: ${largestCategory[0]} · ${money(Number(largestCategory[1]))}` : "Set limits for the categories that matter to you."}</Text></View></View>
        {budgetRows.length ? <View style={styles.list}>{budgetRows.map((row) => {
          const used = row.limit_paise > 0 ? Math.min(1, row.spent_paise / row.limit_paise) : 0;
          return <View key={row.category} style={styles.budgetRow}><View style={styles.budgetTop}><View style={{ flex: 1 }}><Text style={styles.txTitle}>{row.category[0].toUpperCase() + row.category.slice(1)}</Text><Text style={styles.muted}>{money(row.spent_paise)} spent of {money(row.limit_paise)}</Text></View><Text style={[styles.budgetRemaining, row.over_paise > 0 && { color: colors.error }]}>{row.over_paise > 0 ? `${money(row.over_paise)} over` : `${money(row.remaining_paise)} left`}</Text><Pressable onPress={() => removeBudget(row.category)} hitSlop={8}><Ionicons name="close-circle-outline" size={17} color={colors.muted} /></Pressable></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.round(used * 100)}%` as any }, row.over_paise > 0 && { backgroundColor: colors.error }]} /></View></View>;
        })}</View> : <View style={styles.emptySmall}><Text style={styles.muted}>No category limits yet. Tap “Budget” to add one.</Text></View>}
      </View> : null}

      <View style={styles.form}>
        <View style={styles.kindRow}>
          <Pressable onPress={() => setKind("expense")} style={[styles.kindBtn, kind === "expense" && { backgroundColor: colors.error }]}><Ionicons name="remove-circle-outline" size={17} color={kind === "expense" ? "#fff" : colors.error} /><Text style={[styles.kindText, { color: kind === "expense" ? "#fff" : colors.onSurface }]}>Expense</Text></Pressable>
          <Pressable onPress={() => setKind("income")} style={[styles.kindBtn, kind === "income" && { backgroundColor: colors.success }]}><Ionicons name="add-circle-outline" size={17} color={kind === "income" ? "#fff" : colors.success} /><Text style={[styles.kindText, { color: kind === "income" ? "#fff" : colors.onSurface }]}>Income / gain</Text></Pressable>
        </View>
        <Text style={styles.formTitle}>{kind === "expense" ? "Add an expense" : "Add money received"}</Text>
        <View style={styles.row}><View style={styles.amountWrap}><Text style={styles.rupee}>₹</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={styles.amountInput} /></View><TextInput value={description} onChangeText={setDescription} placeholder={kind === "expense" ? "What did you spend on?" : "Where did the money come from?"} placeholderTextColor={colors.muted} style={[styles.input, { flex: 2 }]} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && { backgroundColor: colors.indigo, borderColor: colors.indigo }]}><Text style={[styles.categoryText, category === item && { color: "#fff" }]}>{item}</Text></Pressable>)}</ScrollView>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Optional note" placeholderTextColor={colors.muted} style={styles.input} />
        <Pressable disabled={saving} onPress={save} style={[styles.primary, saving && { opacity: .6 }]}>{saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.primaryText}>Save {kind}</Text></>}</Pressable>
      </View>

      <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Recent transactions</Text><Text style={styles.muted}>Your personal ledger only.</Text></View></View>
      <View style={styles.list}>{transactions.map((item: any) => <View key={item.transaction_id} style={styles.transaction}>
        <View style={[styles.txIcon, { backgroundColor: item.kind === "income" ? colors.surface2 : colors.card }]}><Ionicons name={item.kind === "income" ? "arrow-down" : "arrow-up"} size={17} color={item.kind === "income" ? colors.success : colors.error} /></View>
        <View style={{ flex: 1 }}><Text style={styles.txTitle}>{item.description}</Text><Text style={styles.muted}>{item.category} · {new Date(item.occurred_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text></View>
        <Text style={[styles.txAmount, { color: item.kind === "income" ? colors.success : colors.onSurface }]}>{item.kind === "income" ? "+" : "−"}{money(item.amount_paise)}</Text>
        <Pressable onPress={() => remove(item.transaction_id)} hitSlop={10} accessibilityLabel={`Remove ${item.description}`}><Ionicons name="trash-outline" size={16} color={colors.muted} /></Pressable>
      </View>)}</View>
      {!transactions.length ? <View style={styles.empty}><Ionicons name="receipt-outline" size={28} color={colors.indigo} /><Text style={styles.formTitle}>No personal transactions yet</Text><Text style={styles.muted}>Add your first expense or income above.</Text></View> : null}
    </>}
  </ScrollView></SafeAreaView>;
}

function Metric({ label, value, icon, color, styles }: any) { return <View style={styles.metric}><Ionicons name={icon} size={19} color={color} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface }, page: { width: "100%", maxWidth: 980, alignSelf: "center", padding: SPACING.lg, paddingBottom: 140 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 20 }, iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: c.saffron, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { color: c.onSurface, fontFamily: FONT_DISPLAY, fontSize: 29, fontWeight: "900", marginTop: 4 }, sub: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 680 },
  loading: { minHeight: 260, alignItems: "center", justifyContent: "center" }, month: { color: c.muted, fontSize: 11, fontWeight: "800", marginBottom: 8 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }, metric: { flexGrow: 1, flexBasis: 180, minHeight: 100, borderRadius: RADIUS.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 14, justifyContent: "space-between" }, metricValue: { color: c.onSurface, fontSize: 21, fontWeight: "900" }, metricLabel: { color: c.muted, fontSize: 10, fontWeight: "800" },
  budgetHero: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 15, marginBottom: 12 }, budgetHeroValue: { color: c.onSurface, fontSize: 20, fontWeight: "900", marginVertical: 3 }, budgetAction: { minHeight: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: c.indigo, flexDirection: "row", alignItems: "center", gap: 5 },
  form: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 15, gap: 10, marginBottom: 24 }, formTitle: { color: c.onSurface, fontSize: 14, fontWeight: "900" },
  sectionBlock: { marginBottom: 24 }, kindRow: { flexDirection: "row", gap: 8 }, kindBtn: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.surface2 }, kindText: { fontSize: 11, fontWeight: "900" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, amountWrap: { minWidth: 150, flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface }, rupee: { color: c.onSurface, fontSize: 18, fontWeight: "900", paddingLeft: 12 }, amountInput: { flex: 1, color: c.onSurface, paddingHorizontal: 8, fontSize: 16, minHeight: 44 }, input: { minHeight: 46, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.onSurface, paddingHorizontal: 12, fontSize: 12 },
  categories: { gap: 7, paddingVertical: 2 }, category: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }, categoryText: { color: c.onSurface, fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  primary: { minHeight: 44, borderRadius: 22, backgroundColor: c.indigo, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  sectionHead: { marginBottom: 9 }, sectionTitle: { color: c.onSurface, fontSize: 18, fontWeight: "900" }, muted: { color: c.muted, fontSize: 10, lineHeight: 15 }, list: { gap: 7 }, transaction: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 15, paddingHorizontal: 12 }, txIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, txTitle: { color: c.onSurface, fontSize: 12, fontWeight: "800" }, txAmount: { fontSize: 12, fontWeight: "900" },
  budgetRow: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 12 }, budgetTop: { flexDirection: "row", alignItems: "center", gap: 9 }, budgetRemaining: { color: c.success, fontSize: 10, fontWeight: "900" }, track: { height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: c.surface2, marginTop: 9 }, fill: { height: "100%", backgroundColor: c.indigo, borderRadius: 4 }, emptySmall: { minHeight: 70, alignItems: "center", justifyContent: "center", backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 14 },
  empty: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, marginTop: 8 },
});
