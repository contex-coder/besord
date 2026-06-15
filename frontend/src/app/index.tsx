
import React, { useEffect, useRef } from "react";
import { Dimensions, ScrollView } from "react-native";
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
function MascotVideo({ size }: { size: number }) {
  return (
    <Image
      source={require("@/assets/images/NewBesord.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
import * as AppleAuthentication from "expo-apple-authentication";

import { useAuth, AuthError as AuthErrorType } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { t } from "@/src/i18n";
import { storage } from "@/src/utils/storage";
import { onboardingState } from "@/src/utils/onboardingState";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_SMALL = SCREEN_W < 380;
const MASCOT_SIZE = Math.min(SCREEN_W * 0.7, 320);

const AuthError = ({ error, onClear }: { error: AuthErrorType, onClear: () => void }) => (
  <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.desaprovo} />
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
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!loading && user && !hasNavigated.current) {
      hasNavigated.current = true;
      (async () => {
        if (!user.age_confirmed) {
          router.replace("/age-gate");
          return;
        }
        const onboarded = onboardingState.get() || !!(await storage.getItem("besord_onboarded", null));
        if (!onboarded) {
          router.replace("/onboarding");
          return;
        }
        router.replace("/account-type");
      })();
    }
  }, [user, loading]);

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <MascotVideo size={MASCOT_SIZE} />
          <Text style={styles.brand}>BESORD</Text>
          <Text style={styles.tagline}>
            {t("tagline_1")}
          </Text>
        </View>

        <View style={styles.midSection}>
          <View style={styles.langRow}>
            {["PT", "EN", "FR", "DE", "ZH"].map((l) => (
              <View key={l} style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.description}>
            {t("tagline_2")}
          </Text>
          <Text style={styles.description}>
            {t("tagline_3")}
          </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: 24,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },

  // Hero com mascote enorme
  heroSection: {
    alignItems: "center",
    paddingTop: Platform.OS === "web" ? 60 : 30,
    paddingHorizontal: 12,
    gap: 6,
  },
  mascot: {},
  brand: {
    fontSize: IS_SMALL ? 40 : 52,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -1,
    marginTop: 2,
  },
  tagline: {
    fontSize: IS_SMALL ? 18 : 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    letterSpacing: 0,
    marginTop: 2,
  },

  // Meio
  midSection: {
    paddingHorizontal: 30,
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  langRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },
  description: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Botoes
  actions: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 10,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  appleBtn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  emailBtn: {
    backgroundColor: colors.bg,
  },
  btnText: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
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
    borderColor: colors.border,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  errorMessage: {
    textAlign: 'center',
    color: colors.text,
  },
  errorButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.text,
  },
  errorButtonText: {
    color: colors.textInverse,
    fontWeight: 'bold',
  },
});
