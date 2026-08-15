import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";

/**
 * Preloads the Ionicons font (used throughout the app) so icons don't
 * flash as missing glyphs on first render. Returns [loaded, error] just
 * like the underlying useFonts hook.
 */
export function useIconFonts() {
  return useFonts({
    ...Ionicons.font,
  });
}
