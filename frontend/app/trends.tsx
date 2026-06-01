import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Theme = { key: string; name: string; emoji: string; covers: string };
type TrendItem = { word: string; theme: string | null; votes: number; aprovo_pct: number };

const PERIODS = [
  { key: "24h", label: "24H" },
  { key: "7d",  label: "7D" },
  { key: "30d", label: "30D" },
];
const SCOPES = [
  { key: "world",   label: "MUNDO" },
  { key: "country", label: "PT", code: "PT" },
];

export default function TrendsScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"world"|"country">("world");
  const [period, setPeriod] = useState<"24h"|"7d"|"30d">("24h");
  const [theme, setTheme] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope, period, ...(theme ? {theme} : {}), ...(scope==="country" ? {country_code: "PT"} : {}) }).toString();
      const [tr, th] = await Promise.all([
        apiFetch(`/api/trends?${qs}`),
        themes.length ? Promise.resolve(null) : apiFetch("/api/themes"),
      ]);
      if (tr.ok) setItems((await tr.json()).items || []);
      if (th && th.ok) setThemes(await th.json());
    } finally { setLoading(false); }
  }, [apiFetch, scope, period, theme, themes.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>TENDÊNCIAS</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.filters}>
        <View style={styles.row}>
          {SCOPES.map((s) => (
            <TouchableOpacity key={s.key} onPress={() => setScope(s.key as any)} style={[styles.chip, scope === s.key && styles.chipActive]}>
              <Text style={[styles.chipText, scope === s.key && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 8 }} />
          {PERIODS.map((p) => (
            <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key as any)} style={[styles.chip, period === p.key && styles.chipActive]}>
              <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={[{ key: "_all", name: "TODOS", emoji: "✦" }, ...themes]}
          keyExtractor={(t: any) => t.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingTop: 8 }}
          renderItem={({ item }: any) => {
            const active = (item.key === "_all" && !theme) || theme === item.key;
            return (
              <TouchableOpacity onPress={() => setTheme(item.key === "_all" ? null : item.key)} style={[styles.themeChip, active && styles.themeChipActive]}>
                <Text style={styles.themeChipText}>{item.emoji} {item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.word}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={<Text style={styles.empty}>Sem dados ainda. Volta em breve.</Text>}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => router.push(`/word/${encodeURIComponent(item.word)}`)} style={styles.item}>
              <Text style={styles.rank}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.word}>#{item.word}</Text>
                <Text style={styles.meta}>{item.votes} votos · {item.aprovo_pct}% APROVO{item.theme ? ` · ${item.theme.toUpperCase()}` : ""}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 4, borderBottomColor: colors.border, gap: 12 },
  back: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  filters: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 3, borderBottomColor: colors.border, backgroundColor: colors.bgSubtle },
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
  chip: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.neutral },
  chipText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  chipTextActive: { color: colors.text },
  themeChip: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.bg },
  themeChipActive: { backgroundColor: colors.aprovo },
  themeChipText: { fontSize: 11, fontWeight: "900", color: colors.text, letterSpacing: 0.5 },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bg, padding: 12, ...brutalShadow },
  rank: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -1, minWidth: 32 },
  word: { fontSize: 18, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  meta: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.5, marginTop: 2 },
});
