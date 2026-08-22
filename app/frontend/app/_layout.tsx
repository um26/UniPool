import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/auth/AuthContext";
import { ThemeProvider, useTheme } from "@/src/theme_context/ThemeContext";
import { applyPremiumFontDefaults } from "@/src/utils/setupFonts";
import AnimatedSplash from "@/src/components/AnimatedSplash";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();
applyPremiumFontDefaults();

// Temporary visual-review mode. Keep authentication intact in the auth provider;
// this only lets the preview navigate through the UI before the auth flow is restored.
const PREVIEW_MODE = true;

function AuthGate() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inTabs = segments[0] === "(tabs)";
    if (!PREVIEW_MODE && !user && inTabs) router.replace("/");
    if (!PREVIEW_MODE && user && !inTabs && segments[0] !== "post-request" && segments[0] !== "games" && segments[0] !== "chat" && segments[0] !== "pool") {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return <AnimatedSplash />;
  }

  return (
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
      <Stack.Screen name="pool/[poolId]" options={{ animation: "slide_from_right" }} />
    </Stack>
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
