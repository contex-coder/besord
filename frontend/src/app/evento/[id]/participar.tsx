import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function ParticiparEventoScreen() {
  const { id, codigo } = useLocalSearchParams<{ id: string; codigo: string }>();
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [hasBusiness, setHasBusiness] = useState(false);
  const [inviteCode, setInviteCode] = useState(codigo || "");
  const [word, setWord] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [prize, setPrize] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const [eventR, meR] = await Promise.all([
          apiFetch(`/api/events/${id}`),
          apiFetch("/api/auth/me"),
        ]);
        if (eventR.ok) setEvent(await eventR.json());
        if (meR.ok) {
          const me = await meR.json();
          setHasBusiness(!!me.business_profile);
        }
      } catch {}
      setLoading(false);
    })();
  }, [id, apiFetch]);

  // Se não tem perfil empresa, redirecionar para criar
  useEffect(() => {
    if (!loading && !hasBusiness && user) {
      Alert.alert(
        "Precisas de um perfil de empresa",
        "Para participares em eventos como empresa, primeiro cria o teu perfil empresarial.",
        [
          { text: "Criar agora", onPress: () => router.push("/business/onboard") },
          { text: "Voltar", style: "cancel", onPress: () => router.back() },
        ]
      );
    }
  }, [loading, hasBusiness, user, router]);

  const pickImage = useCallback(async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImageBase64(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão necessária", "Precisamos de acesso à galeria.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (a.base64) {
        const mime = a.mimeType || "image/jpeg";
        setImageBase64(`data:${mime};base64,${a.base64}`);
      } else if (a.uri) {
        try {
          const resp = await fetch(a.uri);
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onload = () => setImageBase64(reader.result as string);
          reader.readAsDataURL(blob);
        } catch {
          setImageBase64(a.uri);
        }
      }
    }
  }, []);

  const onWordChange = (txt: string) => {
    const cleaned = txt.replace(/\s+/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 20);
    setWord(cleaned.toUpperCase());
  };

  const submit = useCallback(async () => {
    if (!inviteCode) {
      Alert.alert("Código de convite", "Precisas do código de convite do organizador.");
      return;
    }
    if (!imageBase64) {
      Alert.alert("Faltou a imagem", "Seleciona uma imagem para o teu anúncio.");
      return;
    }
    if (!word) {
      Alert.alert("Faltou a palavra", "Digita UMA palavra para o teu anúncio.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await apiFetch(`/api/events/${id}/join-as-exhibitor`, {
        method: "POST",
        body: JSON.stringify({
          invite_code: inviteCode,
          word,
          image_base64: imageBase64,
          prize: prize.trim() || null,
        }),
      });

      if (r.ok) {
        const data = await r.json();

        if (data.checkout_url) {
          // Redirecionar para Stripe
          Alert.alert(
            "Quase lá! 💰",
            "Vais ser redirecionado para o pagamento de €9,99.",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "PAGAR €9,99",
                onPress: () => {
                  if (Platform.OS === "web") {
                    window.open(data.checkout_url, "_self");
                  } else {
                    const { Linking } = require("react-native");
                    Linking.openURL(data.checkout_url);
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert("Anúncio publicado! 🎉", "O teu anúncio está ativo no evento.");
          router.back();
        }
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao participar no evento.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao participar no evento.");
    } finally {
      setSubmitting(false);
    }
  }, [inviteCode, imageBase64, word, prize, apiFetch, id, router]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>EVENTO NÃO ENCONTRADO</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>PARTICIPAR NO EVENTO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── Info do Evento ─── */}
        <View style={styles.eventInfo}>
          <Image source={{ uri: event.image_base64 }} style={styles.eventThumb} />
          <View style={styles.eventInfoText}>
            <Text style={styles.eventTitle}>{event.title.toUpperCase()}</Text>
            <Text style={styles.eventCompany}>{event.company_name.toUpperCase()}</Text>
            {event.prize && (
              <View style={styles.prizeBadge}>
                <Ionicons name="gift" size={12} color={colors.text} />
                <Text style={styles.prizeText}>PRÉMIO: {event.prize}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>TEU ANÚNCIO NO EVENTO</Text>
          <Text style={styles.dividerPrice}>€9,99</Text>
        </View>

        {/* ─── Código de Convite ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>CÓDIGO DE CONVITE</Text>
          <TextInput
            style={[styles.input, { textAlign: "center", fontSize: 18, letterSpacing: 3 }]}
            placeholder="EX: A1B2C3D4E5F6"
            placeholderTextColor="#A1A1AA"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={12}
          />
          <Text style={styles.hint}>Pede o código ao organizador do evento.</Text>
        </View>

        {/* ─── Imagem ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>IMAGEM DO ANÚNCIO</Text>
          <TouchableOpacity
            style={[styles.imagePicker, imageBase64 && styles.imagePickerFilled]}
            onPress={pickImage}
            activeOpacity={0.85}
          >
            {imageBase64 ? (
              <Image source={{ uri: imageBase64 }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.pickerEmpty}>
                <Ionicons name="cloud-upload-outline" size={36} color={colors.text} />
                <Text style={styles.pickerEmptyTitle}>TOQUE PARA ESCOLHER</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Palavra ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>A PALAVRA</Text>
          <TextInput
            style={[styles.input, { textAlign: "center", fontSize: 24, fontWeight: "900" }]}
            placeholder="EX: INOVADOR"
            placeholderTextColor="#A1A1AA"
            value={word}
            onChangeText={onWordChange}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />
          <Text style={styles.hint}>UMA PALAVRA. ATÉ 20 LETRAS. SERÁ O TEU ANÚNCIO NO EVENTO.</Text>
        </View>

        {/* ─── Prémio (opcional) ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>PRÉMIO (OPCIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: Fones Bluetooth"
            placeholderTextColor="#A1A1AA"
            value={prize}
            onChangeText={setPrize}
          />
          <Text style={styles.hint}>
            Se definires um prémio, quem votar APROVO no teu anúncio concorre automaticamente. Sorteio no fim do evento.
          </Text>
        </View>

        {/* ─── Resumo ─── */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>📋 RESUMO DO TEU ANÚNCIO</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Evento:</Text>
            <Text style={styles.summaryValue}>{event.title}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Palavra:</Text>
            <Text style={[styles.summaryValue, { fontWeight: "900", fontSize: 16 }]}>
              {word ? `#${word}` : "—"}
            </Text>
          </View>
          {prize ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Prémio:</Text>
              <Text style={styles.summaryValue}>{prize}</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Preço:</Text>
            <Text style={[styles.summaryValue, { fontWeight: "900", color: colors.aprovo }]}>€9,99</Text>
          </View>
        </View>

        {/* ─── Submit ─── */}
        <TouchableOpacity
          style={[styles.submitBtn, (!inviteCode || !imageBase64 || !word || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!inviteCode || !imageBase64 || !word || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons name="megaphone" size={20} color={colors.text} />
              <Text style={styles.submitText}>PUBLICAR ANÚNCIO</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          AO PUBLICAR, ÉS REDIRECIONADO PARA O STRIPE (PAGAMENTO SEGURO POR CARTÃO OU MB WAY).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1, textAlign: "center" },

  content: { padding: 16, gap: 18, paddingBottom: 60 },

  // ─── Info Evento ───
  eventInfo: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
  },
  eventThumb: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  eventInfoText: { flex: 1, gap: 4, justifyContent: "center" },
  eventTitle: { fontSize: 15, fontWeight: "900", letterSpacing: -0.3, color: colors.text },
  eventCompany: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  prizeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  prizeText: { fontSize: 9, fontWeight: "900", color: colors.text },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  dividerText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  dividerPrice: { fontSize: 14, fontWeight: "900", color: colors.aprovo },

  // ─── Campos ───
  fieldBlock: { gap: 6 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  input: {
    borderWidth: 3,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  hint: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },

  // ─── Imagem ───
  imagePicker: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderWidth: 4,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    ...brutalShadow,
  },
  imagePickerFilled: { borderStyle: "solid", padding: 0, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  pickerEmpty: { alignItems: "center", gap: 6 },
  pickerEmptyTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 4 },

  // ─── Resumo ───
  summaryBox: {
    padding: 12,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    gap: 8,
  },
  summaryTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: colors.text },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  summaryValue: { fontSize: 12, fontWeight: "700", color: colors.text },

  // ─── Submit ───
  submitBtn: {
    height: 56,
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    ...brutalShadow,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: "900", letterSpacing: 2, color: colors.text },

  footer: { fontSize: 9, fontWeight: "700", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 20, marginTop: 4 },
});
