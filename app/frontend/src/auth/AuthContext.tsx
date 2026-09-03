import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { api, getToken, setToken } from "@/src/api/client";
import { collegeSignupApi, CollegeSignupChallenge } from "@/src/api/collegeSignup";
import { storage } from "@/src/utils/storage";

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
  signingIn: boolean;
  signInError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  renderGoogleButton: (containerId: string) => void;
  signInWithPassword: (identifier: string, password: string, turnstileToken?: string | null) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) => Promise<void>;
  startCollegeSignup: (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) => Promise<CollegeSignupChallenge>;
  confirmCollegeSignup: (challengeId: string, code: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const USER_CACHE_KEY = "unipool.cached_user.v1";

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
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In script")), { once: true });
      return;
    }
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

async function cacheUser(next: UniUser | null) {
  if (next) await storage.secureSet(USER_CACHE_KEY, JSON.stringify(next));
  else await storage.secureRemove(USER_CACHE_KEY);
}

async function readCachedUser(): Promise<UniUser | null> {
  const raw = await storage.secureGet(USER_CACHE_KEY, null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.user_id && parsed?.email ? parsed as UniUser : null;
  } catch {
    await storage.secureRemove(USER_CACHE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UniUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const applySession = useCallback(async (sessionToken: string, nextUser: UniUser) => {
    await Promise.all([setToken(sessionToken), cacheUser(nextUser)]);
    setUser(nextUser);
  }, []);

  const handleCredential = useCallback(async (response: { credential: string }) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await api.googleSignIn(response.credential);
      await applySession(res.session_token, res.user);
    } catch (e: any) {
      console.warn("Google sign-in failed", e);
      setSignInError(
        e?.message === "Failed to fetch" || e?.name === "TypeError"
          ? "The UniPool server is still waking up. Please try once more in a few seconds."
          : e?.message || "Sign-in failed. Please try again."
      );
    } finally {
      setSigningIn(false);
    }
  }, [applySession]);

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
      await cacheUser(u);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        setUser(null);
        await Promise.all([setToken(null), cacheUser(null)]);
      } else {
        console.warn("Session validation deferred; keeping cached session", e);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [token, cached] = await Promise.all([getToken(), readCachedUser()]);
      if (!active) return;
      if (token && cached) setUser(cached);
      setLoading(false);

      api.wakeBackend().catch(() => {});
      initGoogle().catch((e) => console.warn("Google script failed to load", e));

      if (token) refresh();
    })();
    return () => { active = false; };
  }, [initGoogle, refresh]);

  const signIn = useCallback(async () => {
    if (Platform.OS !== "web") {
      console.warn("Google sign-in is currently only wired up for web.");
      return;
    }
    await initGoogle();
    if (window.google?.accounts?.id) window.google.accounts.id.prompt();
  }, [initGoogle]);

  const renderGoogleButton = useCallback((containerId: string) => {
    if (Platform.OS !== "web") return;
    initGoogle().then(() => {
      const el = document.getElementById(containerId);
      if (el && window.google?.accounts?.id) {
        el.innerHTML = "";
        window.google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
          width: 280,
        });
      }
    }).catch(() => {});
  }, [initGoogle]);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch {}
    await Promise.all([setToken(null), cacheUser(null)]);
    setUser(null);
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
      await applySession(res.session_token, res.user);
    } catch (e: any) {
      setSignInError(e?.message || "Sign-in failed. Please check your details and try again.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, [applySession]);

  const signUpWithPassword = useCallback(async (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await api.emailSignup(email, password, name, username, turnstileToken);
      await applySession(res.session_token, res.user);
    } catch (e: any) {
      setSignInError(e?.message || "Couldn't create your account. Please try again.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, [applySession]);

  const startCollegeSignup = useCallback(async (email: string, password: string, name: string, username?: string, turnstileToken?: string | null) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      return await collegeSignupApi.start({ email, password, name, username, turnstile_token: turnstileToken });
    } catch (e: any) {
      setSignInError(e?.message || "Couldn't send the college verification code. Please try again.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const confirmCollegeSignup = useCallback(async (challengeId: string, code: string) => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await collegeSignupApi.confirm(challengeId, code);
      await applySession(res.session_token, res.user);
    } catch (e: any) {
      setSignInError(e?.message || "Couldn't verify that code. Please try again.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, [applySession]);

  return (
    <Ctx.Provider value={{
      user, loading, signingIn, signInError, signIn, signOut, refresh, renderGoogleButton,
      signInWithPassword, signUpWithPassword, startCollegeSignup, confirmCollegeSignup,
    }}>
      {children}
    </Ctx.Provider>
  );
}
