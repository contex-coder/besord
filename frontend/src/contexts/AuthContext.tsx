
import { env } from "expo/virtual/env";
import * as React from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { storage } from "@/src/utils/storage";

// --- TYPES ---

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
  bw_balance?: number;
  has_business_profile?: boolean;
};

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  finishPasswordAuth: (data: {
    token: string;
    user_id: string;
    email: string;
    name?: string;
  }) => Promise<void>;
  signInWithPassword: (
    email,
    password
  ) => Promise<{ ok: boolean; error?: string }>;
  registerWithPassword: (
    email,
    password,
    name
  ) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email) => Promise<{ ok: boolean; error?: string }>;
};

// --- CONSTANTS ---

const BACKEND_URL = env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "besord_token";

// --- CONTEXT ---

const AuthContext = React.createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// --- HELPERS ---

/**
 * Parse token from URL - works for both query and hash params
 * Handles: ?token=ABC, #token=ABC, &token=ABC
 */
function parseTokenFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    // Try query parameter first
    const urlObj = new URL(url, "http://localhost");
    const token = urlObj.searchParams.get("token");
    if (token) return decodeURIComponent(token);
    
    // Try hash parameter
    const hashMatch = url.match(/#token=([^&]+)/);
    if (hashMatch && hashMatch[1]) return decodeURIComponent(hashMatch[1]);
    
    // Try ampersand separated
    const ampMatch = url.match(/[&?]token=([^&]+)/);
    if (ampMatch && ampMatch[1]) return decodeURIComponent(ampMatch[1]);
  } catch (e) {
    console.warn("parseTokenFromUrl error:", e);
  }
  return null;
}

// --- PROVIDER ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchUser = async (tok: string) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (r.ok) {
        const u = await r.json();
        setUser(u);
        setToken(tok);
        await storage.secureSet(TOKEN_KEY, tok);
        return true;
      } else {
        console.warn("fetchUser: API returned", r.status);
      }
    } catch (e) {
      console.warn("fetchUser failed", e);
    }
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setToken(null);
    return false;
  };

  const handleToken = React.useCallback(
    async (tok: string) => {
      setLoading(true);
      await fetchUser(tok);
      setLoading(false);
    },
    []
  );

  const restoreSession = React.useCallback(async () => {
    const storedToken = await storage.secureGet(TOKEN_KEY, "");
    if (storedToken) {
      await fetchUser(storedToken);
    }
    setLoading(false);
  }, []);

  // Initialize auth on mount
  React.useEffect(() => {
    (async () => {
      // PLATFORM-SPECIFIC INITIALIZATION
      
      if (Platform.OS === "web") {
        // WEB PLATFORM: Get token from URL (query params)
        // This runs on initial page load
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get("token");
        
        if (tokenFromUrl) {
          console.log("✓ Web: Found token in URL, authenticating...");
          await handleToken(tokenFromUrl);
          // Clean URL without reloading
          window.history.replaceState({}, "", "/");
          return;
        }
      } else {
        // NATIVE PLATFORM: Get initial linking URL
        const initialUrl = await Linking.getInitialURL();
        const tokenFromUrl = parseTokenFromUrl(initialUrl);
        
        if (tokenFromUrl) {
          console.log("✓ Native: Found token in initial URL");
          await handleToken(tokenFromUrl);
          return;
        }
      }
      
      // No token in URL, try to restore from storage
      await restoreSession();
    })();

    // NATIVE PLATFORM ONLY: Listen for incoming URLs (deep links)
    if (Platform.OS !== "web") {
      const sub = Linking.addEventListener("url", ({ url }) => {
        console.log("✓ Native: Received deep link", url);
        const tokenFromUrl = parseTokenFromUrl(url);
        if (tokenFromUrl) {
          handleToken(tokenFromUrl);
        }
      });
      return () => sub.remove();
    }
  }, [handleToken, restoreSession]);

  const signIn = React.useCallback(async () => {
    setLoading(true);
    try {
      let redirectUrl = "";
      
      if (Platform.OS === "web") {
        // WEB: Use absolute URL with /auth/callback
        redirectUrl = `${window.location.origin}/auth/callback`;
      } else {
        // NATIVE: Use deep link
        redirectUrl = Linking.createURL("auth/callback");
      }

      const authUrl = `${BACKEND_URL}/api/auth/google/login?redirect_uri=${encodeURIComponent(
        redirectUrl
      )}`;

      console.log("🔐 Sign In - Auth URL:", authUrl);
      console.log("🔐 Sign In - Redirect URL:", redirectUrl);

      if (Platform.OS === "web") {
        // WEB: Full page navigation
        window.location.href = authUrl;
        // Code after this won't execute due to page reload
      } else {
        // NATIVE: Use WebBrowser for OAuth flow
        const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (res.type === "success" && res.url) {
          const tokenFromUrl = parseTokenFromUrl(res.url);
          if (tokenFromUrl) {
            await handleToken(tokenFromUrl);
          } else {
            console.error("❌ No token found in browser callback URL:", res.url);
          }
        } else {
          console.warn("Browser session closed or failed", res.type);
        }
      }
    } catch (e) {
      console.error("Sign in error:", e);
    } finally {
      setLoading(false);
    }
  }, [handleToken]);

  const signOut = React.useCallback(async () => {
    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, [token]);

  const signInWithApple = React.useCallback(async () => {
    if (Platform.OS !== "ios") {
      console.warn("Apple authentication only available on iOS");
      return;
    }
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Send credential to backend
      const response = await fetch(`${BACKEND_URL}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          user_identifier: credential.user,
          email: credential.email,
          full_name:
            credential.fullName?.givenName &&
            credential.fullName?.familyName
              ? `${credential.fullName.givenName} ${credential.fullName.familyName}`
              : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await handleToken(data.token);
      } else {
        console.error("Apple auth backend error:", response.status);
      }
    } catch (e: any) {
      if (e.code === "ERR_CANCELED") {
        console.log("User canceled Apple Sign In");
      } else {
        console.error("Apple authentication error:", e);
      }
    } finally {
      setLoading(false);
    }
  }, [handleToken]);

  const apiFetch = React.useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers = {
        "Content-Type": "application/json",
        ...init.headers,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const r = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });

      if (r.status === 401) {
        await signOut();
      }
      return r;
    },
    [token, signOut]
  );

  // Dummy implementations for password auth until ready
  const finishPasswordAuth = async (data) => {};
  const signInWithPassword = async (email, password) => ({
    ok: false,
    error: "Not implemented",
  });
  const registerWithPassword = async (email, password, name) => ({
    ok: false,
    error: "Not implemented",
  });
  const requestPasswordReset = async (email) => ({
    ok: false,
    error: "Not implemented",
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signInWithApple,
        signOut,
        refreshUser: restoreSession,
        apiFetch,
        finishPasswordAuth,
        signInWithPassword,
        registerWithPassword,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
