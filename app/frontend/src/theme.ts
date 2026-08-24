export const LIGHT_COLORS = {
  // Cool, neutral surfaces keep the product crisp instead of beige-heavy.
  surface: "#F7F9FC",
  onSurface: "#172033",
  surface2: "#EEF2F8",
  surface3: "#E3E9F2",
  onSurface2: "#344054",

  // UniPool brand: deep university blue + warm mobility amber.
  indigo: "#2947B8",
  saffron: "#F59E0B",
  cream: "#FFF4D6",
  onCream: "#9A5B00",
  onIndigo: "#FFFFFF",

  card: "#FFFFFF",
  border: "#D9E0EB",
  borderStrong: "#B8C4D6",
  success: "#159A72",
  warning: "#D97706",
  error: "#DC3B4B",
  muted: "#667085",
};

export const DARK_COLORS = {
  // A proper navy/slate dark theme — not purple-black and not pure black.
  surface: "#0B1220",
  onSurface: "#F4F7FC",
  surface2: "#111C30",
  surface3: "#182640",
  onSurface2: "#C8D2E3",

  // Keep the same brand hue family as light mode, tuned for dark contrast.
  indigo: "#7EA2FF",
  saffron: "#FFB84D",
  cream: "#332A18",
  onCream: "#FFD58A",
  onIndigo: "#071225",

  card: "#101B30",
  border: "#263754",
  borderStrong: "#3A4B6A",
  success: "#45D6A4",
  warning: "#FFC45C",
  error: "#FF7180",
  muted: "#93A1B8",
};

// Backward-compatible static export — light palette, used by any file not
// yet wired into ThemeContext. Prefer `useTheme().colors` in new/updated code.
export const COLORS = LIGHT_COLORS;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 };
export const FONT = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 };

// Display font for hero headings/logo — pairs with Manrope (the app-wide
// default body font, set globally in src/utils/setupFonts.ts) for a more
// editorial, premium feel on the handful of largest headlines.
export const FONT_DISPLAY = "Lexend, -apple-system, sans-serif";

export type ThemeColors = typeof LIGHT_COLORS;
