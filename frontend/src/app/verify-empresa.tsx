import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function VerifyEmpresaScreen() {
  const router = useRouter();
  const { ws, token } = useLocalSearchParams<{ ws: string; token: string }>();
  const { apiFetch } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ws || !token) {
      setStatus("error");
      setMessage("Link de verificação inválido.");
      return;
    }
    (async () => {
      try {
        const r = await apiFetch(`/api/workspaces/${ws}/verify-email/confirm`, {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (r.ok) {
          setStatus("success");
          setMessage("Email confirmado com sucesso! A tua empresa já pode criar anúncios.");
        } else {
          const err = await r.json().catch(() => ({}));
          setStatus("error");
          setMessage(err.detail || "Falha ao confirmar o email. O link pode ter expirado.");
        }
      } catch {
        setStatus("error");
        setMessage("Erro de rede ao tentar confirmar o email.");
      }
    })();
  }, [ws, token]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.title}>A VERIFICAR...</Text>
            <Text style={styles.sub}>A confirmar o teu email de faturação.</Text>
          </>
        )}

        {status === "success" && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.aprovo }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.text} />
            </View>
            <Text style={styles.title}>EMAIL CONFIRMADO ✅</Text>
            <Text style={styles.sub}>{message}</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.push("/workspaces")}
            >
              <Text style={styles.btnText}>VOLTAR ÀS EMPRESAS</Text>
            </TouchableOpacity>
          </>
        )}

        {status === "error" && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.desaprovo }]}>
              <Ionicons name="close-circle" size={48} color={colors.bg} />
            </View>
            <Text style={styles.title}>VERIFICAÇÃO FALHOU ❌</Text>
            <Text style={styles.sub}>{message}</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.push("/workspaces")}
            >
              <Text style={styles.btnText}>VOLTAR ÀS EMPRESAS</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 32,
    alignItems: "center",
    gap: 16,
    ...brutalShadow,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text, textAlign: "center" },
  sub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.text,
    ...brutalShadow,
  },
  btnText: { fontSize: 13, fontWeight: "900", letterSpacing: 2, color: colors.textInverse },
});
