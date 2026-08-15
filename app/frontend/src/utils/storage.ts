import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Cross-platform key/value storage.
 * - Native (iOS/Android): uses expo-secure-store (encrypted).
 * - Web: expo-secure-store isn't supported, falls back to localStorage.
 */
async function secureGet(key: string, fallback: any = null): Promise<any> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return fallback;
      const v = window.localStorage.getItem(key);
      return v ?? fallback;
    }
    const v = await SecureStore.getItemAsync(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // no-op — worst case the user has to sign in again
  }
}

async function secureRemove(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // no-op
  }
}

export const storage = { secureGet, secureSet, secureRemove };
