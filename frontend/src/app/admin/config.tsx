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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function AdminConfigScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventPostPrice, setEventPostPrice] = useState("999");

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/admin/config");
      if (r.ok) {
        const data = await r.json();
        setConfig(data);
        setEventPostPrice(data.event_post_price_cents || "999");
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key: string, value: string) => {
    setSaving(true);
    try {
      const r = await apiFetch(`/api/admin/config?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`, {
        method: "POST",
      });
      if (r.ok) {
        Alert.alert("✅ Guardado!", `${key} = ${value}`);
        load();
      } else {
        Alert.alert("Erro", "Falha ao guardar configuração.");
      }
    } catch {
      Alert.alert("Erro", "Falha ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>APENAS ADMIN</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙ CONFIGURAÇÕES</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── Preço do Anúncio em Evento ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 PREÇO DO ANÚNCIO EM EVENTO</Text>
          <Text style={styles.cardSub}>Valor em centavos de euro (ex: 999 = €9,99)</Text>

          <View style={styles.priceRow}>
            <Text style={styles.euroSign}>€</Text>
            <TextInput
              style={styles.priceInput}
              value={eventPostPrice}
              onChangeText={setEventPostPrice}
              keyboardType="numeric"
              placeholder="999"
              placeholderTextColor="#A1A1AA"
            />
            <Text style={styles.euroSign}>,{(parseInt(eventPostPrice || "0") % 100).toString().padStart(2, "0")}</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => save("event_post_price_cents", eventPostPrice)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="save" size={16} color={colors.text} />
                <Text style={styles.saveBtnText}>GUARDAR PREÇO</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Preço Atual ─── */}
        <View style={styles.currentPrice}>
          <Ionicons name="information-circle" size={16} color={colors.text} />
          <Text style={styles.currentPriceText}>
            Preço atual: <Text style={{ fontWeight: "900" }}>€{(parseInt(config.event_post_price_cents || "999") / 100).toFixed(2)}</Text>
            {" "}({config.event_post_price_cents || "999"} centavos)
          </Text>
        </View>

        {/* ─── Todas as configs ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 TODAS AS CONFIGS</Text>
          {Object.keys(config).length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma configuração personalizada.</Text>
          ) : (
            Object.entries(config).map(([key, value]) => (
              <View key={key} style={styles.configRow}>
                <Text style={styles.configKey}>{key}</Text>
                <Text style={styles.configValue}>{value}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", flex: 1 },

  // ─── Header ───
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

  content: { padding: 16, gap: 16, paddingBottom: 60 },

  // ─── Card ───
  card: {
    padding: 16,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 10,
    ...brutalShadow,
  },
  cardTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 0.5, color: colors.text },
  cardSub: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },

  // ─── Price ───
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  euroSign: { fontSize: 18, fontWeight: "900", color: colors.text },
  priceInput: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.bg,
    textAlign: "center",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  saveBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },

  // ─── Current Price ───
  currentPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
  },
  currentPriceText: { fontSize: 12, fontWeight: "600", color: colors.text },

  // ─── Configs ───
  emptyText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  configKey: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, flex: 1 },
  configValue: { fontSize: 12, fontWeight: "900", color: colors.text },
});
