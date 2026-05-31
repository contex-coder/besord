import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { t } from "@/src/i18n";

const BEETLE_URL =
  "https://customer-assets.emergentagent.com/job_image-feedback-app/artifacts/k8o964dp_image_e8c30e18-dee9-4061-a6d7-7a53ae2d2b32.png";

export default function Landing() {
  const { user, loading, signIn, signInWithApple } = useAuth();
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = React.useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/(tabs)/feed");
  }, [user, loading, router]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => {});
    }
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>BETA</Text>
          </View>
          <Text style={styles.brand}>{t("login_title")}</Text>
          <Text style={styles.tagline}>
            {t("tagline_1")}
            {"\n"}
            {t("tagline_2")}
            {"\n"}
            {t("tagline_3")}
          </Text>
        </View>

        <View style={styles.heroMascot}>
          <Image source={{ uri: BEETLE_URL }} style={styles.mascot} resizeMode="contain" />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            testID="btn-login-google"
            style={styles.googleBtn}
            onPress={signIn}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-google" size={22} color={colors.text} />
            <Text style={styles.btnText}>{t("login_google")}</Text>
          </TouchableOpacity>
          {appleAvailable && (
            <TouchableOpacity
              testID="btn-login-apple"
              style={[styles.googleBtn, styles.appleBtn]}
              onPress={signInWithApple}
            >
              <Ionicons name="logo-apple" size={22} color={colors.textInverse} />
              <Text style={[styles.btnText, { color: colors.textInverse }]}>
                {t("login_apple")}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.legal}>{t("legal")}</Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => router.push("/legal?doc=terms")}>
              <Text style={styles.legalLink}>TERMOS</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => router.push("/legal?doc=privacy")}>
              <Text style={styles.legalLink}>PRIVACIDADE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: "space-between",
  },

  logoBlock: { alignItems: "flex-start" },
  logoBadge: {
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    ...brutalShadow,
  },
  logoBadgeText: { fontWeight: "900", fontSize: 12, letterSpacing: 2, color: colors.text },
  brand: { fontSize: 72, fontWeight: "900", letterSpacing: -2, color: colors.text, lineHeight: 72 },
  tagline: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    marginTop: 12,
    lineHeight: 26,
    letterSpacing: -0.5,
  },

  heroMascot: { alignItems: "center", justifyContent: "center", flex: 1 },
  mascot: { width: 320, height: 320, maxWidth: "100%", maxHeight: "100%" },

  actions: { gap: 12 },
  googleBtn: {
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...brutalShadow,
  },
  appleBtn: { backgroundColor: colors.text },
  btnText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  legal: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 4,
  },
  legalLinks: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 4 },
  legalLink: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
    textDecorationLine: "underline",
  },
  legalDot: { color: colors.textSecondary, fontWeight: "900" },
});
