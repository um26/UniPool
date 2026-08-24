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
  blood_group?: string | null;
  username?: string | null;
  is_admin?: boolean;
  college_verified?: boolean;
  college_email?: string | null;
  roll_number?: string | null;
  school_name?: string | null;
  degree_level_name?: string | null;
  branch_name?: string | null;
  batch_year?: number | null;
};

type AuthCtx = {
  user: UniUser | null;
  loading: boolean;
  // True while we're mid-way exchanging a Google credential with our backend.
  signingIn: boolean;
  // Set (with a message) if the last sign-in attempt failed. Cleared on next attempt.
  signInError: string | null;
  // On web this opens the Google Sign-In popup itself, so no args needed.
  // Exposed so screens can trigger it from a custom button if desired.
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  // Web-only: mount a Google button into a DOM node.
  renderGoogleButton: (containerId: string) => void;
  // Email/username + password auth.
  signInWithPassword: (identifier: string, password: string, turnstileToken?: string | null) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) => Promise<void>;
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
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleCredential = useCallback(async (response: { credential: string }) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      // Render's free tier can take 30-50s to wake from a cold start —
      // give this real room instead of failing silently and fast.
      const res = await api.googleSignIn(response.credential);
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e: any) {
      console.warn("Google sign-in failed", e);
      setSignInError(
        e?.message === "Failed to fetch" || e?.name === "TypeError"
          ? "Couldn't reach the server. It may be waking up from sleep — please try again in a few seconds."
          : e?.message || "Sign-in failed. Please try again."
      );
    } finally {
      setSigningIn(false);
    }
  }, []);

  const initGoogle = useCallback(async () => {
    if (Platform.OS !== "web" || !GOOGLE_CLIENT_ID) return;
    await loadGoogleScript();
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
      error_callback: (error: any) => {
        console.warn("Google Identity Services error", error);
        setSignInError(
          error?.type === "popup_failed_to_open"
            ? "Google sign-in popup was blocked. Please allow popups for UniPool and try again."
            : "Google sign-in could not start. Please try again."
        );
      },
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
      // Don't let a slow/cold backend block the whole app behind a spinner.
      // Kick off Google's script load (fast, client-side) and unblock
      // rendering immediately — if a saved session exists, validate it in
      // the background and let `user` update whenever it resolves. The
      // login screen already auto-redirects once `user` becomes truthy.
      try {
        await initGoogle();
      } catch (e) {
        console.warn("Google script failed to load (ad-blocker?)", e);
      } finally {
        setLoading(false);
      }
      const token = await getToken();
      if (token) refresh();
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
          // Clear any stale button from a previous mount before re-rendering,
          // otherwise repeated calls can stack duplicate/broken iframes.
          el.innerHTML = "";
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
    // Without this, Google Identity Services silently suppresses the next
    // sign-in attempt (button click / prompt does nothing) because it still
    // thinks there's an active selected session from before.
    if (Platform.OS === "web" && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.cancel();
      } catch {}
    }
  }, []);

  const signInWithPassword = useCallback(async (identifier: string, password: string, turnstileToken?: string | null) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await api.emailLogin(identifier, password, turnstileToken);
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e: any) {
      setSignInError(e?.message || "Sign-in failed. Please check your details and try again.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await api.emailSignup(email, password, name, username, turnstileToken);
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e: any) {
      setSignInError(e?.message || "Couldn't create your account. Please try again.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, signingIn, signInError, signIn, signOut, refresh, renderGoogleButton, signInWithPassword, signUpWithPassword }}>
      {children}
    </Ctx.Provider>
  );
}
