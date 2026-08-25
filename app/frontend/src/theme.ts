export const LIGHT_COLORS = {
  // Warm, quiet light mode. The product should feel calm and trustworthy,
  // while saffron is reserved for moments that need attention.
  surface: "#F8F7F3",
  onSurface: "#18202A",
  surface2: "#F1F0EB",
  surface3: "#E9E7E0",
  onSurface2: "#53606D",
  indigo: "#2447A8",
  saffron: "#F59B23",
  cream: "#FFF2D9",
  onCream: "#7A4A00",
  onIndigo: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E2E0D8",
  borderStrong: "#C9C6BB",
  success: "#168361",
  warning: "#B96C0D",
  error: "#C83D4D",
  muted: "#747B84",

  // Compatibility aliases used by older screens. Keeping these centralized
  // prevents undefined colours while the app is migrated to semantic tokens.
  text: "#18202A",
  surfaceAlt: "#F1F0EB",
  primary: "#2447A8",
};

export const DARK_COLORS = {
  // Neutral charcoal rather than a purple/blue-black. It keeps dark mode
  // sophisticated and makes route/status colours easier to read.
  surface: "#111315",
  onSurface: "#F6F4EE",
  surface2: "#191C1F",
  surface3: "#23272B",
  onSurface2: "#C8CCD0",
  indigo: "#8AA7FF",
  saffron: "#FFB34D",
  cream: "#2A2318",
  onCream: "#FFD38A",
  onIndigo: "#101827",
  card: "#171A1D",
  border: "#2D3237",
  borderStrong: "#444A50",
  success: "#51C79B",
  warning: "#FFC267",
  error: "#FF7A88",
  muted: "#9DA4AB",

  text: "#F6F4EE",
  surfaceAlt: "#191C1F",
  primary: "#8AA7FF",
};

export const COLORS = LIGHT_COLORS;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const FONT = {
  xs: 11,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
};

export const FONT_DISPLAY = "Lexend, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export type ThemeColors = typeof LIGHT_COLORS;
