import { Platform, Text, TextInput } from "react-native";

/**
 * Sets a premium default font (Manrope) across every <Text>/<TextInput> in
 * the app without touching each screen's StyleSheet. On web, Manrope is
 * loaded as a real multi-weight @font-face family (see public/index.html),
 * so existing `fontWeight` values (600/700/800 etc.) continue to resolve to
 * the correct weight file automatically — this is a pure typography upgrade,
 * no other styling changes required.
 */
export function applyPremiumFontDefaults() {
  if (Platform.OS !== "web") return;

  const baseStyle = { fontFamily: "Manrope, -apple-system, sans-serif" };

  // @ts-ignore - defaultProps is legacy but still respected by RN Web
  Text.defaultProps = Text.defaultProps || {};
  // @ts-ignore
  Text.defaultProps.style = [baseStyle, Text.defaultProps.style];

  // @ts-ignore
  TextInput.defaultProps = TextInput.defaultProps || {};
  // @ts-ignore
  TextInput.defaultProps.style = [baseStyle, TextInput.defaultProps.style];
}
