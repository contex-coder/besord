import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { AuthProvider } from "@/src/contexts/AuthContext";

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

export default function RootLayout() {
  // Na Web, ignoramos o carregamento de fontes CDN para não travar a renderização estática
  // O Expo Web lida com fontes nativas do sistema ou CSS de forma diferente
  
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}