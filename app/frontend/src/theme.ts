export const LIGHT_COLORS = {
  // Warm-neutral surfaces + deep ink keep the UI soft, premium and readable.
  surface: "#F7F8FA",
  onSurface: "#172033",
  surface2: "#EEF1F5",
  surface3: "#E4E8EF",
  onSurface2: "#3F4A5C",
  // One restrained brand accent that works naturally in both themes.
  indigo: "#3451D1",
  saffron: "#F2A23A",
  cream: "#FFF4DE",
  onCream: "#9A5B12",
  onIndigo: "#FFFFFF",
  card: "#FFFFFF",
  border: "#DDE2EA",
  borderStrong: "#C6CEDA",
  success: "#0F9F75",
  warning: "#D98A16",
  error: "#D94A5B",
  muted: "#687386",
};

export const DARK_COLORS = {
  // Neutral blue-black surfaces avoid the muddy purple/orange look while
  // preserving the UniPool accent language.
  surface: "#0F141D",
  onSurface: "#F4F7FB",
  surface2: "#171E29",
  surface3: "#202936",
  onSurface2: "#C2CAD6",
  indigo: "#8EA2FF",
  saffron: "#F6B85A",
  cream: "#2B241A",
  onCream: "#FFD18A",
  onIndigo: "#101722",
  card: "#171E29",
  border: "#2A3442",
  borderStrong: "#3A4656",
  success: "#42C79D",
  warning: "#F3B84F",
  error: "#FF7D8D",
  muted: "#919CAD",
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
