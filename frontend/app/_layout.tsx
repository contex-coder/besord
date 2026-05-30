import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { storage } from "@/src/utils/storage";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboardedChecked, setOnboardedChecked] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const v = await storage.getItem<string>("besord_onboarded", "");
      setOnboarded(v === "1");
      setOnboardedChecked(true);
    })();
  }, [user?.user_id]);

  useEffect(() => {
    if (loading || !onboardedChecked) return;
    const first = segments[0];
    const inTabs = first === "(tabs)";
    const inOnboarding = first === "onboarding";
    const inLegal = first === "legal";
    if (user) {
      if (!onboarded && !inOnboarding) {
        router.replace("/onboarding");
      } else if (onboarded && !inTabs && !inLegal && first !== "business" && first !== "admin" && first !== "word") {
        router.replace("/(tabs)/feed");
      }
    } else if (inTabs || first === "business" || first === "admin") {
      router.replace("/");
    }
  }, [user, loading, segments, router, onboarded, onboardedChecked]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }} />
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
