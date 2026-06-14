import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

const MAX_IMAGES = 3; // até 3 imagens (1 principal + 2 extra)

export default function CriarScreen() {
  const { apiFetch, user, refreshUser } = useAuth();
  const router = useRouter();
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [themes, setThemes] = useState<{ key: string; name: string; emoji: string }[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offerBoost = useCallback((newPostId: string) => {
    const bw = Number(user?.bw_balance || 0);
    const canAfford = bw >= 100;
    Alert.alert(
      "Post publicado! 🎉",
      canAfford
        ? `Queres dar BOOST a este post?\n\n100 BW · 24h · 300 pessoas da tua cidade.\n\nTens ${bw} BW disponíveis.`
        : `Continua a votar para acumulares BW. Precisas de 100 BW (tens ${bw}) para promover um post.`,
      canAfford
        ? [
            { text: "Mais tarde", style: "cancel", onPress: () => router.replace("/(tabs)/feed") },
            {
              text: "PROMOVER (100 BW)",
              onPress: async () => {
                const r = await apiFetch("/api/bw/personal-ad", {
                  method: "POST",
                  body: JSON.stringify({ tier_key: "mini", post_id: newPostId, target_country_code: null, target_city: null }),
                });
                if (r.ok) {
                  await refreshUser();
                  Alert.alert("Boost ativo! 🚀", "O teu post está promovido na tua cidade pelas próximas 24h.");
                } else {
                  const err = await r.json().catch(() => null);
                  Alert.alert("Não foi possível", err?.detail || "Tenta de novo em /personal-ad");
                }
                router.replace("/(tabs)/feed");
              },
            },
          ]
        : [{ text: "OK", onPress: () => router.replace("/(tabs)/feed") }],
    );
  }, [apiFetch, user, router, refreshUser]);

  // Load themes
  React.useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/themes");
        if (r.ok) setThemes(await r.json());
      } catch {}
    })();
  }, [apiFetch]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const pickImage = useCallback(async (slot: "main" | "extra") => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const b64 = await readFileAsBase64(file);
        if (slot === "main") setMainImage(b64);
        else setExtraImages((prev) => [...prev, b64].slice(0, MAX_IMAGES));
      };
      input.click();
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert("Permissão", "Habilite o acesso à galeria nas configurações.");
        return;
      }
      Alert.alert("Permissão", "Precisamos de acesso à galeria.");
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
      let b64: string | null = null;
      if (a.base64) {
        const mime = a.mimeType || "image/jpeg";
        b64 = `data:${mime};base64,${a.base64}`;
      } else if (a.uri) {
        try {
          const resp = await fetch(a.uri);
          const blob = await resp.blob();
          const reader = new FileReader();
          b64 = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { b64 = a.uri; }
      }
      if (b64) {
        if (slot === "main") setMainImage(b64);
        else setExtraImages((prev) => [...prev, b64!].slice(0, MAX_IMAGES));
      }
    }
  }, []);

  const onWordChange = (txt: string) => {
    const cleaned = txt.replace(/\s+/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 20);
    setWord(cleaned.toUpperCase());
  };

  const submit = useCallback(async () => {
    if (!mainImage) {
      Alert.alert("Faltou a imagem", "Selecione pelo menos uma imagem.");
      return;
    }
    if (!word) {
      Alert.alert("Faltou a palavra", "Digite UMA palavra para o post.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { word, image_base64: mainImage };
      if (extraImages.length > 0) payload.images_base64 = extraImages;
      if (selectedTheme) { payload.theme = selectedTheme; payload.is_hype = true; }

      const r = await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const created = await r.json().catch(() => ({}));
        setMainImage(null);
        setExtraImages([]);
        setSelectedTheme(null);
        setWord("");
        if (created?.post_id) {
          offerBoost(created.post_id);
        } else {
          router.replace("/(tabs)/feed");
        }
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao publicar.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao publicar.");
    } finally {
      setSubmitting(false);
    }
  }, [mainImage, extraImages, selectedTheme, word, apiFetch, router, offerBoost]);

  const totalImages = (mainImage ? 1 : 0) + extraImages.length;
  const canAddMoreImages = totalImages < MAX_IMAGES;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>NOVO POST</Text>
        <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>CRIAR</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── Imagem Principal ─── */}
        <TouchableOpacity
          testID="input-image"
          style={[styles.imagePicker, mainImage && styles.imagePickerFilled]}
          onPress={() => pickImage("main")}
          activeOpacity={0.85}
        >
          {mainImage ? (
            <Image source={{ uri: mainImage }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.pickerEmpty}>
              <Ionicons name="cloud-upload-outline" size={56} color={colors.text} />
              <Text style={styles.pickerEmptyTitle}>IMAGEM PRINCIPAL</Text>
              <Text style={styles.pickerEmptySub}>4:5 · Toca para escolher</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ─── Imagens Extra (Carrossel) ─── */}
        <View style={styles.extraImagesRow}>
          {extraImages.map((img, i) => (
            <View key={i} style={styles.extraImageWrap}>
              <Image source={{ uri: img }} style={styles.extraImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeExtraImage}
                onPress={() => setExtraImages((prev) => prev.filter((_, j) => j !== i))}
              >
                <Ionicons name="close-circle" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          ))}
          {canAddMoreImages && (
            <TouchableOpacity
              style={styles.addExtraImage}
              onPress={() => pickImage("extra")}
            >
              <Ionicons name="add" size={28} color={colors.text} />
              <Text style={styles.addExtraText}>+{MAX_IMAGES - totalImages}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Hype — Tema (opcional) ─── */}
        <View style={styles.themeBlock}>
          <Text style={styles.label}>🔥 HYPE — SELECIONA UM TEMA (OPCIONAL)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {themes.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.themeChip, selectedTheme === t.key && styles.themeChipActive]}
                onPress={() => setSelectedTheme(selectedTheme === t.key ? null : t.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.themeChipText, selectedTheme === t.key && styles.themeChipTextActive]}>
                  {t.emoji} {t.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedTheme && (
            <Text style={styles.hypeHint}>✅ POST CLASSIFICADO COMO HYPE</Text>
          )}
        </View>

        {/* ─── Palavra ─── */}
        <View style={styles.wordBlock}>
          <Text style={styles.label}>A PALAVRA</Text>
          <TextInput
            testID="input-word"
            style={styles.wordInput}
            placeholder="UMA"
            placeholderTextColor="#D4D4D8"
            value={word}
            onChangeText={onWordChange}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
          />
          <Text style={styles.hint}>UMA ÚNICA PALAVRA. SEM ESPAÇOS. ATÉ 20 LETRAS.</Text>
        </View>

        {/* ─── Submit ─── */}
        <TouchableOpacity
          testID="btn-submit-post"
          style={[styles.submitBtn, (!mainImage || !word || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!mainImage || !word || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={colors.text} />
              <Text style={styles.submitText}>PUBLICAR</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: colors.text },
  headerBadge: { backgroundColor: colors.aprovo, borderWidth: 3, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 2, color: colors.text },
  content: { padding: 20, gap: 16, paddingBottom: 60 },

  // ─── Imagem Principal ───
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
  imagePickerFilled: { borderStyle: "solid", overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  pickerEmpty: { alignItems: "center", gap: 8 },
  pickerEmptyTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 8 },
  pickerEmptySub: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1 },

  // ─── Imagens Extra ───
  extraImagesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  extraImageWrap: {
    width: 80,
    height: 80,
    borderWidth: 3,
    borderColor: colors.border,
    position: "relative",
  },
  extraImage: { width: "100%", height: "100%", backgroundColor: colors.bgSubtle },
  removeExtraImage: { position: "absolute", top: -8, right: -8 },
  addExtraImage: {
    width: 80,
    height: 80,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  addExtraText: { fontSize: 10, fontWeight: "900", color: colors.text, marginTop: 2 },

  // ─── Tema / Hype ───
  themeBlock: { gap: 8 },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  themeChipActive: { backgroundColor: colors.neutral, borderWidth: 4 },
  themeChipText: { fontSize: 12, fontWeight: "900", color: colors.text, letterSpacing: 0.5 },
  themeChipTextActive: { color: colors.text },
  hypeHint: { fontSize: 10, fontWeight: "900", color: colors.text, letterSpacing: 1 },

  // ─── Word ───
  wordBlock: { gap: 6 },
  label: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text },
  wordInput: {
    borderWidth: 4,
    borderColor: colors.border,
    height: 64,
    paddingHorizontal: 16,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
    color: colors.text,
    backgroundColor: colors.bg,
    ...brutalShadow,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  hint: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1 },

  submitBtn: {
    height: 64,
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
  submitText: { fontSize: 18, fontWeight: "900", letterSpacing: 2, color: colors.text },
});
