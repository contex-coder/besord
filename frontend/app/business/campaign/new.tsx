import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Tier = { key: string; name: string; scope: string; duration_days: number; amount_cents: number; amount_usd: number; included_votes: number };
type Theme = { key: string; name: string; emoji: string; covers: string };
type Workspace = { workspace_id: string; type: "personal" | "business"; name: string; nif?: string | null };

export default function NewCampaignScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ discount_pct: number; final_cents: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validatePromo = async () => {
    if (!promoCode || !selectedTier) { setPromoApplied(null); return; }
    try {
      const r = await apiFetch("/api/promos/validate", { method: "POST", body: JSON.stringify({ code: promoCode, tier_key: selectedTier.key }) });
      if (r.ok) {
        const data = await r.json();
        setPromoApplied({ discount_pct: data.discount_pct, final_cents: data.final_cents });
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Código inválido", err.detail || "Código não pôde ser aplicado.");
        setPromoApplied(null);
      }
    } catch { setPromoApplied(null); }
  };

  useEffect(() => {
    if (!user?.has_business) {
      router.replace("/business/onboard");
      return;
    }
    apiFetch("/api/business/tiers").then(r => r.json()).then(setTiers);
    apiFetch("/api/themes").then(r => r.ok ? r.json() : []).then((d) => setThemes(Array.isArray(d) ? d : []));
    apiFetch("/api/workspaces").then(r => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      const list: Workspace[] = (d.workspaces || []).filter((w: Workspace) => w.type === "business");
      setWorkspaces(list);
      // Prefer active_workspace_id if it is a business one
      const active = d.active_workspace_id && list.find((w: Workspace) => w.workspace_id === d.active_workspace_id)
        ? d.active_workspace_id
        : (list[0]?.workspace_id || null);
      setSelectedWorkspace(active);
    });
  }, []);  // eslint-disable-line

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6, base64: true, allowsEditing: true, aspect: [4, 5],
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setImage(`data:${res.assets[0].mimeType || "image/jpeg"};base64,${res.assets[0].base64}`);
    }
  }, []);

  const submit = async () => {
    if (!image || !word || !selectedTier) {
      Alert.alert("Atenção", "Preencha imagem, palavra e plano.");
      return;
    }
    if (selectedTier.scope === "country" && !country) { Alert.alert("Atenção", "Informe o código do país (ex: BR, US)."); return; }
    if (selectedTier.scope === "region" && (!country || !region)) { Alert.alert("Atenção", "Informe país e região."); return; }
    if (selectedTier.scope === "city" && (!country || !city)) { Alert.alert("Atenção", "Informe país e cidade."); return; }

    setSubmitting(true);
    try {
      const r = await apiFetch("/api/business/campaigns", {
        method: "POST",
        body: JSON.stringify({
          word, image_base64: image, tier_key: selectedTier.key,
          target_country_code: country.toUpperCase() || null,
          target_region: region || null,
          target_city: city || null,
          theme: selectedTheme,
          workspace_id: selectedWorkspace,
          promo_code: promoCode || null,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.checkout_url) {
          // Open Stripe Checkout
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.location.href = data.checkout_url;
          } else {
            await WebBrowser.openBrowserAsync(data.checkout_url);
          }
        }
        router.replace(`/business/campaign/${data.campaign_id}`);
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao criar.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>NOVA CAMPANHA</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {workspaces.length > 0 && (
          <View>
            <Text style={styles.section}>0. EMPRESA ANUNCIANTE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              style={{ marginBottom: 4 }}
            >
              {workspaces.map((ws) => {
                const active = selectedWorkspace === ws.workspace_id;
                return (
                  <TouchableOpacity
                    key={ws.workspace_id}
                    testID={`ws-chip-${ws.workspace_id}`}
                    style={[styles.wsChip, active && styles.wsChipActive]}
                    onPress={() => setSelectedWorkspace(ws.workspace_id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="business"
                      size={14}
                      color={active ? colors.text : colors.textSecondary}
                    />
                    <Text style={[styles.wsChipText, active && styles.wsChipTextActive]}>{ws.name}</Text>
                    {ws.nif ? <Text style={styles.wsChipNif}>{ws.nif}</Text> : null}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                testID="ws-chip-add"
                style={[styles.wsChip, styles.wsChipAdd]}
                onPress={() => router.push("/workspaces")}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={14} color={colors.text} />
                <Text style={[styles.wsChipText, { color: colors.text }]}>NOVA</Text>
              </TouchableOpacity>
            </ScrollView>
            <Text style={styles.wsHint}>A fatura será emitida em nome desta empresa.</Text>
            <View style={{ height: 12 }} />
          </View>
        )}

        <Text style={styles.section}>1. ESCOLHA O ALCANCE</Text>
        <View style={{ gap: 10 }}>
          {tiers.map(tt => (
            <TouchableOpacity
              key={tt.key}
              testID={`tier-${tt.key}`}
              style={[styles.tier, selectedTier?.key === tt.key && styles.tierActive]}
              onPress={() => setSelectedTier(tt)}
              activeOpacity={0.85}
            >
              <View style={styles.tierLeft}>
                <Text style={styles.tierName}>{tt.name}</Text>
                <Text style={styles.tierDesc}>{tt.scope.toUpperCase()} • {tt.duration_days}D • {tt.included_votes} VOTOS</Text>
              </View>
              <Text style={styles.tierPrice}>€{tt.amount_usd}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedTier && selectedTier.scope !== "world" && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.section}>2. ALVO GEOGRÁFICO</Text>
            <View style={{ gap: 10 }}>
              <TextInput testID="input-country" style={styles.input} placeholder="PAÍS (ex: BR, US, FR)" placeholderTextColor="#A1A1AA"
                         value={country} onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))} maxLength={2} autoCapitalize="characters" />
              {(selectedTier.scope === "region") && (
                <TextInput testID="input-region" style={styles.input} placeholder="ESTADO / PROVÍNCIA" placeholderTextColor="#A1A1AA"
                           value={region} onChangeText={setRegion} autoCapitalize="words" />
              )}
              {(selectedTier.scope === "city") && (
                <TextInput testID="input-city" style={styles.input} placeholder="CIDADE" placeholderTextColor="#A1A1AA"
                           value={city} onChangeText={setCity} autoCapitalize="words" />
              )}
            </View>
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <Text style={styles.section}>3. IMAGEM</Text>
          <TouchableOpacity testID="input-campaign-image" style={[styles.imagePicker, image && { borderStyle: "solid", padding: 0 }]} onPress={pickImage}>
            {image ? <Image source={{ uri: image }} style={styles.preview} /> : (
              <View style={{ alignItems: "center", gap: 6 }}>
                <Ionicons name="cloud-upload-outline" size={44} color={colors.text} />
                <Text style={styles.pickerText}>TOQUE PARA ESCOLHER</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={styles.section}>4. PALAVRA</Text>
          <TextInput testID="input-campaign-word" style={styles.wordInput} placeholder="UMA" placeholderTextColor="#D4D4D8"
                     value={word}
                     onChangeText={(v) => setWord(v.replace(/\s+/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 20).toUpperCase())}
                     autoCapitalize="characters" maxLength={20} />
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={styles.section}>5. TEMA (opcional)</Text>
          <Text style={styles.themeHint}>Categoriza teu anúncio para aparecer em Estilos e Trends do mesmo tema.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            style={{ marginTop: 8 }}
          >
            <TouchableOpacity
              testID="theme-chip-none"
              style={[styles.themeChip, !selectedTheme && styles.themeChipActive]}
              onPress={() => setSelectedTheme(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.themeChipEmoji}>—</Text>
              <Text style={[styles.themeChipText, !selectedTheme && styles.themeChipTextActive]}>NENHUM</Text>
            </TouchableOpacity>
            {themes.map((t) => {
              const active = selectedTheme === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  testID={`theme-chip-${t.key}`}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                  onPress={() => setSelectedTheme(active ? null : t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.themeChipEmoji}>{t.emoji}</Text>
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>{t.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {selectedTheme && (() => {
            const t = themes.find((x) => x.key === selectedTheme);
            return t ? <Text style={styles.themeCovers} numberOfLines={2}>{t.covers}</Text> : null;
          })()}
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={styles.section}>6. CÓDIGO PROMOCIONAL (opcional)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput testID="input-promo" style={[styles.input, { flex: 1 }]} placeholder="EX: LANCAMENTO" placeholderTextColor="#A1A1AA"
                       value={promoCode} onChangeText={(v) => { setPromoCode(v.toUpperCase()); setPromoApplied(null); }} autoCapitalize="characters" />
            <TouchableOpacity testID="btn-apply-promo" style={styles.applyBtn} onPress={validatePromo} disabled={!promoCode || !selectedTier}>
              <Text style={styles.applyText}>APLICAR</Text>
            </TouchableOpacity>
          </View>
          {promoApplied && (
            <Text style={styles.promoOk}>✓ -{promoApplied.discount_pct}% aplicado!</Text>
          )}
        </View>

        <TouchableOpacity testID="btn-pay" style={[styles.payBtn, (!image || !word || !selectedTier || submitting) && { opacity: 0.5 }]}
                          onPress={submit} disabled={!image || !word || !selectedTier || submitting}>
          {submitting ? <ActivityIndicator color={colors.text} /> : (
            <>
              <Ionicons name="card" size={22} color={colors.text} />
              <Text style={styles.payText}>
                PAGAR €{promoApplied ? (promoApplied.final_cents / 100).toFixed(2) : (selectedTier?.amount_usd ?? "—")}
                {promoApplied && <Text style={{ textDecorationLine: "line-through", color: colors.textSecondary }}>  €{selectedTier?.amount_usd}</Text>}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.disclaimer}>Pagamento seguro via Stripe • Valores em EUR</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  content: { padding: 20, paddingBottom: 60 },
  section: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginBottom: 10 },
  tier: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 3, borderColor: colors.border, padding: 14, backgroundColor: colors.bg, ...brutalShadow },
  tierActive: { backgroundColor: colors.neutral, transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0, elevation: 0 },
  tierLeft: { gap: 4 },
  tierName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  tierDesc: { fontSize: 10, fontWeight: "800", color: colors.textSecondary, letterSpacing: 1 },
  tierPrice: { fontSize: 22, fontWeight: "900", color: colors.text },
  input: { borderWidth: 3, borderColor: colors.border, height: 52, paddingHorizontal: 12, fontSize: 14, fontWeight: "900", color: colors.text, backgroundColor: colors.bg, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  imagePicker: { width: "100%", aspectRatio: 4 / 5, borderWidth: 4, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.bgSubtle, alignItems: "center", justifyContent: "center", overflow: "hidden", ...brutalShadow },
  preview: { width: "100%", height: "100%" },
  pickerText: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: colors.text },
  wordInput: { borderWidth: 4, borderColor: colors.border, height: 64, paddingHorizontal: 16, fontSize: 28, fontWeight: "900", textAlign: "center", color: colors.text, backgroundColor: colors.bg, ...brutalShadow, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  payBtn: { marginTop: 22, height: 64, backgroundColor: colors.aprovo, borderWidth: 4, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, ...brutalShadow },
  payText: { fontSize: 18, fontWeight: "900", letterSpacing: 2, color: colors.text },
  applyBtn: { borderWidth: 3, borderColor: colors.border, backgroundColor: colors.neutral, paddingHorizontal: 14, justifyContent: "center", ...brutalShadow },
  applyText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.text },
  promoOk: { marginTop: 6, fontSize: 12, fontWeight: "900", color: colors.aprovo, letterSpacing: 1 },
  themeHint: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.3 },
  themeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 3, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.bg, ...brutalShadow,
  },
  themeChipActive: {
    backgroundColor: colors.aprovo,
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOpacity: 0, elevation: 0,
  },
  themeChipEmoji: { fontSize: 14 },
  themeChipText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  themeChipTextActive: { color: colors.text },
  themeCovers: { marginTop: 8, fontSize: 11, fontWeight: "700", color: colors.text, lineHeight: 16 },
  wsChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 3, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg, ...brutalShadow },
  wsChipActive: { backgroundColor: colors.aprovo, transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0, elevation: 0 },
  wsChipAdd: { backgroundColor: colors.neutral, borderStyle: "dashed" },
  wsChipText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  wsChipTextActive: { color: colors.text },
  wsChipNif: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, marginLeft: 4 },
  wsHint: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginTop: 6 },
  disclaimer: { textAlign: "center", marginTop: 12, fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },
});
