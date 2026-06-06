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
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type EventType = "private" | "public";

export default function CriarEventoScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>("private");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radiusKm, setRadiusKm] = useState("1.0");
  const [prize, setPrize] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [bwReward, setBwReward] = useState("50");
  const [submitting, setSubmitting] = useState(false);

  const pickImage = useCallback(async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setImageBase64(result);
        };
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
      aspect: [16, 9],
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

  const submit = useCallback(async () => {
    // Validações
    if (!imageBase64) {
      Alert.alert("Faltou a imagem", "Seleciona uma imagem para o evento.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Faltou o título", "Dá um nome ao teu evento.");
      return;
    }
    if (!date.trim()) {
      Alert.alert("Faltou a data", "Indica a data do evento (AAAA-MM-DD).");
      return;
    }
    if (!address.trim() && (!lat.trim() || !lon.trim())) {
      Alert.alert("Faltou a localização", "Indica o endereço ou coordenadas.");
      return;
    }
    if (!time.trim()) {
      Alert.alert("Faltou a hora", "Indica a hora do evento (HH:MM).");
      return;
    }

    // Montar data ISO
    const isoDate = `${date}T${time}:00`;

    // Validar raio
    const radius = parseFloat(radiusKm) || 1.0;
    if (radius < 0.1 || radius > 10) {
      Alert.alert("Raio inválido", "O raio deve ser entre 0.1 e 10 km.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        image_base64: imageBase64,
        event_type: eventType,
        radius_km: radius,
        date: isoDate,
        bw_reward: parseInt(bwReward) || 50,
      };

      if (prize.trim()) payload.prize = prize.trim();
      if (maxParticipants.trim()) payload.max_participants = parseInt(maxParticipants) || 100;

      // Localização
      if (lat.trim() && lon.trim()) {
        payload.lat = parseFloat(lat);
        payload.lon = parseFloat(lon);
        payload.address = address.trim();
        payload.city = city.trim();
        payload.country_code = countryCode.trim().toUpperCase();
      } else {
        payload.address = address.trim();
        payload.city = city.trim();
        payload.country_code = countryCode.trim().toUpperCase();
      }

      const r = await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const data = await r.json();
        if (data.checkout_url) {
          // Stripe Checkout (privado)
          if (Platform.OS === "web") {
            window.open(data.checkout_url, "_self");
          } else {
            // Mobile: abrir no browser
            const { Linking } = require("react-native");
            await Linking.openURL(data.checkout_url);
          }
          Alert.alert(
            "Evento criado!",
            eventType === "public"
              ? "O evento público foi enviado para aprovação do admin."
              : "Evento criado! Conclui o pagamento no Stripe para ativar.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        } else {
          Alert.alert(
            "Evento criado! 🎉",
            eventType === "public"
              ? "O evento público foi enviado para aprovação do admin. Serás notificado quando for aprovado."
              : "Evento criado com sucesso!",
            [{ text: "OK", onPress: () => router.back() }]
          );
        }
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao criar evento.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao criar evento.");
    } finally {
      setSubmitting(false);
    }
  }, [imageBase64, title, description, eventType, date, time, address, city, countryCode, lat, lon, radiusKm, prize, maxParticipants, bwReward, apiFetch, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CRIAR EVENTO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── Imagem ─── */}
        <TouchableOpacity
          style={[styles.imagePicker, imageBase64 && styles.imagePickerFilled]}
          onPress={pickImage}
          activeOpacity={0.85}
        >
          {imageBase64 ? (
            <Image source={{ uri: imageBase64 }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.pickerEmpty}>
              <Ionicons name="cloud-upload-outline" size={48} color={colors.text} />
              <Text style={styles.pickerEmptyTitle}>IMAGEM DO EVENTO</Text>
              <Text style={styles.pickerEmptySub}>16:9 recomendado</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ─── Tipo de Evento ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>TIPO DE EVENTO</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, eventType === "private" && styles.typeBtnActive]}
              onPress={() => setEventType("private")}
            >
              <Ionicons name="lock-closed" size={16} color={colors.text} />
              <Text style={styles.typeBtnText}>PRIVADO</Text>
              <Text style={styles.typeDesc}>Só eu publico</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, eventType === "public" && styles.typeBtnActive]}
              onPress={() => setEventType("public")}
            >
              <Ionicons name="globe" size={16} color={colors.text} />
              <Text style={styles.typeBtnText}>PÚBLICO</Text>
              <Text style={styles.typeDesc}>Várias empresas</Text>
            </TouchableOpacity>
          </View>
          {eventType === "public" && (
            <Text style={styles.hint}>Eventos públicos precisam de aprovação do admin (conteeteixeira@gmail.com / rodrigocontecunha@gmail.com).</Text>
          )}
        </View>

        {/* ─── Título ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>TÍTULO</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: FEIRA DE LISBOA 2026"
            placeholderTextColor="#A1A1AA"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="characters"
            maxLength={80}
          />
        </View>

        {/* ─── Descrição ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>DESCRIÇÃO</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descrição do evento..."
            placeholderTextColor="#A1A1AA"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* ─── Data e Hora ─── */}
        <View style={styles.row}>
          <View style={[styles.fieldBlock, { flex: 1 }]}>
            <Text style={styles.label}>DATA</Text>
            <TextInput
              style={styles.input}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#A1A1AA"
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
              maxLength={10}
            />
          </View>
          <View style={[styles.fieldBlock, { flex: 1 }]}>
            <Text style={styles.label}>HORA</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              placeholderTextColor="#A1A1AA"
              value={time}
              onChangeText={setTime}
              autoCapitalize="none"
              maxLength={5}
            />
          </View>
        </View>

        {/* ─── Localização ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>LOCALIZAÇÃO</Text>
          <TextInput
            style={styles.input}
            placeholder="Endereço (ex: Av. da Liberdade, Lisboa)"
            placeholderTextColor="#A1A1AA"
            value={address}
            onChangeText={setAddress}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Cidade"
              placeholderTextColor="#A1A1AA"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="País (PT)"
              placeholderTextColor="#A1A1AA"
              value={countryCode}
              onChangeText={setCountryCode}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
          <Text style={styles.hint}>OU insere coordenadas manualmente:</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Latitude"
              placeholderTextColor="#A1A1AA"
              value={lat}
              onChangeText={setLat}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Longitude"
              placeholderTextColor="#A1A1AA"
              value={lon}
              onChangeText={setLon}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ─── Raio ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>RAIO GEOGRÁFICO</Text>
          <TextInput
            style={styles.input}
            placeholder="1.0 (km)"
            placeholderTextColor="#A1A1AA"
            value={radiusKm}
            onChangeText={setRadiusKm}
            keyboardType="numeric"
          />
          <Text style={styles.hint}>Distância em km para check-in. Mín: 0.1, Máx: 10. Default: 1 km.</Text>
        </View>

        {/* ─── Prémio (opcional) ─── */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>PRÉMIO (OPCIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 1 iPhone 16"
            placeholderTextColor="#A1A1AA"
            value={prize}
            onChangeText={setPrize}
          />
          <Text style={styles.hint}>Sorteio automático no fim do evento.</Text>
        </View>

        {/* ─── Máx Participantes (opcional) ─── */}
        <View style={styles.row}>
          <View style={[styles.fieldBlock, { flex: 1 }]}>
            <Text style={styles.label}>MÁX PARTICIPANTES</Text>
            <TextInput
              style={styles.input}
              placeholder="Ilimitado"
              placeholderTextColor="#A1A1AA"
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.fieldBlock, { flex: 1 }]}>
            <Text style={styles.label}>RECOMPENSA BW</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              placeholderTextColor="#A1A1AA"
              value={bwReward}
              onChangeText={setBwReward}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ─── Submit ─── */}
        <TouchableOpacity
          style={[styles.submitBtn, (!imageBase64 || !title || !date || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!imageBase64 || !title || !date || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons name="location" size={20} color={colors.text} />
              <Text style={styles.submitText}>
                {eventType === "public" ? "CRIAR EVENTO PÚBLICO" : "CRIAR EVENTO (GRÁTIS)"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          CRIAR EVENTO É GRÁTIS. PAGA-SE APENAS PELOS ANÚNCIOS/POSTS DENTRO DO EVENTO (€9,99 CADA).
        </Text>
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
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1, textAlign: "center" },

  content: { padding: 16, gap: 18, paddingBottom: 60 },

  // ─── Imagem ───
  imagePicker: {
    width: "100%",
    aspectRatio: 16 / 9,
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
  pickerEmptyTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 8 },
  pickerEmptySub: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1 },

  // ─── Tipo ───
  fieldBlock: { gap: 6 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text },

  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    gap: 4,
  },
  typeBtnActive: { backgroundColor: colors.aprovo },
  typeBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text },
  typeDesc: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  // ─── Inputs ───
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
  textArea: { height: 80, paddingTop: 12, textAlignVertical: "top" },

  row: { flexDirection: "row", gap: 10 },
  hint: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },

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
    marginTop: 10,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 15, fontWeight: "900", letterSpacing: 2, color: colors.text },

  footer: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 20, marginTop: 10 },
});
