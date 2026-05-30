import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { t } from "@/src/i18n";

const { width: SCREEN_W } = Dimensions.get("window");

function FlyingBeetle({ emoji, size, startDelay }: { emoji: string; size: number; startDelay: number }) {
  const x = useSharedValue(-60);
  const y = useSharedValue(0);
  const r = useSharedValue(-15);
  const flap = useSharedValue(1);

  useEffect(() => {
    x.value = withDelay(startDelay, withRepeat(withTiming(SCREEN_W + 60, { duration: 7000, easing: Easing.linear }), -1, false));
    y.value = withDelay(startDelay, withRepeat(withSequence(
      withTiming(20, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      withTiming(-20, { duration: 800, easing: Easing.inOut(Easing.quad) }),
    ), -1, true));
    r.value = withDelay(startDelay, withRepeat(withSequence(
      withTiming(15, { duration: 400 }),
      withTiming(-15, { duration: 400 }),
    ), -1, true));
    flap.value = withRepeat(withSequence(
      withTiming(1.15, { duration: 90 }),
      withTiming(0.92, { duration: 90 }),
    ), -1, true);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${r.value}deg` },
      { scaleY: flap.value },
    ],
  }));

  return (
    <Animated.Text style={[styles.beetle, { fontSize: size }, style]} pointerEvents="none">
      {emoji}
    </Animated.Text>
  );
}

export default function Landing() {
  const { user, loading, signIn, signInWithApple } = useAuth();
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = React.useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/(tabs)/feed");
  }, [user, loading, router]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Beetles flying across the screen */}
      <View style={styles.beetleStage} pointerEvents="none">
        <View style={{ position: "absolute", top: "30%" }}>
          <FlyingBeetle emoji="🪲" size={56} startDelay={0} />
        </View>
        <View style={{ position: "absolute", top: "48%" }}>
          <FlyingBeetle emoji="🐞" size={44} startDelay={2200} />
        </View>
        <View style={{ position: "absolute", top: "62%" }}>
          <FlyingBeetle emoji="🪲" size={38} startDelay={4500} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>BETA</Text>
          </View>
          <Text style={styles.brand}>{t("login_title")}</Text>
          <Text style={styles.tagline}>{t("tagline_1")}{"\n"}{t("tagline_2")}{"\n"}{t("tagline_3")}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity testID="btn-login-google" style={styles.googleBtn} onPress={signIn} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={22} color={colors.text} />
            <Text style={styles.btnText}>{t("login_google")}</Text>
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity testID="btn-login-apple" style={[styles.googleBtn, styles.appleBtn]} onPress={signInWithApple} activeOpacity={0.85}>
              <Ionicons name="logo-apple" size={22} color={colors.textInverse} />
              <Text style={[styles.btnText, { color: colors.textInverse }]}>{t("login_apple")}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.legal}>{t("legal")}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, justifyContent: "space-between", zIndex: 2 },
  beetleStage: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  beetle: { position: "absolute" },

  logoBlock: { alignItems: "flex-start" },
  logoBadge: {
    backgroundColor: colors.neutral, borderWidth: 3, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8, ...brutalShadow,
  },
  logoBadgeText: { fontWeight: "900", fontSize: 12, letterSpacing: 2, color: colors.text },
  brand: { fontSize: 72, fontWeight: "900", letterSpacing: -2, color: colors.text, lineHeight: 72 },
  tagline: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 12, lineHeight: 26, letterSpacing: -0.5 },

  actions: { gap: 12 },
  googleBtn: {
    backgroundColor: colors.bg, borderWidth: 4, borderColor: colors.border,
    height: 64, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, ...brutalShadow,
  },
  appleBtn: { backgroundColor: colors.text },
  btnText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  legal: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, textAlign: "center", letterSpacing: 1, marginTop: 4 },
});
