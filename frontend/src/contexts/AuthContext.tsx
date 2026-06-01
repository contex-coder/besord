import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { storage } from "@/src/utils/storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const TOKEN_KEY = "besord_token";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  has_business?: boolean;
  is_admin?: boolean;
  age_confirmed?: boolean;
  birth_year?: number | null;
  bw_balance?: number;
  bw_total_earned?: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerWithPassword: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function exchangeSessionId(sessionId: string): Promise<{ token: string; user: User } | null> {
  try {
    const r = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn("exchangeSessionId failed", e);
    return null;
  }
}

function parseSessionIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  // Support both hash and query
  const hashMatch = url.match(/[#&?]session_id=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    const stored = await storage.secureGet<string>(TOKEN_KEY, "");
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (r.ok) {
        const u = await r.json();
        setUser(u);
        setToken(stored);
      } else {
        await storage.secureRemove(TOKEN_KEY);
      }
    } catch {
      await storage.secureRemove(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSessionId = useCallback(async (sessionId: string) => {
    setLoading(true);
    const result = await exchangeSessionId(sessionId);
    if (result) {
      await storage.secureSet(TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      // Cold start deep link
      const initialUrl = await Linking.getInitialURL();
      const sessionId = parseSessionIdFromUrl(initialUrl);
      if (sessionId) {
        await handleSessionId(sessionId);
        return;
      }
      await restoreSession();
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = parseSessionIdFromUrl(url);
      if (sid) handleSessionId(sid);
    });
    return () => sub.remove();
  }, [handleSessionId, restoreSession]);

  const signIn = useCallback(async () => {
    // CRITICAL: Clear any stale session/token before opening OAuth.
    // This prevents the Emergent OAuth provider from auto-reusing a cached
    // login from a previously-authenticated Google account.
    try {
      await storage.secureRemove(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } catch {}

    const redirectUrl =
      Platform.OS === "web"
        ? (typeof window !== "undefined" ? window.location.origin + "/" : "")
        : Linking.createURL("auth");
    // Add a cache-buster + prompt hint so the provider does NOT auto-reuse a stale session
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}&prompt=select_account&nonce=${nonce}`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.href = authUrl;
      return;
    }

    try {
      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (res.type === "success" && res.url) {
        const sid = parseSessionIdFromUrl(res.url);
        if (sid) await handleSessionId(sid);
      }
    } catch (e) {
      console.warn("signIn failed", e);
    }
  }, [handleSessionId]);

  const signOut = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    await storage.secureRemove(TOKEN_KEY);
    // Defensive: on web, SecureStore falls back to localStorage. Clear every
    // possible place a stale token could survive between page reloads.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
        // expo-secure-store-web prefixes localStorage keys — clean those too.
        Object.keys(window.localStorage)
          .filter((k) => k.includes(TOKEN_KEY) || k.toLowerCase().includes("besord"))
          .forEach((k) => {
            try { window.localStorage.removeItem(k); } catch {}
          });
        window.sessionStorage?.clear();
      } catch {}
    }
    setToken(null);
    setUser(null);
  }, [token]);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
      const r = await fetch(`${BACKEND_URL}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          user_identifier: credential.user,
          email: credential.email,
          full_name: fullName || null,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        await storage.secureSet(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
      }
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        console.warn("Apple sign-in failed", e);
      }
    }
  }, []);

  const finishPasswordAuth = useCallback(async (data: { token: string; user_id: string; email: string; name?: string }) => {
    await storage.secureSet(TOKEN_KEY, data.token);
    setToken(data.token);
    // Fetch the full user object (with bw_balance, is_admin, etc.)
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (r.ok) {
        const u = await r.json();
        setUser(u);
      } else {
        setUser({ user_id: data.user_id, email: data.email, name: data.name || data.email });
      }
    } catch {
      setUser({ user_id: data.user_id, email: data.email, name: data.name || data.email });
    }
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          const detail = body?.detail;
          const msg = typeof detail === "string"
            ? detail
            : (Array.isArray(detail) ? detail.map((e: any) => e?.msg || "").filter(Boolean).join(" · ") : "")
              || "Falha no login.";
          return { ok: false, error: msg };
        }
        const data = await r.json();
        await finishPasswordAuth(data);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message || "Erro de rede." };
      }
    },
    [finishPasswordAuth]
  );

  const registerWithPassword = useCallback(
    async (email: string, password: string, name?: string) => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name || null }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          const detail = body?.detail;
          const msg = typeof detail === "string" ? detail : "Não foi possível criar a conta.";
          return { ok: false, error: msg };
        }
        const data = await r.json();
        await finishPasswordAuth(data);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message || "Erro de rede." };
      }
    },
    [finishPasswordAuth]
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!r.ok) return { ok: false, error: "Falha no pedido." };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Erro de rede." };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const u = await r.json();
        setUser(u);
      }
    } catch {}
  }, [token]);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((init.headers as Record<string, string>) || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
      if (r.status === 401) {
        await storage.secureRemove(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
      return r;
    },
    [token]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signInWithApple, signInWithPassword, registerWithPassword, requestPasswordReset, signOut, refreshUser, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}
