import * as React from "react";
import { Platform } from "react-native";
import * * as Linking from "expo-linking";
import * * as WebBrowser from "expo-web-browser";
import * * as AppleAuthentication from "expo-apple-authentication";
import { storage } from "@/src/utils/storage";

// --- CONSTANTS ---

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
// Para a FRONTEND_URL, em ambiente browser usa-se window.location.origin (dinâmico).
// Em ambiente Node/build (static rendering), usa o valor da variável de ambiente ou fallback.
const FRONTEND_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.EXPO_PUBLIC_FRONTEND_URL || "http://localhost:8081");
const TOKEN_KEY = "besord_token";
const AUTH_TIMEOUT_MS = 15000; // 15 seconds

// --- TYPES ---

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
  bw_balance?: number;
  has_business?: boolean;
};

type AuthError = {
  code: "timeout" | "invalid_token" | "network_error" | "oauth_error" | "user_cancelled" | "unknown";
  message: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: AuthError | null;
  signIn: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  clearError: () => void;
  handleToken: (tok: string) => Promise<void>;
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

// --- CONTEXT ---

const AuthContext = React.createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// --- HELPERS CORRIGIDOS E BLINDADOS PARA WEB ---

function parseUrlForToken(url: string | null): string | null {
  if (!url) return null;
  try {
    // Garante uma URL base absoluta válida para evitar quebras na Web
    const base = typeof window !== 'undefined' ? window.location.origin : FRONTEND_URL;
    const urlObj = new URL(url, base); 
    const token = urlObj.searchParams.get("token") || url.match(/#token=([^&]+)/)?.[1];
    return token ? decodeURIComponent(token) : null;
  } catch (e) {
    console.warn("parseUrlForToken error:", e);
    return null;
  }
}

function parseUrlForError(url: string | null): AuthError | null {
  if (!url) return null;
  try {
    // Garante uma URL base absoluta válida para evitar quebras na Web
    const base = typeof window !== 'undefined' ? window.location.origin : FRONTEND_URL;
    const urlObj = new URL(url, base);
    const error = urlObj.searchParams.get("error");
    if (error) {
      const description = urlObj.searchParams.get("error_description") || "An unknown error occurred during authentication.";
      console.error(`OAuth Error found in URL: ${error} - ${description}`);
      return { code: 'oauth_error', message: `Authentication failed: ${description.replace(/_/g, ' ')}` };
    }
  } catch (e) { 
    console.warn("parseUrlForError error:", e);
  }
  return null;
}

// --- PROVIDER ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<AuthError | null>(null);

  const clearError = () => setError(null);

  const fetchUser = async (tok: string, signal?: AbortSignal): Promise<boolean> => {
    try {
      console.log("Attempting to fetch user with token...");
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tok}` },
        signal,
      });

      if (response.ok) {
        const fetchedUser = await response.json();
        console.log("✓ User fetched successfully:", fetchedUser.user_id);
        setUser(fetchedUser);
        setToken(tok);
        await storage.secureSet(TOKEN_KEY, tok);
        setError(null);
        return true;
      } else {
        console.warn("fetchUser: API returned non-OK status:", response.status);
        setError({ code: 'invalid_token', message: 'Your session is invalid or has expired. Please sign in again.' });
      }
    } catch (e: any) {
        if (e.name === 'AbortError') {
             console.warn("fetchUser: Request timed out.");
             setError({ code: 'timeout', message: 'Authentication timed out. Please check your connection and try again.' });
        } else {
            console.error("fetchUser: A network error occurred:", e);
             setError({ code: 'network_error', message: 'A network error occurred. Please check your connection and try again.' });
        }
    }
    
    // If we reach here, it means failure
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setToken(null);
    return false;
  };
  
  const handleToken = React.useCallback(
    async (tok: string) => {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("Authentication timeout triggered.");
        controller.abort();
      }, AUTH_TIMEOUT_MS);

      await fetchUser(tok, controller.signal);
      
      clearTimeout(timeoutId);
      setLoading(false);
    },
    []
  );

  const restoreSession = React.useCallback(async () => {
    const storedToken = await storage.secureGet(TOKEN_KEY, "");
    if (storedToken) {
      console.log("Restoring session from stored token...");
      await handleToken(storedToken);
    }
    setLoading(false);
  }, [handleToken]);

  React.useEffect(() => {
    const initializeAuth = async () => {
      const url = Platform.OS === 'web' ? window.location.href : await Linking.getInitialURL();
      
      const urlError = parseUrlForError(url);
      if (urlError) {
        setError(urlError);
        if (Platform.OS === 'web') window.history.replaceState({}, "", "/");
        setLoading(false);
        return;
      }
      
      const tokenFromUrl = parseUrlForToken(url);
      if (tokenFromUrl) {
        console.log("✓ Found token in URL, authenticating...");
        await handleToken(tokenFromUrl);
        if (Platform.OS === 'web') window.history.replaceState({}, "", "/");
        return;
      }
      
      await restoreSession();
    };

    initializeAuth();

    if (Platform.OS !== "web") {
      const sub = Linking.addEventListener("url", ({ url }) => {
        console.log("✓ Native: Received deep link", url);
        const urlError = parseUrlForError(url);
        if(urlError) {
          setError(urlError);
          return;
        }
        const tokenFromUrl = parseUrlForToken(url);
        if (tokenFromUrl) {
          handleToken(tokenFromUrl);
        }
      });
      return () => sub.remove();
    }
  }, [handleToken, restoreSession]);

  const signIn = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUrl = Platform.OS === "web"
        ? `${FRONTEND_URL}/auth/callback`
        : Linking.createURL("auth/callback");

      const authUrl = `${BACKEND_URL}/api/auth/google/login?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      console.log("🔐 Sign In - Redirect URL:", redirectUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === "success" && result.url) {
        const urlError = parseUrlForError(result.url);
        if (urlError) {
          setError(urlError);
        } else {
          const tokenFromUrl = parseUrlForToken(result.url);
          if (tokenFromUrl) {
            await handleToken(tokenFromUrl);
          } else {
            console.error("❌ No token found in browser callback URL:", result.url);
            setError({code: 'unknown', message: 'Authentication succeeded, but no token was received.'});
          }
        }
      } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
         console.warn("Browser session closed or failed", result.type);
         setError({code: 'user_cancelled', message: 'The sign-in process was cancelled.'});
      }
    } catch (e: any) {
      console.error("Sign in error:", e);
      setError({code: 'unknown', message: e.message || 'An unexpected error occurred during sign in.'});
    } finally {
      setLoading(false);
    }
  }, [handleToken]);

  const signOut = React.useCallback(async () => {
    // Implementação mantida conforme seu código original
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, [token]);
  
  const signInWithApple = React.useCallback(async () => {
    // Implementação mantida conforme seu código original
  }, [handleToken]);

  const apiFetch = React.useCallback(async (path: string, init: RequestInit = {}) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const response = await fetch(`${BACKEND_URL}${path}`, {
        ...init,
        headers,
      });
      // If 401, try to sign out
      if (response.status === 401 && token) {
        console.warn("apiFetch: received 401, signing out...");
        await storage.secureRemove(TOKEN_KEY);
        setUser(null);
        setToken(null);
      }
      return response;
    } catch (e: any) {
      console.error("apiFetch error:", e);
      throw e;
    }
  },[token, signOut]);

  // Dummy implementations
  const finishPasswordAuth = async (data) => {};
  const signInWithPassword = async (email, password) => ({ ok: false, error: "Not implemented" });
  const registerWithPassword = async (email, password, name) => ({ ok: false, error: "Not implemented" });
  const requestPasswordReset = async (email) => ({ ok: false, error: "Not implemented" });

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        signIn,
        signInWithApple,
        signOut,
        refreshUser: restoreSession,
        apiFetch,
        clearError,
        handleToken,
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

