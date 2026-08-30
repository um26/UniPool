import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAuth, AuthProvider } from "@/src/auth/AuthContext";
import { ThemeProvider, useTheme } from "@/src/theme_context/ThemeContext";
import { applyPremiumFontDefaults } from "@/src/utils/setupFonts";
import AnimatedSplash from "@/src/components/AnimatedSplash";
import WebTopBar from "@/src/components/WebTopBar";
import SiteFooter from "@/src/components/SiteFooter";
import FloatingChatLauncher from "@/src/components/FloatingChatLauncher";
import PolicyConsentGate from "@/src/components/PolicyConsentGate";
import CampusUtilityStrip from "@/src/components/CampusUtilityStrip";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();
applyPremiumFontDefaults();
const PROTECTED_ROOTS = new Set(["post-request", "games", "chat", "pool", "heatmap", "trip-receipt", "network", "settings", "notifications", "circles", "people"]);
const PUBLIC_ROOTS = new Set(["terms", "privacy", "faq", "community-guidelines"]);

function AuthGate() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const root = String(segments[0] || "");
  const isPublic = PUBLIC_ROOTS.has(root);
  const onHome = segments[0] === "(tabs)" && (!segments[1] || String(segments[1]) === "index");

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === "(tabs)";
    if (!user && (inTabs || PROTECTED_ROOTS.has(root))) router.replace("/");
    if (user && !inTabs && !PROTECTED_ROOTS.has(root) && !isPublic) router.replace("/(tabs)");
  }, [user, loading, segments, router, root, isPublic]);

  if (loading) return <AnimatedSplash />;
  const shell = <View style={{ flex: 1, backgroundColor: colors.surface }}>
    {user ? <WebTopBar /> : null}
    {user && onHome ? <CampusUtilityStrip /> : null}
    <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "fade_from_bottom" }}>
      <Stack.Screen name="index" /><Stack.Screen name="(tabs)" />
      <Stack.Screen name="terms" options={{ animation: "slide_from_right" }} /><Stack.Screen name="privacy" options={{ animation: "slide_from_right" }} /><Stack.Screen name="faq" options={{ animation: "slide_from_right" }} /><Stack.Screen name="community-guidelines" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="post-request" options={{ presentation: "modal", animation: "slide_from_bottom" }} /><Stack.Screen name="settings" options={{ animation: "slide_from_right" }} /><Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} /><Stack.Screen name="people" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="circles/index" options={{ animation: "slide_from_right" }} /><Stack.Screen name="circles/personal" options={{ animation: "slide_from_right" }} /><Stack.Screen name="circles/[groupId]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="games/trivia" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/word-scramble" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/airport-codes" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/destination-detective" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/travel-reveal" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/daily-challenge" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/guess-state" options={{ animation: "slide_from_right" }} /><Stack.Screen name="games/station-codes" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="chat/[userId]" options={{ animation: "slide_from_right" }} /><Stack.Screen name="chat/group/[conversationId]" options={{ animation: "slide_from_right" }} /><Stack.Screen name="pool/[poolId]" options={{ animation: "slide_from_right" }} /><Stack.Screen name="network" options={{ animation: "slide_from_right" }} /><Stack.Screen name="heatmap" options={{ animation: "slide_from_right" }} /><Stack.Screen name="trip-receipt/[poolId]" options={{ animation: "slide_from_bottom" }} />
    </Stack></View>
    {user ? <SiteFooter /> : null}{user ? <FloatingChatLauncher /> : null}
  </View>;

  return user ? <PolicyConsentGate bypass={isPublic}>{shell}</PolicyConsentGate> : shell;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync(); }, [loaded, error]);
  if (!loaded && !error) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><ThemeProvider><AuthProvider><AuthGate /></AuthProvider></ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;
}
