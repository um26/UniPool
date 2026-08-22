import React, { useEffect, useRef, useState } from "react";
import { View, Platform, StyleSheet } from "react-native";

const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAEW9d6UO_KrklE2M";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, opts: Record<string, any>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile "I'm not a robot" widget. Web-only (no native SDK),
 * and a no-op if EXPO_PUBLIC_TURNSTILE_SITE_KEY isn't set — so it's safe to
 * drop in ahead of the Cloudflare site being configured.
 */
export default function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey?: any }) {
  const containerId = useRef(`turnstile-${Math.random().toString(36).slice(2)}`).current;
  const widgetId = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId.current = window.turnstile.render(`#${containerId}`, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => {
            console.warn("Turnstile verification widget reported an error");
            onToken(null);
          },
        });
        setReady(true);
      })
      .catch((error) => {
        console.warn("Turnstile could not load or render", error);
      });
    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current) {
        try { window.turnstile.remove(widgetId.current); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (ready && window.turnstile && widgetId.current) {
      try { window.turnstile.reset(widgetId.current); } catch {}
      onToken(null);
    }
  }, [resetKey]);

  if (Platform.OS !== "web" || !TURNSTILE_SITE_KEY) return null;

  return (
    <View style={styles.wrap}>
      <View nativeID={containerId} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: 16 },
});
