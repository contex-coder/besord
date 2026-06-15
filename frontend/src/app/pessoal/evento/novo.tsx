import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import ModernDatePicker from "@/src/components/ModernDatePicker";
import EventMapPicker from "@/src/components/EventMapPicker";

export default function CriarEventoPessoalScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationDays, setDurationDays] = useState(3);
  const [hasRaffle, setHasRaffle] = useState(false);
  const [sponsorships, setSponsorships] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [lat, setLat] = useState<number>(0);
  const [lon, setLon] = useState<number>(0);
  const [hasLocation, setHasLocation] = useState(false);
  const [radiusKm, setRadiusKm] = useState(1.0);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"basic" | "location" | "options" | "review">("basic");

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const steps = ["basic", "location", "options", "review"] as const;

  const animateStep = (next: typeof step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const bw = Number(user?.bw_balance || 0);

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
      if (!perm.granted) { Alert.alert("Permissão", "Precisamos de acesso à galeria."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
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
    setLat(loc.lat); setLon(loc.lon);
    setAddress(loc.address); setCity(loc.city); setCountryCode(loc.countryCode);
    setHasLocation(true);
  }, []);

  const canGoNext = () => {
    if (step === "basic") return !!imageBase64 && !!title && !!date && !!time;
    if (step === "location") return hasLocation;
    return true;
  };

  const submit = useCallback(async () => {
    if (!imageBase64) { Alert.alert("Imagem", "Seleciona uma imagem de capa para o evento."); return; }
    if (!title.trim()) { Alert.alert("Título", "Dá um nome ao evento."); return; }
    if (!date) { Alert.alert("Data", "Seleciona a data de início."); return; }
    if (!hasLocation) { Alert.alert("Localização", "Indica onde será o evento."); return; }

    if (bw < 1000) {
      Alert.alert("B$ insuficientes", `Precisas de 1.000 B$ para criar um evento pessoal. Tens ${bw} B$.`);
      return;
    }

    const isoDate = `${date}T${time || "20:00"}:00`;
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify({
          event_type: "pessoal",
          title: title.trim(),
          description: description.trim(),
          image_base64: imageBase64,
          date: isoDate,
          lat, lon,
          address: address.trim(),
          city: city.trim(),
          country_code: countryCode,
          radius_km: radiusKm,
          duration_days: durationDays,
          has_raffle: hasRaffle,
          sponsorships_enabled: sponsorships,
        }),
      });

      if (r.ok) {
        const data = await r.json();
        Alert.alert(
          "🎉 Evento criado!",
          "O teu evento pessoal está activo. Começa a publicar as tuas imagens de portfolio.",
          [
            { text: "PUBLICAR IMAGENS", onPress: () => router.push(`/evento/${data.event_id}` as any) },
            { text: "FECHAR", onPress: () => router.back() },
          ]
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
  }, [imageBase64, title, description, date, time, lat, lon, address, city, countryCode, hasLocation, radiusKm, durationDays, hasRaffle, sponsorships, bw, apiFetch, router]);

  const stepIndex = steps.indexOf(step);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EVENTO PESSOAL</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* BW badge */}
      <View style={styles.bwBadge}>
        <Ionicons name="flash" size={14} color={colors.text} />
        <Text style={styles.bwBadgeText}>{bw} BW DISPONÍVEIS</Text>
        {bw < 1000 && <Text style={styles.bwWarning}> — FALTAM {1000 - bw} BW</Text>}
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <View style={[styles.stepDot, i <= stepIndex && styles.stepDotDone]}>
              <Text style={[styles.stepDotText, i <= stepIndex && styles.stepDotTextActive]}>
                {i < stepIndex ? "✓" : i + 1}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ─── BASIC ─── */}
          {step === "basic" && (
            <View style={styles.stepWrap}>
              <Text style={styles.sectionTitle}>IMAGEM DE CAPA</Text>
              <TouchableOpacity
                style={[styles.imagePicker, imageBase64 && styles.imagePickerFilled]}
                onPress={pickImage}
                activeOpacity={0.85}
              >
                {imageLoading ? (
                  <ActivityIndicator size="large" color={colors.text} />
                ) : imageBase64 ? (
                  <View style={styles.imagePreview}>
                    <Text style={styles.imagePickedText}>✓ IMAGEM SELECCIONADA</Text>
                    <TouchableOpacity onPress={pickImage} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>ALTERAR</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.pickerEmpty}>
                    <Ionicons name="camera" size={32} color={colors.text} />
                    <Text style={styles.pickerEmptyTitle}>FOTO DO EVENTO</Text>
                    <Text style={styles.pickerEmptySub}>4:3 · Toca para selecionar</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>NOME DO EVENTO</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: O Meu Projecto 2026"
                placeholderTextColor="#A1A1AA"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
                maxLength={80}
              />

              <Text style={styles.sectionTitle}>DESCRIÇÃO (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Conta o que vais mostrar..."
                placeholderTextColor="#A1A1AA"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.sectionTitle}>DATA DE INÍCIO</Text>
              <ModernDatePicker value={date} onChange={setDate} />

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

              <TouchableOpacity
                style={[styles.nextBtn, !canGoNext() && styles.nextBtnDisabled]}
                onPress={() => animateStep("location")}
                disabled={!canGoNext()}
              >
                <Text style={styles.nextBtnText}>CONTINUAR → LOCALIZAÇÃO</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── LOCATION ─── */}
          {step === "location" && (
            <View style={styles.stepWrap}>
              <Text style={styles.sectionTitle}>ONDE?</Text>
              <Text style={styles.sectionSub}>Local físico do evento (check-in até 2 km)</Text>
              <EventMapPicker onLocationChange={handleLocationChange} initialAddress={address} />

              <View style={styles.radiusSection}>
                <Text style={styles.sectionTitle}>RAIO DE CHECK-IN: {radiusKm.toFixed(1)} KM</Text>
                <View style={styles.sliderContainer}>
                  {[0.5, 1.0, 1.5, 2.0].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.radiusOption, Math.abs(radiusKm - r) < 0.1 && styles.radiusOptionActive]}
                      onPress={() => setRadiusKm(r)}
                    >
                      <Text style={[styles.radiusOptionText, Math.abs(radiusKm - r) < 0.1 && styles.radiusOptionTextActive]}>
                        {r}km
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.stepNav}>
                <TouchableOpacity style={styles.prevBtn} onPress={() => animateStep("basic")}>
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={styles.prevBtnText}>VOLTAR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, !canGoNext() && styles.nextBtnDisabled, { flex: 1 }]}
                  onPress={() => animateStep("options")}
                  disabled={!canGoNext()}
                >
                  <Text style={styles.nextBtnText}>OPÇÕES →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── OPTIONS ─── */}
          {step === "options" && (
            <View style={styles.stepWrap}>
              <Text style={styles.sectionTitle}>DURAÇÃO DO EVENTO</Text>
              <View style={styles.durationRow}>
                {[1, 2, 3, 5, 7].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durationBtn, durationDays === d && styles.durationBtnActive]}
                    onPress={() => setDurationDays(d)}
                  >
                    <Text style={[styles.durationBtnText, durationDays === d && styles.durationBtnTextActive]}>
                      {d}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>OPÇÕES (opcionais)</Text>
              <TouchableOpacity
                style={[styles.optionRow, hasRaffle && styles.optionRowActive]}
                onPress={() => setHasRaffle(!hasRaffle)}
              >
                <Ionicons name={hasRaffle ? "checkbox" : "square-outline"} size={22} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>INCLUIR SORTEIO</Text>
                  <Text style={styles.optionSub}>Participantes fazem check-in e concorrem a um prémio</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionRow, sponsorships && styles.optionRowActive]}
                onPress={() => setSponsorships(!sponsorships)}
              >
                <Ionicons name={sponsorships ? "checkbox" : "square-outline"} size={22} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>ACEITAR PATROCÍNIOS</Text>
                  <Text style={styles.optionSub}>Empresas podem pagar para aparecer no teu evento (Bronze/Prata/Ouro)</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={14} color={colors.text} />
                <Text style={styles.infoText}>
                  Podes publicar até 30 imagens de portfolio no feed exclusivo do evento. Cada imagem recebe votos e comentários de palavra da comunidade.
                </Text>
              </View>

              <View style={styles.stepNav}>
                <TouchableOpacity style={styles.prevBtn} onPress={() => animateStep("location")}>
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={styles.prevBtnText}>VOLTAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={() => animateStep("review")}>
                  <Text style={styles.nextBtnText}>REVER →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─── REVIEW ─── */}
          {step === "review" && (
            <View style={styles.stepWrap}>
              <Text style={styles.sectionTitle}>CONFIRMAR EVENTO</Text>

              <View style={styles.reviewCard}>
                <View style={styles.reviewBadge}>
                  <Text style={styles.reviewBadgeText}>EVENTO PESSOAL — GRATUITO</Text>
                </View>
                <Text style={styles.reviewTitle}>{title || "Sem título"}</Text>
                {description ? <Text style={styles.reviewDesc}>{description}</Text> : null}
                <View style={styles.reviewMeta}>
                  <Ionicons name="calendar" size={14} color={colors.textSecondary} />
                  <Text style={styles.reviewMetaText}>{date} às {time || "20:00"} · {durationDays} dia{durationDays !== 1 ? "s" : ""}</Text>
                </View>
                {hasLocation && (
                  <View style={styles.reviewMeta}>
                    <Ionicons name="location" size={14} color={colors.textSecondary} />
                    <Text style={styles.reviewMetaText} numberOfLines={2}>{address}</Text>
                  </View>
                )}
                <View style={styles.reviewMeta}>
                  <Ionicons name="images" size={14} color={colors.textSecondary} />
                  <Text style={styles.reviewMetaText}>Até 30 imagens de portfolio</Text>
                </View>
                {(hasRaffle || sponsorships) && (
                  <View style={styles.reviewMeta}>
                    <Ionicons name="options" size={14} color={colors.textSecondary} />
                    <Text style={styles.reviewMetaText}>
                      {[hasRaffle && "Sorteio", sponsorships && "Patrocínios"].filter(Boolean).join(" + ")}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.bwCostBox}>
                <Text style={styles.bwCostLabel}>CUSTO</Text>
                <Text style={styles.bwCostValue}>GRATUITO</Text>
                <Text style={styles.bwCostSub}>Requer ≥ 1.000 B$ para criar · Tens {bw} B$</Text>
              </View>

              <View style={styles.stepNav}>
                <TouchableOpacity style={styles.prevBtn} onPress={() => animateStep("options")}>
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={styles.prevBtnText}>VOLTAR</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (submitting || bw < 1000) && styles.submitBtnDisabled]}
                onPress={submit}
                disabled={submitting || bw < 1000}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color={colors.textInverse} />
                    <Text style={styles.submitText}>CRIAR EVENTO PESSOAL</Text>
                  </>
                )}
              </TouchableOpacity>
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.bg,
    borderBottomWidth: 3, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, borderWidth: 2.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1, textAlign: "center" },
  bwBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.neutral, borderBottomWidth: 2, borderBottomColor: colors.border,
  },
  bwBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text },
  bwWarning: { fontSize: 11, fontWeight: "900", color: colors.desaprovo },
  progressRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: colors.border, backgroundColor: colors.bgSubtle, alignItems: "center", justifyContent: "center" },
  stepDotDone: { backgroundColor: colors.text, borderColor: colors.text },
  stepDotText: { fontSize: 11, fontWeight: "900", color: colors.textSecondary },
  stepDotTextActive: { color: colors.bg },
  stepLine: { flex: 1, height: 3, backgroundColor: colors.bgSubtle, marginHorizontal: -2 },
  stepLineDone: { backgroundColor: colors.text },
  content: { padding: 20, paddingBottom: 60 },
  stepWrap: { gap: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginBottom: 4 },
  sectionSub: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginTop: -10 },
  imagePicker: {
    width: "100%", aspectRatio: 4 / 3, borderWidth: 3, borderColor: colors.border,
    backgroundColor: colors.bgSubtle, alignItems: "center", justifyContent: "center", ...brutalShadow,
  },
  imagePickerFilled: { backgroundColor: colors.neutral },
  imagePreview: { alignItems: "center", gap: 12 },
  imagePickedText: { fontSize: 14, fontWeight: "900", color: colors.text },
  changeBtn: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  changeBtnText: { fontSize: 11, fontWeight: "900", color: colors.text },
  pickerEmpty: { alignItems: "center", gap: 8 },
  pickerEmptyTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text },
  pickerEmptySub: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  input: { borderWidth: 3, borderColor: colors.border, height: 52, paddingHorizontal: 16, fontSize: 15, fontWeight: "700", color: colors.text, backgroundColor: colors.bg },
  textArea: { height: 90, paddingTop: 14, textAlignVertical: "top" },
  radiusSection: { padding: 14, backgroundColor: colors.bgSubtle, borderWidth: 2, borderColor: colors.border, gap: 10 },
  sliderContainer: { flexDirection: "row", gap: 8 },
  radiusOption: { flex: 1, height: 38, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  radiusOptionActive: { backgroundColor: colors.text },
  radiusOptionText: { fontSize: 11, fontWeight: "900", color: colors.text },
  radiusOptionTextActive: { color: colors.bg },
  durationRow: { flexDirection: "row", gap: 8 },
  durationBtn: { flex: 1, height: 44, borderWidth: 2.5, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  durationBtnActive: { backgroundColor: colors.text },
  durationBtnText: { fontSize: 13, fontWeight: "900", color: colors.text },
  durationBtnTextActive: { color: colors.bg },
  optionRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderWidth: 2.5, borderColor: colors.border, backgroundColor: colors.bg,
  },
  optionRowActive: { backgroundColor: colors.neutral },
  optionTitle: { fontSize: 13, fontWeight: "900", color: colors.text },
  optionSub: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: colors.bgSubtle, borderWidth: 2, borderColor: colors.border },
  infoText: { flex: 1, fontSize: 11, fontWeight: "600", color: colors.text, lineHeight: 16 },
  stepNav: { flexDirection: "row", gap: 12, marginTop: 8 },
  prevBtn: { height: 52, paddingHorizontal: 16, borderWidth: 3, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
  prevBtnText: { fontSize: 12, fontWeight: "900", color: colors.text },
  nextBtn: { height: 52, backgroundColor: colors.neutral, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center", ...brutalShadow },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text },
  reviewCard: { borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bg, padding: 18, gap: 10, ...brutalShadow },
  reviewBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.text },
  reviewBadgeText: { color: colors.bg, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  reviewTitle: { fontSize: 20, fontWeight: "900", color: colors.text },
  reviewDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewMetaText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  bwCostBox: { borderWidth: 3, borderColor: colors.border, padding: 16, alignItems: "center", gap: 4, backgroundColor: colors.bgSubtle },
  bwCostLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 2, color: colors.textSecondary },
  bwCostValue: { fontSize: 28, fontWeight: "900", color: colors.text },
  bwCostSub: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, textAlign: "center" },
  submitBtn: { height: 64, backgroundColor: colors.text, borderWidth: 3, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20, ...brutalShadow },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.bg },
});
