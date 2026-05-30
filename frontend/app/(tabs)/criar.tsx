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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function CriarScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert(
          "Permissão necessária",
          "Habilite o acesso à galeria nas configurações para escolher uma imagem.",
          [{ text: "Cancelar" }, { text: "Abrir Configurações", onPress: () => { try { (require("react-native").Linking as any).openSettings(); } catch {} } }]
        );
      } else {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para escolher a imagem do post.");
      }
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
        setImageBase64(a.uri);
      }
    }
  }, []);

  const onWordChange = (txt: string) => {
    // 1 word only — strip spaces, max 20 chars, letters/numbers
    const cleaned = txt.replace(/\s+/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 20);
    setWord(cleaned.toUpperCase());
  };

  const submit = useCallback(async () => {
    if (!imageBase64) {
      Alert.alert("Faltou a imagem", "Selecione uma imagem para o post.");
      return;
    }
    if (!word) {
      Alert.alert("Faltou a palavra", "Digite UMA palavra para o post.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ word, image_base64: imageBase64 }),
      });
      if (r.ok) {
        setImageBase64(null);
        setWord("");
        router.replace("/(tabs)/feed");
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao publicar.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao publicar.");
    } finally {
      setSubmitting(false);
    }
  }, [imageBase64, word, apiFetch, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>NOVO POST</Text>
        <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>CRIAR</Text></View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          testID="input-image"
          style={[styles.imagePicker, imageBase64 && styles.imagePickerFilled]}
          onPress={pickImage}
          activeOpacity={0.85}
        >
          {imageBase64 ? (
            <Image source={{ uri: imageBase64 }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.pickerEmpty}>
              <Ionicons name="cloud-upload-outline" size={56} color={colors.text} />
              <Text style={styles.pickerEmptyTitle}>TOQUE PARA ESCOLHER</Text>
              <Text style={styles.pickerEmptySub}>Imagem 4:5 recomendada</Text>
            </View>
          )}
        </TouchableOpacity>

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

        <TouchableOpacity
          testID="btn-submit-post"
          style={[styles.submitBtn, (!imageBase64 || !word || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!imageBase64 || !word || submitting}
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
      </View>
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
  content: { flex: 1, padding: 20, gap: 20 },
  imagePicker: {
    width: "100%",
    aspectRatio: 1,
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
  pickerEmpty: { alignItems: "center", gap: 8 },
  pickerEmptyTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 8 },
  pickerEmptySub: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1 },

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
