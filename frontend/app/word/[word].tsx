import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Post = {
  post_id: string;
  word: string;
  image_base64: string;
  author_name: string;
  aprovo_count: number;
  desaprovo_count: number;
};

type Stats = { word: string; posts_count: number; aprovo_total: number; desaprovo_total: number };

export default function WordScreen() {
  const { word: rawWord } = useLocalSearchParams<{ word: string }>();
  const word = (rawWord || "").toUpperCase();
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        apiFetch(`/api/posts?word=${encodeURIComponent(word)}`),
        apiFetch(`/api/words/${encodeURIComponent(word)}/stats`),
      ]);
      if (r1.ok) setPosts(await r1.json());
      if (r2.ok) setStats(await r2.json());
    } finally {
      setLoading(false);
    }
  }, [apiFetch, word]);

  useEffect(() => { load(); }, [load]);

  const total = stats ? stats.aprovo_total + stats.desaprovo_total : 0;
  const aprovoPct = total === 0 ? 50 : Math.round(((stats?.aprovo_total ?? 0) / total) * 100);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="btn-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>#{word}</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.post_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.statsBlock}>
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats?.posts_count ?? 0}</Text>
                <Text style={styles.statLabel}>POSTS</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.aprovo }]}>
                <Text style={styles.statValue}>{stats?.aprovo_total ?? 0}</Text>
                <Text style={styles.statLabel}>APROVO</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.desaprovo }]}>
                <Text style={styles.statValue}>{stats?.desaprovo_total ?? 0}</Text>
                <Text style={styles.statLabel}>DESAPROVO</Text>
              </View>
            </View>
            {total > 0 && (
              <>
                <View style={styles.voteBar}>
                  <View style={[styles.voteBarFill, { width: `${aprovoPct}%`, backgroundColor: colors.aprovo }]} />
                </View>
                <Text style={styles.verdict}>VEREDITO COLETIVO: {aprovoPct}% APROVO</Text>
              </>
            )}
            <Text style={styles.section}>TODOS OS POSTS COM #{word}</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.empty}>Nenhum post com essa palavra ainda.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <Image source={{ uri: item.image_base64 }} style={styles.gridImage} />
            <View style={styles.gridFooter}>
              <Ionicons name="thumbs-up" size={10} color={colors.text} />
              <Text style={styles.gridFooterText}>{item.aprovo_count}</Text>
              <Ionicons name="thumbs-down" size={10} color={colors.text} style={{ marginLeft: 6 }} />
              <Text style={styles.gridFooterText}>{item.desaprovo_count}</Text>
            </View>
          </View>
        )}
      />
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
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },

  listContent: { padding: 20, paddingBottom: 40, gap: 12 },
  statsBlock: { gap: 12, marginBottom: 8 },
  statRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.border, paddingVertical: 14, alignItems: "center", ...brutalShadow },
  statValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 2 },

  voteBar: { height: 16, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.desaprovo, overflow: "hidden" },
  voteBarFill: { height: "100%" },
  verdict: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.text, textAlign: "center" },
  section: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 10 },

  empty: { textAlign: "center", marginTop: 40, fontSize: 14, fontWeight: "600", color: colors.textSecondary },

  gridItem: { flex: 1, marginBottom: 12, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bg, ...brutalShadow },
  gridImage: { width: "100%", aspectRatio: 1 },
  gridFooter: { flexDirection: "row", alignItems: "center", padding: 6, borderTopWidth: 3, borderTopColor: colors.border, gap: 3 },
  gridFooterText: { fontSize: 11, fontWeight: "900", color: colors.text },
});
