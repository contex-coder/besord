import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

const MIN_AGE = 13;
const CURRENT_YEAR = new Date().getFullYear();

export default function AgeGateScreen() {
  const router = useRouter();
  const { apiFetch, refreshUser, signOut } = useAuth();
  const [birthYear, setBirthYear] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => {
    const n = parseInt(birthYear, 10);
    if (Number.isNaN(n)) return null;
    return n;
  }, [birthYear]);

  const isValid = parsed !== null && parsed >= 1900 && parsed <= CURRENT_YEAR;
  const computedAge = parsed ? CURRENT_YEAR - parsed : null;

  const submit = async () => {
    if (!isValid) {
      Alert.alert("Ano inválido", "Insere um ano de nascimento válido.");
      return;
    }
    if (computedAge !== null && computedAge < MIN_AGE) {
      // Client-side warning; server enforces too.
      Alert.alert(
        "Idade mínima",
        `Para usar Besord, é necessário ter pelo menos ${MIN_AGE} anos.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/auth/confirm-age", {
        method: "POST",
        body: JSON.stringify({ birth_year: parsed }),
      });
      if (r.ok) {
        if (refreshUser) await refreshUser();
        router.replace("/onboarding");
      } else {
        const err = await r.json().catch(() => ({}));
        if (r.status === 403) {
          Alert.alert(
            "Acesso negado",
            err.detail || `Idade mínima exigida: ${MIN_AGE} anos. A sessão foi encerrada.`,
            [{ text: "OK", onPress: () => signOut?.() }],
          );
        } else {
          Alert.alert("Erro", err.detail || "Não foi possível confirmar a idade.");
        }
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha de rede.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={14} color={colors.text} />
          <Text style={styles.badgeText}>VERIFICAÇÃO DE IDADE</Text>
        </View>
        <Text style={styles.title}>QUE ANO{"\n"}NASCESTE?</Text>
        <Text style={styles.sub}>
          O Besord é uma comunidade aberta. Para garantir que respeitamos as regras
          das lojas Apple e Google, precisamos saber se tens pelo menos{" "}
          <Text style={{ fontWeight: "900" }}>{MIN_AGE} anos</Text>.
        </Text>

        <View style={styles.inputBox}>
          <Text style={styles.inputLabel}>ANO DE NASCIMENTO</Text>
          <TextInput
            testID="input-birth-year"
            style={styles.input}
            value={birthYear}
            onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="1990"
            placeholderTextColor="#A1A1AA"
            keyboardType="number-pad"
            maxLength={4}
            inputMode="numeric"
            autoFocus={Platform.OS !== "web"}
          />
          {parsed !== null && isValid && (
            <Text style={[styles.ageHint, computedAge && computedAge < MIN_AGE ? styles.ageHintBad : styles.ageHintOk]}>
              {computedAge} ANOS
            </Text>
          )}
        </View>

        <View style={styles.privacyBox}>
          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
          <Text style={styles.privacy}>
            Guardamos só o ano (não a data completa). É usado para verificar a idade mínima e nunca aparece no teu perfil.
          </Text>
        </View>

        <TouchableOpacity
          testID="btn-confirm-age"
          style={[styles.cta, (!isValid || submitting) && styles.ctaDisabled]}
          onPress={submit}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Text style={styles.ctaText}>CONFIRMAR</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.text} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => signOut?.()} style={styles.signOutLink}>
          <Text style={styles.signOutText}>SAIR DESTA CONTA</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, gap: 20 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...brutalShadow,
  },
  badgeText: { fontWeight: "900", fontSize: 11, letterSpacing: 2, color: colors.text },
  title: { fontSize: 48, fontWeight: "900", letterSpacing: -2, color: colors.text, lineHeight: 50 },
  sub: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, lineHeight: 22 },
  inputBox: { gap: 8 },
  inputLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  input: {
    borderWidth: 4,
    borderColor: colors.border,
    height: 72,
    paddingHorizontal: 18,
    fontSize: 32,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.bg,
    letterSpacing: 4,
    ...brutalShadow,
  },
  ageHint: {
    alignSelf: "flex-start",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  ageHintOk: { backgroundColor: colors.aprovo, color: colors.text },
  ageHintBad: { backgroundColor: colors.desaprovo, color: colors.text },
  privacyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 12,
  },
  privacy: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  cta: {
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
    ...brutalShadow,
  },
  ctaDisabled: { opacity: 0.4, backgroundColor: colors.bgSubtle },
  ctaText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  signOutLink: { alignSelf: "center", padding: 8 },
  signOutText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, textDecorationLine: "underline" },
});
