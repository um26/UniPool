import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { LIGHT_COLORS, DARK_COLORS, ThemeColors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const THEME_STORAGE_KEY = "unipool_theme_mode";

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
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.secureGet(THEME_STORAGE_KEY, "light");
      if (saved === "dark" || saved === "system") setModeState(saved);
      else setModeState("light");
      setLoaded(true);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.secureSet(THEME_STORAGE_KEY, m);
  }, []);

  const effectiveDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const isDark = effectiveDark && loaded;
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const toggleTheme = useCallback(() => {
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  const value = useMemo(
    () => ({ colors, mode, isDark, setMode, toggleTheme }),
    [colors, mode, isDark, setMode, toggleTheme]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) {
    return {
      colors: LIGHT_COLORS,
      mode: "light" as ThemeMode,
      isDark: false,
      setMode: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
