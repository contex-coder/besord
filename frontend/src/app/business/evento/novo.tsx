import React, { useState, useCallback, useRef } from "react";
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
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import ModernDatePicker from "@/src/components/ModernDatePicker";
import EventMapPicker from "@/src/components/EventMapPicker";

type EventType = "private" | "public";

export default function CriarEventoScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  // Imagem do evento
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Dados básicos
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("private");

  // Data
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
      // Localização
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [lat, setLat] = useState<number>(0);
  const [lon, setLon] = useState<number>(0);
  const [hasLocation, setHasLocation] = useState(false);

  // Raio (km) — max 2km como pedido
  const [radiusKm, setRadiusKm] = useState(1.0);

  // Estado
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"basic" | "location" | "review">("basic");

  // Animações
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateStep = (next: "basic" | "location" | "review") => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  // Image picker
  const pickImage = useCallback(async () => {
    setImageLoading(true);
    try {
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
        Alert.alert("Permissão", "Precisamos de acesso à galeria.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        if (a.base64) {
          setImageBase64(`data:${a.mimeType || "image/jpeg"};base64,${a.base64}`);
        } else if (a.uri) {
          const resp = await fetch(a.uri);
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onload = () => setImageBase64(reader.result as string);
          reader.readAsDataURL(blob);
        }
      }
    } finally {
      setImageLoading(false);
    }
  }, []);

  const handleLocationChange = useCallback((loc: { lat: number; lon: number; address: string; city: string; countryCode: string }) => {
    setLat(loc.lat);
    setLon(loc.lon);
    setAddress(loc.address);
    setCity(loc.city);
    setCountryCode(loc.countryCode);
    setHasLocation(true);
  }, []);

  const submit = useCallback(async () => {
    if (!imageBase64) { Alert.alert("Imagem", "Seleciona uma imagem para o evento."); return; }
    if (!title.trim()) { Alert.alert("Título", "Dá um nome ao evento."); return; }
    if (!date) { Alert.alert("Data", "Seleciona a data do evento."); return; }
    if (!time.trim()) { Alert.alert("Hora", "Indica a hora do evento."); return; }
    if (!hasLocation) { Alert.alert("Localização", "Indica onde será o evento."); return; }

    const isoDate = `${date}T${time}:00`;
    const radius = Math.max(0.1, Math.min(2.0, radiusKm));

    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        image_base64: imageBase64,
        event_type: eventType,
        radius_km: radius,
        date: isoDate,
        lat, lon,
        address: address.trim(),
        city: city.trim(),
        country_code: countryCode,
      };

      const r = await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const data = await r.json();
        if (data.checkout_url) {
          if (Platform.OS === "web") {
            window.open(data.checkout_url, "_self");
          } else {
            const { Linking } = require("react-native");
            await Linking.openURL(data.checkout_url);
          }
        }
        Alert.alert(
          "🎉 Evento criado!",
          eventType === "public"
            ? "O evento público foi enviado para aprovação. Serás notificado."
            : "Evento criado! Conclui o pagamento para ativar.",
          [{ text: "OK", onPress: () => router.back() }]
  );
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao criar evento.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao criar.");
    } finally {
      setSubmitting(false);
    }
  }, [imageBase64, title, description, eventType, date, time, lat, lon, address, city, countryCode, hasLocation, radiusKm, apiFetch, router]);

  const canGoNext = () => {
    if (step === "basic") return !!imageBase64 && !!title && !!date && !!time;
    if (step === "location") return hasLocation;
    return true;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header com steps */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOVO EVENTO</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar com steps interativos */}
      <View style={styles.progressRow}>
        {["basic", "location", "review"].map((s, i) => (
          <React.Fragment key={s}>
            <TouchableOpacity
              style={[
                styles.stepDot,
                step === s && styles.stepDotActive,
                ["basic", "location", "review"].indexOf(step) >= i && styles.stepDotDone,
              ]}
              onPress={() => animateStep(s as any)}
            >
              <Text style={[
                styles.stepDotText,
                (step === s || ["basic", "location", "review"].indexOf(step) >= i) && styles.stepDotTextActive,
              ]}>
                {["basic", "location", "review"].indexOf(step) > i ? "✓" : i + 1}
              </Text>
            </TouchableOpacity>
            {i < 2 && <View style={[styles.stepLine, ["basic", "location", "review"].indexOf(step) > i && styles.stepLineDone]} />}
          </React.Fragment>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {step === "basic" && (
            <View style={styles.stepWrap}>
              {/* ─── Imagem ─── */}
              <Text style={styles.sectionTitle}>IMAGEM DO EVENTO</Text>
              <TouchableOpacity
                style={[styles.imagePicker, imageBase64 && styles.imagePickerFilled]}
                onPress={pickImage}
                activeOpacity={0.85}
              >
                {imageLoading ? (
                  <ActivityIndicator size="large" color={colors.text} />
                ) : imageBase64 ? (
                  <>
                    <Image source={{ uri: imageBase64 }} style={styles.previewImage} resizeMode="cover" />
                    <View style={styles.imageOverlay}>
                      <Ionicons name="camera" size={18} color="#fff" />
                      <Text style={styles.imageOverlayText}>ALTERAR</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.pickerEmpty}>
                    <View style={styles.pickerIconWrap}>
                      <Ionicons name="camera" size={32} color={colors.text} />
                    </View>
                    <Text style={styles.pickerEmptyTitle}>FOTO DO EVENTO</Text>
                    <Text style={styles.pickerEmptySub}>16:9 · Toca para selecionar</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* ─── Tipo ─── */}
              <Text style={styles.sectionTitle}>TIPO</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, eventType === "private" && styles.typeBtnActive]}
                  onPress={() => setEventType("private")}
                >
                  <Ionicons name="lock-closed" size={18} color={eventType === "private" ? colors.textInverse : colors.text} />
                  <Text style={[styles.typeBtnText, eventType === "private" && { color: colors.textInverse }]}>PRIVADO</Text>
                  <Text style={[styles.typeBtnMeta, eventType === "private" && { color: colors.textInverse }]}>Só a tua empresa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, eventType === "public" && styles.typeBtnActive]}
                  onPress={() => setEventType("public")}
                >
                  <Ionicons name="globe" size={18} color={eventType === "public" ? colors.textInverse : colors.text} />
                  <Text style={[styles.typeBtnText, eventType === "public" && { color: colors.textInverse }]}>PÚBLICO</Text>
                  <Text style={[styles.typeBtnMeta, eventType === "public" && { color: colors.textInverse }]}>Várias empresas</Text>
                </TouchableOpacity>
              </View>
              {eventType === "public" && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={14} color={colors.text} />
                  <Text style={styles.infoText}>
                    Eventos públicos precisam de aprovação. Serás notificado assim que for validado.
                  </Text>
                </View>
              )}

              {/* ─── Título ─── */}
              <Text style={styles.sectionTitle}>NOME DO EVENTO</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: Feira de Lisboa 2026"
                placeholderTextColor="#A1A1AA"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
                maxLength={80}
              />

              {/* ─── Descrição ─── */}
              <Text style={styles.sectionTitle}>DESCRIÇÃO</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="O que vai acontecer no evento?"
                placeholderTextColor="#A1A1AA"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              {/* ─── Data + Hora ─── */}
              <Text style={styles.sectionTitle}>DATA DO EVENTO</Text>
              <ModernDatePicker value={date} onChange={setDate} />

              <View style={styles.hourRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>HORA</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="20:00"
                    placeholderTextColor="#A1A1AA"
                    value={time}
                    onChangeText={(v) => {
                      const nums = v.replace(/[^0-9]/g, "").slice(0, 4);
                      if (nums.length <= 2) setTime(nums);
                      else setTime(`${nums.slice(0, 2)}:${nums.slice(2, 4)}`);
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.hourBadge}>
                  <Text style={styles.hourBadgeText}>DURAÇÃO: 7 DIAS</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.nextBtn, !canGoNext() && styles.nextBtnDisabled]}
                onPress={() => animateStep("location")}
                disabled={!canGoNext()}
              >
                <Text style={styles.nextBtnText}>CONTINUAR → LOCALIZAÇÃO</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "location" && (
            <View style={styles.stepWrap}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={22} color={colors.text} />
                <Text style={styles.sectionTitle}>ONDE?</Text>
              </View>
              <Text style={styles.sectionSub}>Pesquisa o local ou escreve o endereço</Text>

              <EventMapPicker onLocationChange={handleLocationChange} initialAddress={address} />

              {/* ─── Raio (max 2km) ─── */}
              <View style={styles.radiusSection}>
                <View style={styles.radiusHeader}>
                  <Ionicons name="radio" size={16} color={colors.text} />
                  <Text style={styles.radiusLabel}>
                    RAIO DE CHECK-IN: <Text style={{ fontWeight: "900" }}>{radiusKm.toFixed(1)} km</Text>
                  </Text>
                </View>
                <View style={styles.sliderContainer}>
                  {[0.5, 1.0, 1.5, 2.0].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.radiusOption,
                        Math.abs(radiusKm - r) < 0.1 && styles.radiusOptionActive,
                      ]}
                      onPress={() => setRadiusKm(r)}
                    >
                      <Text style={[
                        styles.radiusOptionText,
                        Math.abs(radiusKm - r) < 0.1 && styles.radiusOptionTextActive,
                      ]}>{r}km</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.radiusHint}>Máximo 2 km do local do evento</Text>
              </View>

              <View style={styles.stepNav}>
                <TouchableOpacity style={styles.prevBtn} onPress={() => animateStep("basic")}>
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={styles.prevBtnText}>VOLTAR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, !canGoNext() && styles.nextBtnDisabled, { flex: 1 }]}
                  onPress={() => animateStep("review")}
                  disabled={!canGoNext()}
                >
                  <Text style={styles.nextBtnText}>REVER →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === "review" && (
            <View style={styles.stepWrap}>
              <Text style={styles.sectionTitle}>REVER EVENTO</Text>
              <Text style={styles.sectionSub}>Confirma os dados antes de criar</Text>

              <View style={styles.reviewCard}>
                {imageBase64 && (
                  <Image source={{ uri: imageBase64 }} style={styles.reviewImage} resizeMode="cover" />
                )}
                <View style={styles.reviewBody}>
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>{eventType === "public" ? "PÚBLICO" : "PRIVADO"}</Text>
                  </View>
                  <Text style={styles.reviewTitle}>{title || "Sem título"}</Text>
                  {description ? <Text style={styles.reviewDesc}>{description}</Text> : null}
                  <View style={styles.reviewMeta}>
                    <Ionicons name="calendar" size={14} color={colors.textSecondary} />
                    <Text style={styles.reviewMetaText}>{date} às {time}</Text>
                  </View>
                  {hasLocation && (
                    <View style={styles.reviewMeta}>
                      <Ionicons name="location" size={14} color={colors.textSecondary} />
                      <Text style={styles.reviewMetaText} numberOfLines={2}>{address}</Text>
                    </View>
                  )}
                  <View style={styles.reviewMeta}>
                    <Ionicons name="radio" size={14} color={colors.textSecondary} />
                    <Text style={styles.reviewMetaText}>Raio: {radiusKm.toFixed(1)} km · {city}{countryCode ? ` (${countryCode})` : ""}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.stepNav}>
                <TouchableOpacity style={styles.prevBtn} onPress={() => animateStep("location")}>
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={styles.prevBtnText}>VOLTAR</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color={colors.textInverse} />
                    <Text style={styles.submitText}>
                      {eventType === "public" ? "SOLICITAR CRIAÇÃO" : "CRIAR EVENTO (€9,99)"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.footerText}>
                O valor do evento cobre a infraestrutura por 7 dias. Posts/anúncios dentro do evento são pagos à parte.
              </Text>
            </View>
          )}
        </Animated.View>
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
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1, textAlign: "center" },

  // Progress
  progressRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: colors.neutral, transform: [{ scale: 1.1 }] },
  stepDotDone: { borderColor: colors.text, backgroundColor: colors.text },
  stepDotText: { fontSize: 14, fontWeight: "900", color: colors.textSecondary },
  stepDotTextActive: { color: colors.bg },
  stepLine: { flex: 1, height: 4, backgroundColor: colors.bgSubtle, marginHorizontal: -2 },
  stepLineDone: { backgroundColor: colors.text },

  content: { padding: 20, paddingBottom: 60 },
  stepWrap: { gap: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginBottom: 4 },
  sectionSub: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: -12, marginBottom: 4 },

  // Image
  imagePicker: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    ...brutalShadow,
  },
  imagePickerFilled: { padding: 0, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  imageOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  imageOverlayText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  pickerEmpty: { alignItems: "center", gap: 8 },
  pickerIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border },
  pickerEmptyTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text },
  pickerEmptySub: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  // Inputs
  input: {
    borderWidth: 3,
    borderColor: colors.border,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  textArea: { height: 90, paddingTop: 14, textAlignVertical: "top" },

  // Type
  typeRow: { flexDirection: "row", gap: 12 },
  typeBtn: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.bg,
    alignItems: "center",
    gap: 4,
  },
  typeBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  typeBtnText: { fontSize: 13, fontWeight: "900", color: colors.text },
  typeBtnMeta: { fontSize: 9, fontWeight: "700", color: colors.textSecondary },

  infoBox: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: colors.bgSubtle, borderWidth: 2, borderColor: colors.border },
  infoText: { flex: 1, fontSize: 11, fontWeight: "600", color: colors.text, lineHeight: 16 },

  hourRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  hourBadge: { height: 52, paddingHorizontal: 16, backgroundColor: colors.bgSubtle, borderWidth: 3, borderColor: colors.border, justifyContent: "center" },
  hourBadgeText: { fontSize: 11, fontWeight: "900", color: colors.textSecondary },

  // Radius
  radiusSection: { padding: 16, backgroundColor: colors.bgSubtle, borderWidth: 3, borderColor: colors.border, gap: 12 },
  radiusHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  radiusLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
  sliderContainer: { flexDirection: "row", gap: 8 },
  radiusOption: { flex: 1, height: 40, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  radiusOptionActive: { backgroundColor: colors.text, borderColor: colors.text },
  radiusOptionText: { fontSize: 12, fontWeight: "900", color: colors.text },
  radiusOptionTextActive: { color: colors.bg },
  radiusHint: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },

  // Navigation
  stepNav: { flexDirection: "row", gap: 12, marginTop: 10 },
  prevBtn: { height: 56, paddingHorizontal: 20, borderWidth: 3, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
  prevBtnText: { fontSize: 13, fontWeight: "900", color: colors.text },
  nextBtn: { height: 56, backgroundColor: colors.neutral, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center", ...brutalShadow },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // Review
  reviewCard: { borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bg, overflow: "hidden", ...brutalShadow },
  reviewImage: { width: "100%", height: 160 },
  reviewBody: { padding: 16, gap: 8 },
  reviewBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.text, marginBottom: 4 },
  reviewBadgeText: { color: colors.bg, fontSize: 10, fontWeight: "900" },
  reviewTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  reviewDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  reviewMetaText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },

  submitBtn: { height: 64, backgroundColor: colors.text, borderWidth: 3, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20, ...brutalShadow },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.bg },
  footerText: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, textAlign: "center", marginTop: 12, lineHeight: 14 },

  locationHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
});

