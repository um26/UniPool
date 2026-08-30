import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RADIUS } from "@/src/theme";
import { useTheme } from "@/src/theme_context/ThemeContext";
import SocialShareSheet from "@/src/components/SocialShareSheet";
import { gamesV3Api } from "@/src/api/v3";

function gameKey(game: string) { return game.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function scoreFromResult(result: string) { const match = result.match(/\b(\d+)\b/); return match ? Number(match[1]) : 1; }

export default function GameShareButton({ game, result }: { game: string; result: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const url = "https://uni-pool-ruddy.vercel.app/games";
  const text = `${result} on ${game} in UniPool Time-pass. Think you can beat me?`;

  useEffect(() => {
    // This component only renders on a completed/result state across the
    // Time-pass games, so it is the single consistent completion hook.
    gamesV3Api.submitProgress(gameKey(game), scoreFromResult(result), true).catch(() => {});
  }, [game, result]);

  return <>
    <Pressable onPress={() => setOpen(true)} style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface2 }]} accessibilityLabel={`Share ${game} result`}>
      <Ionicons name="share-social-outline" size={16} color={colors.indigo} />
      <Text style={[styles.text, { color: colors.onSurface }]}>Share result</Text>
    </Pressable>
    <SocialShareSheet visible={open} onClose={() => setOpen(false)} payload={{ title: `${game} result`, text, url }} />
  </>;
}

const styles = StyleSheet.create({
  button: { minHeight: 42, paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  text: { fontSize: 11, fontWeight: "800" },
});
