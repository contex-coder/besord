import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, brutalShadow } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function AccountTypeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const prev = await storage.getItem("besord_account_type", null);
        if (prev === "personal" || prev === "business") {
          // O feed é o laço principal mesmo para quem tem empresa —
          // "Minhas Empresas" fica acessível a partir do perfil.
          router.replace("/(tabs)/feed");
          return;
        }
      } catch {}
      setChecking(false);
    })();
  }, [router]);

  const choosePersonal = async () => {
    // Marcar que já escolheu
    try { await storage.setItem("besord_account_type", "personal"); } catch {}
    router.replace("/(tabs)/feed");
  };

  const chooseBusiness = async () => {
    try { await storage.setItem("besord_account_type", "business"); } catch {}
    // Redireciona para criar empresa já com o formulário aberto
    router.replace("/workspaces?new=1");
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/NewBesord_free.png")}
          style={styles.beetle}
          resizeMode="contain"
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.greeting}>BEM-VINDO AO</Text>
        <Text style={styles.brand}>BESORD</Text>
        <Text style={styles.subtitle}>ESCOLHE O TEU TIPO DE CONTA</Text>

        <TouchableOpacity style={styles.optionCard} onPress={choosePersonal} testID="btn-personal" activeOpacity={0.85}>
          <View style={[styles.iconWrap, { backgroundColor: colors.neutral }]}>
            <Ionicons name="person" size={36} color={colors.text} />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>CONTA PESSOAL</Text>
            <Text style={styles.optionDesc}>
              Vota em imagens, ganha BW e promove os teus posts. Grátis. Para criadores, curiosos e quem quer testar ideias.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionCard} onPress={chooseBusiness} testID="btn-business" activeOpacity={0.85}>
          <View style={[styles.iconWrap, { backgroundColor: colors.text }]}>
            <Ionicons name="briefcase" size={36} color={colors.textInverse} />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>CONTA EMPRESARIAL</Text>
            <Text style={styles.optionDesc}>
              Cria campanhas pagas com Stripe. Testa nomes, logótipos, embalagens com audiências reais. Relatórios detalhados para a tua empresa.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Podes ter ambas as contas. A conta pessoal é criada automaticamente.{'\n'}
          A empresarial precisa de dados fiscais e verificação.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 10 },
  beetle: { width: 80, height: 80 },
  body: { flex: 1, paddingHorizontal: 20, gap: 16 },
  greeting: { fontSize: 13, fontWeight: "900", letterSpacing: 3, color: colors.textSecondary, textAlign: "center" },
  brand: { fontSize: 42, fontWeight: "900", letterSpacing: -1, color: colors.petrol, textAlign: "center", marginBottom: 16 },
  subtitle: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.text, textAlign: "center", marginBottom: 8 },

  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextWrap: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  optionDesc: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, lineHeight: 16 },

  footer: { padding: 20, alignItems: "center" },
  footerText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, textAlign: "center", lineHeight: 16 },
});
