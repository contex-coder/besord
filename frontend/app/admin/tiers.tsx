import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Tier = {
  key: string;
  name: string;
  scope: string;
  duration_days: number;
  amount_cents: number;
  included_votes: number;
  is_overridden: boolean;
  overridden_at?: string | null;
};

export default function AdminTiersScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { price: string; votes: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/admin/tiers");
      if (r.ok) {
        const data = (await r.json()) as Tier[];
        setTiers(data);
        const next: Record<string, { price: string; votes: string }> = {};
        data.forEach((t) => {
          next[t.key] = {
            price: (t.amount_cents / 100).toFixed(2),
            votes: String(t.included_votes),
          };
        });
        setEdits(next);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmWeb = (msg: string) => {
    if (Platform.OS !== "web") return false;
    return typeof window !== "undefined" && window.confirm(msg);
  };

  const save = async (tier: Tier) => {
    const edit = edits[tier.key];
    if (!edit) return;
    const priceEur = parseFloat(edit.price.replace(",", "."));
    const votes = parseInt(edit.votes, 10);
    if (!Number.isFinite(priceEur) || priceEur < 1) {
      Alert.alert("Preço inválido", "Mínimo: 1,00 EUR");
      return;
    }
    if (!Number.isFinite(votes) || votes < 10) {
      Alert.alert("Votos inválidos", "Mínimo: 10");
      return;
    }
    const amount_cents = Math.round(priceEur * 100);

    const doSave = async () => {
      setSaving(tier.key);
      try {
        const r = await apiFetch("/api/admin/tiers", {
          method: "POST",
          body: JSON.stringify({ tier_key: tier.key, amount_cents, included_votes: votes }),
        });
        if (r.ok) {
          await load();
          if (Platform.OS === "web" && typeof window !== "undefined") {
            (window as any).alert(`${tier.name}: €${priceEur.toFixed(2)} · ${votes} votos gravado.`);
          } else {
            Alert.alert("Gravado", `${tier.name} actualizado.`);
          }
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Não foi possível gravar.");
        }
      } finally {
        setSaving(null);
      }
    };

    const msg = `Confirmar atualização do plano ${tier.name}?\n\n` +
                `Preço: €${priceEur.toFixed(2)}\n` +
                `Votos incluídos: ${votes}\n\n` +
                `(Afecta apenas campanhas criadas a partir de agora.)`;
    if (Platform.OS === "web") {
      if (confirmWeb(msg)) await doSave();
      return;
    }
    Alert.alert("Confirmar", msg, [
      { text: "Cancelar", style: "cancel" },
      { text: "Gravar", onPress: doSave },
    ]);
  };

  const reset = async (tier: Tier) => {
    const doReset = async () => {
      setSaving(tier.key);
      try {
        const r = await apiFetch(`/api/admin/tiers/${tier.key}`, { method: "DELETE" });
        if (r.ok) await load();
      } finally {
        setSaving(null);
      }
    };
    const msg = `Repor ${tier.name} aos valores por defeito do código?`;
    if (Platform.OS === "web") {
      if (confirmWeb(msg)) await doReset();
      return;
    }
    Alert.alert("Repor", msg, [
      { text: "Cancelar", style: "cancel" },
      { text: "Repor", style: "destructive", onPress: doReset },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>PREÇOS DOS PLANOS</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View style={styles.intro}>
          <Ionicons name="information-circle" size={14} color={colors.text} />
          <Text style={styles.introText}>
            Alterações afectam <Text style={{ fontWeight: "900" }}>apenas novas campanhas</Text>.
            Campanhas já criadas mantêm o preço pago. Tudo fica registado em audit log.
          </Text>
        </View>

        {tiers.map((t) => {
          const e = edits[t.key] || { price: "", votes: "" };
          return (
            <View key={t.key} style={styles.card} testID={`tier-${t.key}`}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>{t.name}</Text>
                  <Text style={styles.tierMeta}>{t.scope.toUpperCase()} · {t.duration_days}D</Text>
                </View>
                {t.is_overridden && (
                  <View style={styles.overrideBadge}>
                    <Ionicons name="pencil" size={10} color={colors.text} />
                    <Text style={styles.overrideText}>EDITADO</Text>
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>PREÇO (€)</Text>
                  <TextInput
                    testID={`input-price-${t.key}`}
                    style={styles.input}
                    value={e.price}
                    onChangeText={(v) => setEdits((p) => ({ ...p, [t.key]: { ...p[t.key], price: v.replace(/[^0-9.,]/g, "") } }))}
                    keyboardType="decimal-pad"
                    placeholder="19.00"
                    placeholderTextColor="#A1A1AA"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>VOTOS INCLUÍDOS</Text>
                  <TextInput
                    testID={`input-votes-${t.key}`}
                    style={styles.input}
                    value={e.votes}
                    onChangeText={(v) => setEdits((p) => ({ ...p, [t.key]: { ...p[t.key], votes: v.replace(/[^0-9]/g, "") } }))}
                    keyboardType="number-pad"
                    placeholder="1000"
                    placeholderTextColor="#A1A1AA"
                  />
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  testID={`btn-save-${t.key}`}
                  style={[styles.saveBtn, saving === t.key && styles.btnDisabled]}
                  onPress={() => save(t)}
                  disabled={saving === t.key}
                >
                  {saving === t.key ? <ActivityIndicator size="small" color={colors.text} /> : (
                    <>
                      <Ionicons name="checkmark" size={16} color={colors.text} />
                      <Text style={styles.saveText}>GRAVAR</Text>
                    </>
                  )}
                </TouchableOpacity>
                {t.is_overridden && (
                  <TouchableOpacity
                    testID={`btn-reset-${t.key}`}
                    style={styles.resetBtn}
                    onPress={() => reset(t)}
                    disabled={saving === t.key}
                  >
                    <Ionicons name="refresh" size={14} color={colors.text} />
                    <Text style={styles.resetText}>REPOR DEFAULT</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  intro: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    padding: 12,
  },
  introText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.text, lineHeight: 18 },
  card: {
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 16,
    gap: 12,
    ...brutalShadow,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  tierName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  tierMeta: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: colors.textSecondary, marginTop: 2 },
  overrideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overrideText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginBottom: 4 },
  input: {
    borderWidth: 3,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  saveBtn: {
    flex: 1,
    height: 48,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.aprovo,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...brutalShadow,
  },
  saveText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  resetBtn: {
    height: 48,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 6,
  },
  resetText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text },
  btnDisabled: { opacity: 0.5 },
});
