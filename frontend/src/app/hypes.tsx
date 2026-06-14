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
type HypeItem = { word: string; theme: string; votes: number; aprovo_pct: number };

export default function HypesScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [items, setItems] = useState<HypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ sort: "trending", ...(activeTheme ? { theme: activeTheme } : {}) }).toString();
      const [pr, th] = await Promise.all([
        apiFetch(`/api/posts?${qs}`),
        themes.length ? Promise.resolve(null) : apiFetch("/api/themes"),
      ]);
      if (pr.ok) {
        const data = await pr.json();
        // Group posts by theme
        const map = new Map<string, HypeItem>();
        for (const p of (data.posts || data || [])) {
          const t = p.theme || "geral";
          const existing = map.get(t);
          if (existing) {
            existing.votes += (p.aprovo_count || 0) + (p.desaprovo_count || 0);
          } else {
            map.set(t, {
              word: p.word,
              theme: t,
              votes: (p.aprovo_count || 0) + (p.desaprovo_count || 0),
              aprovo_pct: ((p.aprovo_count || 0) / Math.max(1, (p.aprovo_count || 0) + (p.desaprovo_count || 0))) * 100,
            });
          }
        }
        setItems(Array.from(map.values()).sort((a, b) => b.votes - a.votes));
      }
      if (th && th.ok) setThemes(await th.json());
    } finally { setLoading(false); }
  }, [apiFetch, activeTheme, themes.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>🔥 HYPES</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Theme filter chip row */}
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, activeTheme === null && styles.chipActive]}
          onPress={() => setActiveTheme(null)}
        >
          <Text style={[styles.chipText, activeTheme === null && styles.chipTextActive]}>✦ TODOS</Text>
        </TouchableOpacity>
        {themes.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, activeTheme === t.key && styles.chipActive]}
            onPress={() => setActiveTheme(activeTheme === t.key ? null : t.key)}
          >
            <Text style={[styles.chipText, activeTheme === t.key && styles.chipTextActive]}>
              {t.emoji} {t.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.text} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.word}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NADA EM HYPE</Text>
              <Text style={styles.emptySub}>Os posts com temas aparecem aqui. Ao criar um post, escolhe um hype!</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => router.push(`/word/${encodeURIComponent(item.word)}`)} style={styles.item}>
              <Text style={styles.rank}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.word}>#{item.word}</Text>
                <Text style={styles.meta}>
                  🔥 {item.theme.toUpperCase()} · {item.votes} votos · {Math.round(item.aprovo_pct)}% APROVO
                </Text>
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
  chipRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 3, borderBottomColor: colors.border, backgroundColor: colors.bgSubtle,
  },
  chip: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.aprovo },
  chipText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5, color: colors.textSecondary },
  chipTextActive: { color: colors.text },
  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bg, padding: 12, ...brutalShadow },
  rank: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -1, minWidth: 32 },
  word: { fontSize: 18, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  meta: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.5, marginTop: 2 },
});
