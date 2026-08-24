export const LIGHT_COLORS = {
  surface: "#F7F8FC",
  onSurface: "#172033",
  surface2: "#EEF1F6",
  surface3: "#E5EAF2",
  onSurface2: "#475467",
  indigo: "#3155D9",
  saffron: "#F4A62A",
  cream: "#FFF3D6",
  onCream: "#815200",
  onIndigo: "#FFFFFF",
  card: "#FFFFFF",
  border: "#D9E0EA",
  borderStrong: "#B7C3D3",
  success: "#169B72",
  warning: "#D97706",
  error: "#D92D3F",
  muted: "#667085",
};

export const DARK_COLORS = {
  // Deliberately neutral/blue-black rather than purple-black: this keeps
  // white cards, controls and headers readable without looking washed out.
  surface: "#0B1220",
  onSurface: "#F4F7FB",
  surface2: "#111B2B",
  surface3: "#17243A",
  onSurface2: "#C5D0E0",
  indigo: "#82A4FF",
  saffron: "#FFB84D",
  cream: "#2A2418",
  onCream: "#FFD88A",
  onIndigo: "#081326",
  card: "#121E30",
  border: "#293A53",
  borderStrong: "#3D5270",
  success: "#45D4A2",
  warning: "#FFC45C",
  error: "#FF7482",
  muted: "#9AAAC0",
};

export const COLORS = LIGHT_COLORS;
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 };
export const FONT = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 };
export const FONT_DISPLAY = "Lexend, -apple-system, sans-serif";
export type ThemeColors = typeof LIGHT_COLORS;
