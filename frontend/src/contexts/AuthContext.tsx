import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { storage } from "@/src/utils/storage";
import { EXPO_PUBLIC_BACKEND_URL } from "@env";

const BACKEND_URL = EXPO_PUBLIC_BACKEND_URL as string;
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
  signInWithGoogle: () => Promise<void>;
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

async function fetchUserFromToken(token: string): Promise<User | null> {
  try {
    const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) return await r.json();
    return null;
  } catch {
    return null;
  }
}

function parseTokenFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[#&?]token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback(async (t: string) => {
    setLoading(true);
    const u = await fetchUserFromToken(t);
    if (u) {
      await storage.secureSet(TOKEN_KEY, t);
      setToken(t);
      setUser(u);
    } else {
      await storage.secureRemove(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = await storage.secureGet<string>(TOKEN_KEY, "");
      if (storedToken) {
        await setSession(storedToken);
      } else {
        setLoading(false);
      }
    };

    (async () => {
      const initialUrl = await Linking.getInitialURL();
      const urlToken = parseTokenFromUrl(initialUrl);
      if (urlToken) {
        await setSession(urlToken);
        if (Platform.OS === "web" && typeof window !== "undefined") {
          // Clean up the URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }
      } else {
        await restoreSession();
      }
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      const urlToken = parseTokenFromUrl(url);
      if (urlToken) setSession(urlToken);
    });
    return () => sub.remove();
  }, [setSession]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    const authUrl = `${BACKEND_URL}/api/auth/google/login`;
    
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.location.href = authUrl;
      }
      return;
    }

    try {
      const redirectUrl = Linking.createURL("auth/callback");
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const urlToken = parseTokenFromUrl(result.url);
        if (urlToken) {
          await setSession(urlToken);
        }
      }
    } catch (e) {
      console.warn("Google sign-in failed", e);
    } finally {
      setLoading(false);
    }
  }, [setSession]);

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
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
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
        await setSession(data.token);
      }
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        console.warn("Apple sign-in failed", e);
      }
    }
  }, [setSession]);

  const finishPasswordAuth = useCallback(async (data: { token: string; user_id: string; email: string; name?: string }) => {
    await setSession(data.token);
  }, [setSession]);

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
    <AuthContext.Provider value={{ user, token, loading, signInWithGoogle, signInWithApple, signInWithPassword, registerWithPassword, requestPasswordReset, signOut, refreshUser, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}
