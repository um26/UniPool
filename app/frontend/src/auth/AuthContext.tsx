import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, getToken, setToken } from "@/src/api/client";

WebBrowser.maybeCompleteAuthSession();

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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

const extractSessionId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UniUser | null>(null);
  const [loading, setLoading] = useState(true);
  const processedSids = useRef<Set<string>>(new Set());

  const processSessionId = useCallback(async (sid: string) => {
    if (processedSids.current.has(sid)) return;
    processedSids.current.add(sid);
    try {
      const res = await api.exchangeSession(sid);
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e) {
      console.warn("session exchange failed", e);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
      await setToken(null);
    }
  }, []);

  // Mount: check URL for session_id, otherwise check stored token
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
          if (sid) {
            await processSessionId(sid);
            try {
              const url = new URL(window.location.href);
              url.hash = "";
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.toString());
            } catch {}
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) {
            await processSessionId(sid);
            setLoading(false);
            return;
          }
        }
        const token = await getToken();
        if (token) await refresh();
      } finally {
        setLoading(false);
      }
    })();

    if (Platform.OS !== "web") {
      const sub = Linking.addEventListener("url", ({ url }) => {
        const sid = extractSessionId(url);
        if (sid) processSessionId(sid);
      });
      return () => sub.remove();
    }
  }, [processSessionId, refresh]);

  const signIn = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.href = authUrl;
      return;
    }
    const capture = { url: null as string | null };
    const sub = Linking.addEventListener("url", ({ url }) => { capture.url = url; });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let sid: string | null = null;
      if (result.type === "success" && (result as any).url) {
        sid = extractSessionId((result as any).url);
      }
      if (!sid) sid = extractSessionId(capture.url);
      if (!sid) sid = extractSessionId(await Linking.getInitialURL());
      if (sid) await processSessionId(sid);
    } finally {
      sub.remove();
    }
  }, [processSessionId]);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
