import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/s../../contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import PostCard, { PostItem } from "@/s../../components/PostCard";

type SortMode = "recent" | "trending" | "styles";

export default function FeedScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");

  const load = useCallback(
    async (mode: SortMode = sort) => {
      try {
        const qs = mode === "styles"
          ? "source=styles&sort=recent"
          : `sort=${mode}`;
        const r = await apiFetch(`/api/posts?${qs}`);
        if (r.ok) {
          const data = await r.json();
          setPosts(data);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiFetch, sort]
  );

  useFocusEffect(
    useCallback(() => {
      load(sort);
    }, [load, sort])
  );

  useEffect(() => {
    load(sort);
  }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(sort);
  }, [load, sort]);

  const onVote = useCallback(
    async (post_id: string, vote: "aprovo" | "desaprovo") => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.post_id !== post_id) return p;
          const prevVote = p.user_vote;
          let aprovo = p.aprovo_count,
            desaprovo = p.desaprovo_count;
          if (prevVote === vote) {
            if (vote === "aprovo") aprovo--;
            else desaprovo--;
            return { ...p, user_vote: null, aprovo_count: aprovo, desaprovo_count: desaprovo };
          }
          if (prevVote && prevVote !== vote) {
            if (prevVote === "aprovo") aprovo--;
            else desaprovo--;
          }
          if (vote === "aprovo") aprovo++;
          else desaprovo++;
          return { ...p, user_vote: vote, aprovo_count: aprovo, desaprovo_count: desaprovo };
        })
      );
      try {
        const r = await apiFetch(`/api/posts/${post_id}/vote`, {
          method: "POST",
          body: JSON.stringify({ vote }),
        });
        if (r.ok) {
          const updated = await r.json();
          setPosts((prev) => prev.map((p) => (p.post_id === post_id ? updated : p)));
        } else {
          load(sort);
        }
      } catch {
        load(sort);
      }
    },
    [apiFetch, load, sort]
  );

  const onComment = useCallback(
    async (post_id: string, word: string) => {
      try {
        const r = await apiFetch(`/api/posts/${post_id}/comment`, {
          method: "POST",
          body: JSON.stringify({ word }),
        });
        if (r.ok) {
          const updated = await r.json();
          setPosts((prev) => prev.map((p) => (p.post_id === post_id ? updated : p)));
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Falha ao comentar.");
        }
      } catch (e: any) {
        Alert.alert("Erro", e?.message || "Falha ao comentar.");
      }
    },
    [apiFetch]
  );

  const onDeleteComment = useCallback(
    async (post_id: string) => {
      const doDelete = async () => {
        try {
          const r = await apiFetch(`/api/posts/${post_id}/comment`, { method: "DELETE" });
          if (r.ok) {
            const updated = await r.json();
            setPosts((prev) => prev.map((p) => (p.post_id === post_id ? updated : p)));
          }
        } catch {}
      };
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm("Eliminar o teu comentário?")) {
          doDelete();
        }
        return;
      }
      Alert.alert("Eliminar comentário?", "", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: doDelete },
      ]);
    },
    [apiFetch]
  );

  const onDeletePost = useCallback(
    async (post_id: string) => {
      const doDelete = async () => {
        try {
          const r = await apiFetch(`/api/posts/${post_id}`, { method: "DELETE" });
          if (r.ok) {
            setPosts((prev) => prev.filter((p) => p.post_id !== post_id));
          } else {
            const err = await r.json().catch(() => ({}));
            Alert.alert("Erro", err.detail || "Não foi possível eliminar.");
          }
        } catch (e: any) {
          Alert.alert("Erro", e?.message || "Falha ao eliminar.");
        }
      };
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm("Eliminar este post? Esta ação é irreversível.")) {
          doDelete();
        }
        return;
      }
      Alert.alert("Eliminar post?", "Esta ação é irreversível.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: doDelete },
      ]);
    },
    [apiFetch]
  );

  const onReport = useCallback(
    async (post_id: string) => {
      const doReport = async () => {
        try {
          const r = await apiFetch(`/api/posts/${post_id}/report`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          if (r.ok) {
            const data = await r.json();
            Alert.alert(
              data.hidden ? "Post ocultado" : "Obrigado!",
              data.hidden ? "Este post foi removido do feed." : "Sua denúncia foi registrada."
            );
            load(sort);
          }
        } catch {}
      };
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm("Reportar este post como inadequado?")) {
          doReport();
        }
        return;
      }
      Alert.alert("Reportar post", "Deseja reportar este post como inadequado?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Reportar", style: "destructive", onPress: doReport },
      ]);
    },
    [apiFetch, load, sort]
  );

  const onWordPress = useCallback(
    (word: string) => {
      router.push(`/word/${encodeURIComponent(word)}`);
    },
    [router]
  );

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
        <Text style={styles.brand}>BESORD</Text>
        <TouchableOpacity testID="btn-trends" onPress={() => router.push("/trends")} style={styles.trendsBtn}>
          <Ionicons name="trending-up" size={14} color={colors.text} />
          <Text style={styles.trendsText}>TRENDS</Text>
        </TouchableOpacity>
        <View style={styles.sortToggle}>
          <TouchableOpacity
            testID="sort-recent"
            style={[styles.sortBtn, sort === "recent" && styles.sortBtnActive]}
            onPress={() => setSort("recent")}
          >
            <Text style={[styles.sortText, sort === "recent" && styles.sortTextActive]}>
              RECENTE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="sort-trending"
            style={[styles.sortBtn, sort === "trending" && styles.sortBtnActive]}
            onPress={() => setSort("trending")}
          >
            <Ionicons
              name="flame"
              size={12}
              color={sort === "trending" ? colors.text : colors.textSecondary}
            />
            <Text style={[styles.sortText, sort === "trending" && styles.sortTextActive]}>
              EM ALTA
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="sort-styles"
            style={[styles.sortBtn, sort === "styles" && styles.sortBtnActive]}
            onPress={() => setSort("styles")}
          >
            <Ionicons
              name="star"
              size={12}
              color={sort === "styles" ? colors.text : colors.textSecondary}
            />
            <Text style={[styles.sortText, sort === "styles" && styles.sortTextActive]}>
              ESTILOS
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="feed-empty">
            <Text style={styles.emptyTitle}>NADA POR AQUI</Text>
            <Text style={styles.emptySub}>
              Seja o primeiro a postar uma imagem com uma palavra.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={user?.user_id || null}
            onVote={onVote}
            onComment={onComment}
            onDeleteComment={onDeleteComment}
            onReport={onReport}
            onDeletePost={onDeletePost}
            onWordPress={onWordPress}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 26, fontWeight: "900", letterSpacing: -1, color: colors.text },
  trendsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.aprovo,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...brutalShadow,
  },
  trendsText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.text },
  sortToggle: {
    flexDirection: "row",
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  sortBtnActive: { backgroundColor: colors.neutral },
  sortText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  sortTextActive: { color: colors.text },

  listContent: { padding: 20, paddingBottom: 40, gap: 32 },
  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
