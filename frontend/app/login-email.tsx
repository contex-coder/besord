import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Mode = "login" | "register" | "forgot";

export default function LoginEmailScreen() {
  const router = useRouter();
  const { signInWithPassword, registerWithPassword, requestPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  const handleLogin = async () => {
    reset();
    if (!email.trim() || !password) {
      setError("Preenche email e palavra-passe.");
      return;
    }
    setSubmitting(true);
    const r = await signInWithPassword(email, password);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error || "Falha no login.");
      return;
    }
    router.replace("/(tabs)/feed");
  };

  const handleRegister = async () => {
    reset();
    if (!email.trim() || !password) {
      setError("Preenche email e palavra-passe.");
      return;
    }
    if (password.length < 8) {
      setError("A palavra-passe precisa de pelo menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const r = await registerWithPassword(email, password, name);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error || "Não foi possível criar a conta.");
      return;
    }
    router.replace("/(tabs)/feed");
  };

  const handleForgot = async () => {
    reset();
    if (!email.trim()) {
      setError("Indica o email.");
      return;
    }
    setSubmitting(true);
    const r = await requestPasswordReset(email);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error || "Erro ao enviar pedido.");
      return;
    }
    setInfo("Se este email existir, enviámos instruções para recuperar a palavra-passe.");
  };

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="btn-back">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
            <Text style={styles.backText}>VOLTAR</Text>
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              {isLogin ? "ENTRAR" : isRegister ? "CRIAR CONTA" : "RECUPERAR"}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? "Acede com o teu email e palavra-passe."
                : isRegister
                  ? "Para empresas e utilizadores sem Google/Apple."
                  : "Vamos enviar-te instruções por email."}
            </Text>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              testID="tab-login"
              style={[styles.tab, isLogin && styles.tabActive]}
              onPress={() => { setMode("login"); reset(); }}
            >
              <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>ENTRAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tab-register"
              style={[styles.tab, isRegister && styles.tabActive]}
              onPress={() => { setMode("register"); reset(); }}
            >
              <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>REGISTAR</Text>
            </TouchableOpacity>
          </View>

          {isRegister && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>NOME (OPCIONAL)</Text>
              <TextInput
                testID="input-name"
                style={styles.input}
                placeholder="O teu nome"
                placeholderTextColor="#D4D4D8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={80}
              />
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="input-email"
              style={styles.input}
              placeholder="email@dominio.com"
              placeholderTextColor="#D4D4D8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={120}
            />
          </View>

          {!isForgot && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>PALAVRA-PASSE {isRegister ? "(MÍN. 8 CARACTERES)" : ""}</Text>
              <TextInput
                testID="input-password"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#D4D4D8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isRegister ? "new-password" : "current-password"}
                textContentType={isRegister ? "newPassword" : "password"}
                maxLength={72}
              />
            </View>
          )}

          {!!error && <Text style={styles.error} testID="err-msg">{error}</Text>}
          {!!info && <Text style={styles.info} testID="info-msg">{info}</Text>}

          <TouchableOpacity
            testID="btn-submit"
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={isLogin ? handleLogin : isRegister ? handleRegister : handleForgot}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.submitText}>
                {isLogin ? "ENTRAR" : isRegister ? "CRIAR CONTA" : "ENVIAR"}
              </Text>
            )}
          </TouchableOpacity>

          {!isForgot && (
            <TouchableOpacity
              testID="btn-forgot"
              onPress={() => { setMode("forgot"); reset(); }}
              style={{ marginTop: 14 }}
            >
              <Text style={styles.linkText}>ESQUECI A PALAVRA-PASSE</Text>
            </TouchableOpacity>
          )}
          {isForgot && (
            <TouchableOpacity
              testID="btn-back-login"
              onPress={() => { setMode("login"); reset(); }}
              style={{ marginTop: 14 }}
            >
              <Text style={styles.linkText}>VOLTAR AO LOGIN</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12 },
  backText: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text },
  titleBlock: { marginTop: 8, marginBottom: 16 },
  title: { fontSize: 44, fontWeight: "900", letterSpacing: -1, color: colors.text, lineHeight: 46 },
  subtitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 8 },
  tabs: {
    flexDirection: "row",
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  tabActive: { backgroundColor: colors.text },
  tabText: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text },
  tabTextActive: { color: colors.textInverse },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    minHeight: 50,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    ...brutalShadow,
  },
  submitBtn: {
    marginTop: 24,
    backgroundColor: colors.text,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.textInverse },
  error: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: colors.desaprovo,
  },
  info: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: colors.aprovo,
  },
  linkText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.text,
    textDecorationLine: "underline",
  },
});
