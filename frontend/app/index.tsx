import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function Landing() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) router.replace("/(tabs)/feed");
  }, [user, loading, router]);

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
          <View style={styles.logoBadge} testID="brand-badge">
            <Text style={styles.logoBadgeText}>MVP</Text>
          </View>
          <Text style={styles.brand}>BESORD</Text>
          <Text style={styles.tagline}>UMA IMAGEM.{"\n"}UMA PALAVRA.{"\n"}UM VEREDITO.</Text>
        </View>

        <View style={styles.previewBlock}>
          <View style={styles.previewCard}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1721697989507-fed0b42bb453?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwxfHxzdHJlZXR3ZWFyJTIwb3V0Zml0JTIwbWlycm9yJTIwc2VsZmllfGVufDB8fHx8MTc4MDE1MzkzOHww&ixlib=rb-4.1.0&q=85" }}
              style={styles.previewImage}
            />
            <View style={styles.wordOverlay}>
              <Text style={styles.wordOverlayText}>DRIP</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            testID="btn-login-google"
            style={styles.googleBtn}
            onPress={signIn}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={22} color={colors.text} />
            <Text style={styles.googleBtnText}>ENTRAR COM GOOGLE</Text>
          </TouchableOpacity>
          <Text style={styles.legal}>AO ENTRAR VOCÊ CONCORDA COM AS REGRAS DA COMUNIDADE.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, justifyContent: "space-between" },
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
  tagline: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 12, lineHeight: 26, letterSpacing: -0.5 },
  previewBlock: { alignItems: "center", justifyContent: "center" },
  previewCard: { width: 240, aspectRatio: 4 / 5, borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bgSubtle, ...brutalShadow },
  previewImage: { width: "100%", height: "100%" },
  wordOverlay: {
    position: "absolute",
    bottom: -14,
    left: 12,
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    ...brutalShadow,
  },
  wordOverlayText: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
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
  googleBtnText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  legal: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, textAlign: "center", letterSpacing: 1, marginTop: 4 },
});
