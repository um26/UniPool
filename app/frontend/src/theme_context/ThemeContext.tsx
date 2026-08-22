import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { LIGHT_COLORS, DARK_COLORS, ThemeColors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const THEME_STORAGE_KEY = "unipool_theme_mode"; // "light" | "dark" | "system"

type ThemeMode = "light" | "dark" | "system";

type ThemeCtxValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeCtx = createContext<ThemeCtxValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.secureGet(THEME_STORAGE_KEY, "system");
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
      setLoaded(true);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.secureSet(THEME_STORAGE_KEY, m);
  }, []);

  const toggleTheme = useCallback(() => {
    const resolved = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
    setMode(resolved === "dark" ? "light" : "dark");
  }, [mode, systemScheme, setMode]);

  const isDark = (mode === "system" ? systemScheme === "dark" : mode === "dark") && loaded;
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = useMemo(() => ({ colors, mode, isDark, setMode, toggleTheme }), [colors, mode, isDark, setMode, toggleTheme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) {
    // Fallback for any component rendered outside the provider (shouldn't
    // normally happen) — defaults to light so nothing crashes.
    return { colors: LIGHT_COLORS, mode: "light" as ThemeMode, isDark: false, setMode: () => {}, toggleTheme: () => {} };
  }
  return ctx;
}
