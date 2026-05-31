import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { storage } from "@/src/utils/storage";
import { onboardingState } from "@/src/utils/onboardingState";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboardedChecked, setOnboardedChecked] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If a fresh value was already set (e.g. user just finished onboarding
      // in this session) prefer that — storage might still be writing.
      const cached = onboardingState.get();
      if (cached !== null) {
        if (!cancelled) {
          setOnboarded(cached);
          setOnboardedChecked(true);
        }
        return;
      }
      const v = await storage.getItem<string>("besord_onboarded", "");
      const isOnboarded = v === "1";
      onboardingState.set(isOnboarded);
      if (!cancelled) {
        setOnboarded(isOnboarded);
        setOnboardedChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.user_id]);

  // Subscribe to the shared onboarding state so finish() in the onboarding
  // screen instantly notifies the navigator (no async storage race).
  useEffect(() => {
    const unsub = onboardingState.subscribe((value) => {
      setOnboarded(value);
      setOnboardedChecked(true);
    });
    return unsub;
  }, []);

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
