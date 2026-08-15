import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { api, getToken, setToken } from "@/src/api/client";

export type UniUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  gender?: string | null;
  phone?: string | null;
};

type AuthCtx = {
  user: UniUser | null;
  loading: boolean;
  // On web this opens the Google Sign-In popup itself, so no args needed.
  // Exposed so screens can trigger it from a custom button if desired.
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  // Web-only: mount a Google button into a DOM node.
  renderGoogleButton: (containerId: string) => void;
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google?: any;
  }
}

let gsiScriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;
  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In script"));
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UniUser | null>(null);
  const [loading, setLoading] = useState(true);

  const handleCredential = useCallback(async (response: { credential: string }) => {
    try {
      const res = await api.googleSignIn(response.credential);
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e) {
      console.warn("Google sign-in failed", e);
    }
  }, []);

  const initGoogle = useCallback(async () => {
    if (Platform.OS !== "web" || !GOOGLE_CLIENT_ID) return;
    await loadGoogleScript();
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
    });
  }, [handleCredential]);

  const refresh = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
      await setToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initGoogle();
        const token = await getToken();
        if (token) await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [initGoogle, refresh]);

  const signIn = useCallback(async () => {
    if (Platform.OS !== "web") {
      console.warn("Google sign-in is currently only wired up for web.");
      return;
    }
    await initGoogle();
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  }, [initGoogle]);

  const renderGoogleButton = useCallback(
    (containerId: string) => {
      if (Platform.OS !== "web") return;
      initGoogle().then(() => {
        const el = document.getElementById(containerId);
        if (el && window.google?.accounts?.id) {
          window.google.accounts.id.renderButton(el, {
            theme: "outline",
            size: "large",
            width: 280,
          });
        }
      });
    },
    [initGoogle]
  );

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, signIn, signOut, refresh, renderGoogleButton }}>
      {children}
    </Ctx.Provider>
  );
}
