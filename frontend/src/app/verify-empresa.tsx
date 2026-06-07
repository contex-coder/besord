import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function VerifyEmpresaScreen() {
  const router = useRouter();
  const { ws, token } = useLocalSearchParams<{ ws: string; token: string }>();
  const { apiFetch } = useAuth();
  const [status, setStatus] = useState<"loading" | "consent" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [marketingConsent, setMarketingConsent] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!ws || !token) {
      setStatus("error");
      setMessage("Link de verificação inválido.");
      return;
    }
    // Show consent screen first — only after user clicks confirm we call the API
    setStatus("consent");
  }, [ws, token]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const r = await apiFetch(`/api/workspaces/${ws}/verify-email/confirm`, {
        method: "POST",
        body: JSON.stringify({
          token,
          marketing_consent: marketingConsent,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.already_verified) {
          setStatus("success");
          setMessage("Esta empresa já estava verificada. Podes criar anúncios.");
        } else {
          setStatus("success");
          if (marketingConsent === true) {
            setMessage("Email confirmado com sucesso! Agora vais receber notificações de campanhas e novidades.");
          } else if (marketingConsent === false) {
            setMessage("Email confirmado com sucesso! Apenas receberás comunicações obrigatórias (faturação).");
          } else {
            setMessage("Email confirmado com sucesso! A tua empresa já pode criar anúncios.");
          }
        }
      } else {
        const err = await r.json().catch(() => ({}));
        setStatus("error");
        setMessage(err.detail || "Falha ao confirmar o email. O link pode ter expirado.");
      }
    } catch {
      setStatus("error");
      setMessage("Erro de rede ao tentar confirmar o email.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={colors.text} />
            <Text style={styles.title}>A VERIFICAR...</Text>
            <Text style={styles.sub}>A preparar a confirmação do teu email.</Text>
          </>
        )}

        {status === "consent" && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.neutral }]}>
              <Ionicons name="mail-unread" size={48} color={colors.text} />
            </View>
            <Text style={styles.title}>CONFIRMAR EMAIL</Text>
            <Text style={styles.sub}>
              Obrigado por criares a tua empresa na Besord. Confirma o teu email de faturação para poderes criar anúncios.
            </Text>

            <View style={styles.consentBox}>
              <Text style={styles.consentTitle}>📬 COMUNICAÇÕES COMERCIAIS</Text>
              <Text style={styles.consentText}>
                A Besord pode enviar-te notificações sobre as tuas campanhas (resultados, metas, relatórios) e, se autorizares, também novidades e ofertas.
              </Text>
              <TouchableOpacity
                style={[styles.consentOption, marketingConsent === true && styles.consentOptionActive]}
                onPress={() => setMarketingConsent(true)}
              >
                <Ionicons
                  name={marketingConsent === true ? "checkbox" : "square-outline"}
                  size={20}
                  color={marketingConsent === true ? colors.text : colors.textSecondary}
                />
                <Text style={styles.consentOptionText}>
                  Sim, aceito receber comunicações sobre campanhas e novidades
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.consentOption, marketingConsent === false && styles.consentOptionActive]}
                onPress={() => setMarketingConsent(false)}
              >
                <Ionicons
                  name={marketingConsent === false ? "checkbox" : "square-outline"}
                  size={20}
                  color={marketingConsent === false ? colors.text : colors.textSecondary}
                />
                <Text style={styles.consentOptionText}>
                  Não, apenas comunicações obrigatórias (faturação, relatórios)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, marketingConsent === null && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={confirming || marketingConsent === null}
            >
              {confirming ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.btnText}>CONFIRMAR EMAIL</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Podes alterar esta preferência a qualquer momento nas definições da empresa.
            </Text>
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
  consentBox: {
    width: "100%",
    borderWidth: 3,
    borderColor: colors.border,
    padding: 14,
    backgroundColor: colors.neutral,
    gap: 10,
  },
  consentTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  consentText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, lineHeight: 16 },
  consentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  consentOptionActive: { backgroundColor: colors.aprovo },
  consentOptionText: { fontSize: 12, fontWeight: "700", color: colors.text, flex: 1 },
  btn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.text,
    ...brutalShadow,
    width: "100%",
    alignItems: "center",
  },
  btnText: { fontSize: 13, fontWeight: "900", letterSpacing: 2, color: colors.textInverse },
  disclaimer: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
});
