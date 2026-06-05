import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Post = {
  post_id: string;
  word: string;
  image_base64: string;
  is_sponsored?: boolean;
  aprovo_count?: number;
  desaprovo_count?: number;
};

const MINI_TIER = {
  key: "mini",
  cost: 100,
  durationLabel: "24 HORAS",
  scopeLabel: "TUA CIDADE",
  capLabel: "300 IMPRESSÕES",
};

export default function PersonalAdScreen() {
  const router = useRouter();
  const { apiFetch, user, refreshUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [city, setCity] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bw = Number(user?.bw_balance || 0);
  const canAfford = bw >= MINI_TIER.cost;

  const load = useCallback(async () => {
    try {
      const [pr, gr] = await Promise.all([
        apiFetch("/api/posts?mine=true&sort=recent"),
        apiFetch("/api/geo/me").catch(() => null),
      ]);
      if (pr.ok) {
        const all: Post[] = await pr.json();
        // only eligible: not already sponsored
        setPosts(all.filter((p) => !p.is_sponsored));
      }
      if (gr && gr.ok) {
        const g = await gr.json();
        setCity(g.city || "");
        setCountryCode((g.country_code || g.countryCode || "").toUpperCase());
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!selectedPostId) {
      Alert.alert("Atenção", "Escolhe um post para promover.");
      return;
    }
    if (!canAfford) {
      Alert.alert("Saldo BW insuficiente", `Precisas de ${MINI_TIER.cost} BW. Tens ${bw}.`);
      return;
    }
    setSubmitting(true);
    const r = await apiFetch("/api/bw/personal-ad", {
      method: "POST",
      body: JSON.stringify({
        tier_key: MINI_TIER.key,
        post_id: selectedPostId,
        target_country_code: countryCode || null,
        target_city: city || null,
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      Alert.alert("Não foi possível", body?.detail || "Erro ao criar anúncio.");
      return;
    }
    await refreshUser();
    Alert.alert("Anúncio criado! 🚀", "O teu post foi promovido por 24 horas na tua cidade.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/perfil") },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="btn-back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>ANÚNCIO PESSOAL</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        <View style={styles.tierCard}>
          <Text style={styles.tierTag}>MINI · BW</Text>
          <View style={styles.row}>
            <Text style={styles.tierCost}>{MINI_TIER.cost}</Text>
            <Text style={styles.tierCostUnit}>BW</Text>
          </View>
          <View style={styles.benefits}>
            <Text style={styles.benefit}>⏱  {MINI_TIER.durationLabel}</Text>
            <Text style={styles.benefit}>📍  {MINI_TIER.scopeLabel}{city ? ` — ${city.toUpperCase()}` : ""}</Text>
            <Text style={styles.benefit}>👁  Até {MINI_TIER.capLabel}</Text>
          </View>
          <Text style={styles.balanceText}>
            Saldo atual: <Text style={{ fontWeight: "900" }}>{bw} BW</Text>
          </Text>
          {!canAfford && (
            <Text style={styles.warnText}>Precisas de mais {MINI_TIER.cost - bw} BW. Vota mais!</Text>
          )}
        </View>

        <Text style={styles.section}>1. ESCOLHE UM POST TEU</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.text} style={{ marginVertical: 30 }} />
        ) : posts.length === 0 ? (
          <Text style={styles.emptyText}>Ainda não tens posts elegíveis. Cria um post primeiro!</Text>
        ) : (
          <View style={styles.grid}>
            {posts.map((p) => {
              const selected = p.post_id === selectedPostId;
              return (
                <TouchableOpacity
                  key={p.post_id}
                  style={[styles.thumb, selected && styles.thumbSelected]}
                  onPress={() => setSelectedPostId(p.post_id)}
                  activeOpacity={0.85}
                  testID={`post-thumb-${p.post_id}`}
                >
                  <Image source={{ uri: p.image_base64 }} style={styles.thumbImage} resizeMode="cover" />
                  <View style={styles.thumbFooter}>
                    <Text style={styles.thumbWord} numberOfLines={1}>{p.word}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={colors.aprovo} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          testID="btn-submit-pad"
          style={[styles.submitBtn, (!selectedPostId || !canAfford || submitting) && styles.submitDisabled]}
          onPress={submit}
          disabled={!selectedPostId || !canAfford || submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.submitText}>PROMOVER POR {MINI_TIER.cost} BW</Text>}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Só podes ter um anúncio pessoal ativo de cada vez. BW é apenas XP, sem valor monetário.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  title: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  tierCard: { borderWidth: 4, borderColor: colors.border, padding: 16, marginBottom: 24, backgroundColor: colors.aprovo, ...brutalShadow },
  tierTag: { fontSize: 11, fontWeight: "900", letterSpacing: 2, color: colors.text, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  tierCost: { fontSize: 64, fontWeight: "900", letterSpacing: -2, color: colors.text },
  tierCostUnit: { fontSize: 28, fontWeight: "900", color: colors.text },
  benefits: { marginTop: 10, gap: 6 },
  benefit: { fontSize: 13, fontWeight: "800", color: colors.text },
  balanceText: { marginTop: 14, fontSize: 13, color: colors.text },
  warnText: { marginTop: 6, fontSize: 12, fontWeight: "900", color: colors.desaprovo },
  section: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 4, marginBottom: 10 },
  emptyText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, paddingVertical: 24, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  thumb: { width: "47%", borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bg, ...brutalShadow },
  thumbSelected: { borderColor: colors.aprovo, backgroundColor: colors.aprovo },
  thumbImage: { width: "100%", aspectRatio: 1 },
  thumbFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, borderTopWidth: 3, borderTopColor: colors.border },
  thumbWord: { flex: 1, fontSize: 13, fontWeight: "900", color: colors.text, letterSpacing: 1 },
  submitBtn: { marginTop: 28, backgroundColor: colors.text, height: 60, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.border, ...brutalShadow },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.textInverse },
  disclaimer: { marginTop: 14, fontSize: 11, fontWeight: "700", color: colors.textSecondary, textAlign: "center" },
});
