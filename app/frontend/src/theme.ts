export const LIGHT_COLORS = {
  // Soft ivory + ink + restrained UniPool blue/orange. Designed to feel premium
  // without becoming overly saturated or "techy".
  surface: "#F5F7FA",
  onSurface: "#172033",
  surface2: "#EDF1F5",
  surface3: "#E2E7EE",
  onSurface2: "#465267",
  indigo: "#3157C9",
  saffron: "#F2A23A",
  cream: "#FFF4DE",
  onCream: "#915712",
  onIndigo: "#FFFFFF",
  card: "#FFFFFF",
  border: "#D9DFE8",
  borderStrong: "#BEC7D4",
  success: "#16866B",
  warning: "#C98218",
  error: "#C94758",
  muted: "#6B778A",
};

// Dark mode is intentionally softened to a light-first presentation for now.
// The previous dark palette created too much contrast and made cards/buttons
// feel disconnected. Keeping both modes on the same premium neutral system
// gives the product one coherent visual language until a dedicated dark
// design is introduced across every screen.
export const DARK_COLORS = LIGHT_COLORS;

// Backward-compatible static export — light palette, used by any file not
// yet wired into ThemeContext. Prefer `useTheme().colors` in new/updated code.
export const COLORS = LIGHT_COLORS;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 };
export const FONT = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 };

export const FONT_DISPLAY = "Lexend, -apple-system, sans-serif";

export type ThemeColors = typeof LIGHT_COLORS;
