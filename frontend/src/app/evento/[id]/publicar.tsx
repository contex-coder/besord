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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

// Alert.alert é um no-op no web (react-native-web não o implementa) — sem isto,
// nenhuma destas mensagens apareceria a quem usa besord.vercel.app no browser.
function notify(title: string, message?: string, onOk?: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    onOk?.();
    return;
  }
  Alert.alert(title, message, onOk ? [{ text: "OK", onPress: onOk }] : undefined);
}

export default function PublicarImagemEventoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [word, setWord] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [hasRaffleItem, setHasRaffleItem] = useState(false);
  const [prize, setPrize] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const r = await apiFetch(`/api/events/${id}`);
        if (r.ok) setEvent(await r.json());
      } catch {}
      setLoading(false);
    })();
  }, [id, apiFetch]);

  const isPersonal = event?.event_type === "pessoal";

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
      notify("Permissão necessária", "Precisamos de acesso à galeria.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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

  const submit = useCallback(async (usePackage: boolean) => {
    if (!imageBase64) {
      notify("Faltou a imagem", "Seleciona uma imagem para publicar.");
      return;
    }
    if (!word) {
      notify("Faltou a palavra", "Digita UMA palavra para a publicação.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch(`/api/events/${id}/publish-image`, {
        method: "POST",
        body: JSON.stringify({
          image_base64: imageBase64,
          word,
          has_raffle_item: hasRaffleItem,
          prize: hasRaffleItem ? prize.trim() || null : null,
          package: usePackage,
        }),
      });

      if (r.ok) {
        const data = await r.json();
        if (data.checkout_url) {
          if (Platform.OS === "web") {
            window.open(data.checkout_url, "_self");
          } else {
            await Linking.openURL(data.checkout_url);
          }
          return;
        }
        notify("Imagem publicada!", "A tua publicação já está visível no feed do evento.", () => router.back());
      } else {
        const err = await r.json().catch(() => ({}));
        notify("Erro", err.detail || "Falha ao publicar imagem.");
      }
    } catch (e: any) {
      notify("Erro", e?.message || "Falha ao publicar imagem.");
    } finally {
      setSubmitting(false);
    }
  }, [imageBase64, word, hasRaffleItem, prize, apiFetch, id, router]);

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

  const disabled = !imageBase64 || !word || submitting;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>PUBLICAR IMAGEM</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.eventInfo}>
          <Image source={{ uri: event.image_base64 }} style={styles.eventThumb} />
          <View style={styles.eventInfoText}>
            <Text style={styles.eventTitle} numberOfLines={1}>{event.title.toUpperCase()}</Text>
            <Text style={styles.eventCompany}>{event.company_name.toUpperCase()}</Text>
          </View>
        </View>

        {/* ─── Imagem ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>IMAGEM</Text>
          <TouchableOpacity
            style={[styles.imagePicker, imageBase64 && styles.imagePickerFilled]}
            onPress={pickImage}
            activeOpacity={0.85}
          >
            {imageBase64 ? (
              <Image source={{ uri: imageBase64 }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.pickerEmpty}>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.text} />
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
          <Text style={styles.hint}>UMA PALAVRA. O PÚBLICO VOTA APROVO/DESAPROVO E COMENTA COM A SUA PRÓPRIA PALAVRA.</Text>
        </View>

        {/* ─── Sorteio (opcional) ─── */}
        <View style={styles.fieldBlock}>
          <TouchableOpacity
            style={[styles.raffleToggle, hasRaffleItem && styles.raffleToggleActive]}
            onPress={() => setHasRaffleItem((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons name="gift" size={18} color={colors.text} />
            <Text style={styles.raffleToggleText}>ASSOCIAR ITEM DE SORTEIO (OPCIONAL)</Text>
            <Ionicons name={hasRaffleItem ? "checkbox" : "square-outline"} size={20} color={colors.text} />
          </TouchableOpacity>
          {hasRaffleItem && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="ex: Fones Bluetooth"
              placeholderTextColor="#A1A1AA"
              value={prize}
              onChangeText={setPrize}
            />
          )}
        </View>

        {/* ─── Submit ─── */}
        {isPersonal ? (
          <TouchableOpacity
            style={[styles.submitBtn, disabled && styles.submitBtnDisabled]}
            onPress={() => submit(false)}
            disabled={disabled}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={colors.text} />
                <Text style={styles.submitText}>PUBLICAR (GRÁTIS)</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.submitBtn, disabled && styles.submitBtnDisabled]}
              onPress={() => submit(false)}
              disabled={disabled}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.submitText}>PUBLICAR (€9,99)</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtnAlt, disabled && styles.submitBtnDisabled]}
              onPress={() => submit(true)}
              disabled={disabled}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.submitText}>PACOTE 10 PUBLICAÇÕES (€49,99)</Text>
                  <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>POUPA 50%</Text></View>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>SE JÁ TIVERES SLOTS PAGOS DISPONÍVEIS, A PUBLICAÇÃO É IMEDIATA — SEM PAGAMENTO.</Text>
          </>
        )}
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

  eventInfo: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
  },
  eventThumb: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  eventInfoText: { flex: 1, gap: 4, justifyContent: "center" },
  eventTitle: { fontSize: 14, fontWeight: "900", letterSpacing: -0.3, color: colors.text },
  eventCompany: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },

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

  raffleToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  raffleToggleActive: { backgroundColor: colors.neutral, borderWidth: 4 },
  raffleToggleText: { flex: 1, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, color: colors.text },

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
  submitBtnAlt: {
    height: 56,
    backgroundColor: colors.aprovo,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    ...brutalShadow,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 14, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  saveBadge: { backgroundColor: colors.text, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { fontSize: 9, fontWeight: "900", color: colors.textInverse },
});
