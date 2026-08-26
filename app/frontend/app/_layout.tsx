import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAuth, AuthProvider } from "@/src/auth/AuthContext";
import { ThemeProvider, useTheme } from "@/src/theme_context/ThemeContext";
import { applyPremiumFontDefaults } from "@/src/utils/setupFonts";
import AnimatedSplash from "@/src/components/AnimatedSplash";
import WebTopBar from "@/src/components/WebTopBar";
import { api } from "@/src/api/client";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();
applyPremiumFontDefaults();

function TripChatAutoOpen() {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const known = useRef<Set<string> | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!user?.user_id) return;

    const check = async () => {
      if (running.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      running.current = true;
      try {
        // Conversations are now materialized by the backend when a match is
        // created/accepted. Watching one lightweight endpoint is enough; the
        // old implementation repeatedly fetched matches + confirmed trips and
        // then called ensureTripChat for each item every seven seconds.
        const conversations = await api.listConversations();
        const ids = new Set<string>(
          (conversations || [])
            .filter((item: any) => item.kind === "group" && item.conversation_id)
            .map((item: any) => item.conversation_id as string)
        );

        if (known.current === null) {
          known.current = ids;
          return;
        }

        const fresh = [...ids].find((id) => !known.current!.has(id));
        known.current = ids;
        if (!fresh) return;

        if (segments[0] !== "chat") {
          router.push({ pathname: "/chat/group/[conversationId]", params: { conversationId: fresh } });
        }
      } catch {
        // Chat availability should never break navigation.
      } finally {
        running.current = false;
      }
    };

    check();
    const timer = setInterval(check, 20000);
    return () => clearInterval(timer);
  }, [user?.user_id, router, segments]);

  return null;
}

function AuthGate() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === "(tabs)";
    if (!user && inTabs) router.replace("/");
    if (user && !inTabs && segments[0] !== "post-request" && segments[0] !== "games" && segments[0] !== "chat" && segments[0] !== "pool" && segments[0] !== "heatmap" && segments[0] !== "trip-receipt") {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) return <AnimatedSplash />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {user ? <WebTopBar /> : null}
      <View style={{ flex: 1 }}>
        <TripChatAutoOpen />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post-request" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="games/trivia" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="games/tap-plane" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="games/memory-match" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="games/word-scramble" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="games/rickshaw-rush" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="chat/[userId]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="chat/group/[conversationId]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="pool/[poolId]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="heatmap" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="trip-receipt/[poolId]" options={{ animation: "slide_from_bottom" }} />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
