
import React, { useEffect, useState } from "react";
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

import { useAuth, AuthError as AuthErrorType } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { t } from "@/src/i18n";

// Mascot image hosted on Besord CDN
const BEETLE_URL =
  "https://besord.vercel.app/assets/mascot-beetle.png";

const AuthError = ({ error, onClear }: { error: AuthErrorType, onClear: () => void }) => (
  <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.reprovo} />
      <Text style={styles.errorTitle}>Authentication Failed</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <TouchableOpacity style={styles.errorButton} onPress={onClear}>
          <Text style={styles.errorButtonText}>Try Again</Text>
      </TouchableOpacity>
  </View>
);

export default function Landing() {
  const { user, loading, error, clearError, signIn, signInWithApple } = useAuth();
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
            <Text style={styles.logoBadgeText}>PT-EN-FR-DE-ZH</Text>
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
          {error ? (
            <AuthError error={error} onClear={clearError} />
          ) : (
            <>
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
              <TouchableOpacity
                testID="btn-login-email"
                style={[styles.googleBtn, styles.emailBtn]}
                onPress={() => router.push("/login-email")}
                activeOpacity={0.85}
              >
                <Ionicons name="mail-outline" size={22} color={colors.text} />
                <Text style={styles.btnText}>EMAIL / PALAVRA-PASSE</Text>
              </TouchableOpacity>
            </>
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
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  logoBlock: {
    paddingHorizontal: 20,
    gap: 12,
  },
  logoBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.aprovo,
    borderRadius: 4,
  },
  logoBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textInverse,
    letterSpacing: 1,
  },
  brand: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.text,
    lineHeight: 42,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    lineHeight: 20,
  },
  heroMascot: {
    alignItems: "center",
    justifyContent: "center",
    height: 240,
  },
  mascot: {
    width: 240,
    height: 240,
  },
  actions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
  },
  appleBtn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  emailBtn: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 0.5,
  },
  legal: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    alignItems: "center",
  },
  legalLink: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
  legalDot: {
    color: "#999",
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.reprovo,
    borderRadius: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.reprovo,
  },
  errorMessage: {
    textAlign: 'center',
    color: colors.text,
  },
  errorButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.reprovo,
    borderRadius: 8,
  },
  errorButtonText: {
    color: colors.textInverse,
    fontWeight: 'bold',
  },
});
