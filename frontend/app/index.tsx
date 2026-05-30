import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Image, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from "react-native-reanimated";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { t } from "@/src/i18n";

const { width: SCREEN_W } = Dimensions.get("window");
const BEETLE_URL = "https://customer-assets.emergentagent.com/job_image-feedback-app/artifacts/k8o964dp_image_e8c30e18-dee9-4061-a6d7-7a53ae2d2b32.png";

function FlyingBesord() {
  const x = useSharedValue(-120);
  const y = useSharedValue(0);
  const r = useSharedValue(-8);
  const s = useSharedValue(1);

  useEffect(() => {
    x.value = withRepeat(withSequence(
      withTiming(SCREEN_W * 0.3, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      withTiming(SCREEN_W * 0.6, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      withTiming(-120, { duration: 1600, easing: Easing.in(Easing.quad) }),
    ), -1, false);
    y.value = withRepeat(withSequence(
      withTiming(15, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      withTiming(-25, { duration: 700, easing: Easing.inOut(Easing.quad) }),
    ), -1, true);
    r.value = withRepeat(withSequence(
      withTiming(10, { duration: 500 }),
      withTiming(-10, { duration: 500 }),
    ), -1, true);
    s.value = withRepeat(withSequence(
      withTiming(1.05, { duration: 250 }),
      withTiming(0.95, { duration: 250 }),
    ), -1, true);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${r.value}deg` }, { scale: s.value }],
  }));

  return (
    <Animated.View style={[styles.flyer, style]} pointerEvents="none">
      <Image source={{ uri: BEETLE_URL }} style={styles.flyerImg} resizeMode="contain" />
    </Animated.View>
  );
}

export default function Landing() {
  const { user, loading, signIn, signInWithApple } = useAuth();
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = React.useState(false);

  useEffect(() => { if (!loading && user) router.replace("/(tabs)/feed"); }, [user, loading, router]);
  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.text} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.heroStage} pointerEvents="none">
        <FlyingBesord />
      </View>

      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <View style={styles.logoBadge}><Text style={styles.logoBadgeText}>BETA</Text></View>
          <Text style={styles.brand}>{t("login_title")}</Text>
          <Text style={styles.tagline}>{t("tagline_1")}{"\n"}{t("tagline_2")}{"\n"}{t("tagline_3")}</Text>
        </View>

        <View style={styles.heroMascot}>
          <Image source={{ uri: BEETLE_URL }} style={styles.mascot} resizeMode="contain" />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity testID="btn-login-google" style={styles.googleBtn} onPress={signIn} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={22} color={colors.text} />
            <Text style={styles.btnText}>{t("login_google")}</Text>
          </TouchableOpacity>
          {appleAvailable && (
            <TouchableOpacity testID="btn-login-apple" style={[styles.googleBtn, styles.appleBtn]} onPress={signInWithApple}>
              <Ionicons name="logo-apple" size={22} color={colors.textInverse} />
              <Text style={[styles.btnText, { color: colors.textInverse }]}>{t("login_apple")}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.legal}>{t("legal")}</Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => router.push("/legal?doc=terms")}><Text style={styles.legalLink}>TERMOS</Text></TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => router.push("/legal?doc=privacy")}><Text style={styles.legalLink}>PRIVACIDADE</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, justifyContent: "space-between", zIndex: 2 },
  heroStage: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  flyer: { position: "absolute", top: "35%", left: 0 },
  flyerImg: { width: 90, height: 90 },

  logoBlock: { alignItems: "flex-start" },
  logoBadge: { backgroundColor: colors.neutral, borderWidth: 3, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8, ...brutalShadow },
  logoBadgeText: { fontWeight: "900", fontSize: 12, letterSpacing: 2, color: colors.text },
  brand: { fontSize: 72, fontWeight: "900", letterSpacing: -2, color: colors.text, lineHeight: 72 },
  tagline: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 12, lineHeight: 26, letterSpacing: -0.5 },

  heroMascot: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  mascot: { width: 200, height: 200 },

  actions: { gap: 12 },
  googleBtn: { backgroundColor: colors.bg, borderWidth: 4, borderColor: colors.border, height: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, ...brutalShadow },
  appleBtn: { backgroundColor: colors.text },
  btnText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  legal: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, textAlign: "center", letterSpacing: 1, marginTop: 4 },
  legalLinks: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 4 },
  legalLink: { fontSize: 11, fontWeight: "900", color: colors.text, letterSpacing: 1, textDecorationLine: "underline" },
  legalDot: { color: colors.textSecondary, fontWeight: "900" },
});
