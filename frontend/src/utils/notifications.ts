import { Platform } from "react-native";

const NOTIFICATIONS_ENABLED_KEY = "besord_notifications_enabled";
const PUSH_TOKEN_KEY = "besord_push_token";

/**
 * Storage wrapper que funciona em web e mobile.
 */
const localStore = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        return window.localStorage.getItem(key);
      }
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
        return;
      }
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  secureSet: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
        return;
      }
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  secureGet: async (key: string, defaultValue: string): Promise<string> => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        return window.localStorage.getItem(key) || defaultValue;
      }
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const val = await AsyncStorage.getItem(key);
      return val || defaultValue;
    } catch {
      return defaultValue;
    }
  },
};

/**
 * Regista o dispositivo para receber notificações push.
 * Web: usa Notification API. Mobile: usa expo-notifications (fallback seguro).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await registerWebPush();
    } else {
      return await registerMobilePush();
    }
  } catch (e) {
    console.warn("registerForPushNotifications error:", e);
    return null;
  }
}

export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const stored = await localStore.getItem(NOTIFICATIONS_ENABLED_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await localStore.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
}

// ─── WEB PUSH ───

async function registerWebPush(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Web Push não suportado neste browser.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Permissão de notificação negada.");
    return null;
  }

  await setNotificationsEnabled(true);
  if (!("serviceWorker" in navigator)) {
    return "web_notification_only";
  }

  try {
    await navigator.serviceWorker.ready;
    return "web_notification_ready";
  } catch {
    return "web_notification_only";
  }
}

// ─── MOBILE PUSH ───

async function registerMobilePush(): Promise<string | null> {
  try {
    let expoNotifications: any;
    try {
      expoNotifications = await import("expo-notifications");
    } catch {
      console.warn("expo-notifications not installed.");
      await setNotificationsEnabled(true);
      return "push_not_available";
    }

    const { getExpoPushTokenAsync, requestPermissionsAsync } = expoNotifications;

    const perm = await requestPermissionsAsync();
    if (!perm.granted) {
      console.warn("Permissão de notificação negada no mobile.");
      return null;
    }

    const tokenData = await getExpoPushTokenAsync();
    const token = tokenData.data;

    if (token) {
      await localStore.secureSet(PUSH_TOKEN_KEY, token);
      await setNotificationsEnabled(true);
      return token;
    }
    return null;
  } catch (e) {
    console.warn("Mobile push registration error:", e);
    await setNotificationsEnabled(true);
    return "push_error";
  }
}

/**
 * Envia o token push para o backend.
 */
export async function syncPushTokenToBackend(
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
): Promise<void> {
  try {
    const token = await localStore.secureGet(PUSH_TOKEN_KEY, "");
    if (!token) return;

    await apiFetch("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ push_token: token, platform: Platform.OS }),
    });
  } catch (e) {
    console.warn("syncPushTokenToBackend error:", e);
  }
}

/**
 * Mostra uma notificação local.
 */
export async function showLocalNotification(title: string, body: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.png" });
      }
    } else {
      let expoNotifications: any;
      try {
        expoNotifications = await import("expo-notifications");
      } catch {
        console.warn("expo-notifications not installed.");
        return;
      }
      const { scheduleNotificationAsync } = expoNotifications;
      await scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      } as any);
    }
  } catch (e) {
    console.warn("showLocalNotification error:", e);
  }
}
