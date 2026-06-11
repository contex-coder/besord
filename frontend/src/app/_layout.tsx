import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { track } from "@/src/utils/analytics";
import { storage } from "@/src/utils/storage";

// Oculta a Splash automaticamente na Web para evitar bloqueios de renderização
if (Platform.OS === 'web') {
  SplashScreen.hideAsync();
} else {
  SplashScreen.preventAutoHideAsync();
}

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }} />
  );
}

function AnalyticsInit() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.user_id) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `besord_app_opened_${today}`;
    storage.getItem(key, null).then((seen) => {
      if (!seen) {
        track("app_opened", user.user_id, { date: today });
        storage.setItem(key, "1");
      }
    });
  }, [user?.user_id]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AnalyticsInit />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}