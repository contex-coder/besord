
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import PostCard, { PostItem } from "@/src/components/PostCard";
import BeetleMascot from "@/src/components/BeetleMascot";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_SMALL = SCREEN_W < 380;

type SortMode = "recent" | "trending" | "styles";
type ScopeMode = "world" | "country" | "city";

type Theme = { key: string; name: string; emoji: string; covers: string };

const SCOPES = [



  { key: "world" as ScopeMode, label: IS_SMALL ? "🌍" : "🌍 MUNDO" },
  { key: "country" as ScopeMode, label: IS_SMALL ? "🇵🇹" : "🇵🇹 PT" },
  { key: "city" as ScopeMode, label: IS_SMALL ? "📍" : "📍 CIDADE" },
];

export default function FeedScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");
  const [scope, setScope] = useState<ScopeMode>("world");
  const [scopeCountry, setScopeCountry] = useState<string | null>(null);
  const [scopeCity, setScopeCity] = useState<string | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);

  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [mascotTapCount, setMascotTapCount] = useState(0);
  const [showMascot, setShowMascot] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mascot phrases cycle based on taps
  const mascotPhrases = [
    "BESORD!",
    "VOTA! ✅",
    "🔥 EM ALTA!",
    "BW +1!",
    "BOOST! 🚀",
    "👑 REI!",
  ];
  const mascotPhrase = mascotPhrases[mascotTapCount % mascotPhrases.length];

  const handleMascotPress = () => {
    setMascotTapCount((prev) => prev + 1);
  };

  // Load geo info on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/geo/me");
        if (r.ok) {
          const data = await r.json();
          if (data.country_code) setScopeCountry(data.country_code);
          if (data.city) setScopeCity(data.city);
        }
      } catch {}
    })();
  }, [apiFetch]);

  // Load themes once
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/themes");
        if (r.ok) setThemes(await r.json());
      } catch {}
    })();
  }, [apiFetch]);

  const buildQueryString = useCallback(
    (mode: SortMode, sc: ScopeMode, th: string | null) => {
      const params = new URLSearchParams();
      if (mode === "styles") {
        params.set("source", "styles");
        params.set("sort", "recent");
      } else {
        params.set("sort", mode);
      }
      params.set("scope", sc);
      if (sc === "country" && scopeCountry) params.set("country_code", scopeCountry);
      if (sc === "city" && scopeCity) params.set("city", scopeCity);
      if (th) params.set("theme", th);
      return params.toString();
    },
    [scopeCountry, scopeCity]
  );

  const load = useCallback(
    async (mode: SortMode = sort, sc: ScopeMode = scope, th: string | null = activeTheme) => {
      try {
        const qs = buildQueryString(mode, sc, th);
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
    [apiFetch, sort, scope, activeTheme, buildQueryString]
  );

  // Reload when any filter changes
  useEffect(() => {
    load(sort, scope, activeTheme);
  }, [sort, scope, activeTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      load(sort, scope, activeTheme);
    }, [load, sort, scope, activeTheme])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(sort, scope, activeTheme);
  }, [load, sort, scope, activeTheme]);

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
          load(sort, scope, activeTheme);
        }
      } catch {
        load(sort, scope, activeTheme);
      }
    },
    [apiFetch, load, sort, scope, activeTheme]
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
            load(sort, scope, activeTheme);
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
    [apiFetch, load, sort, scope, activeTheme]
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <BeetleMascot
            size={36}
            interactive={true}
            showSpeech={mascotTapCount > 0}
            speechText={mascotPhrase}
            onPress={handleMascotPress}
          />
          <Text style={styles.brand}>BESORD</Text>
        </View>
        <TouchableOpacity testID="btn-trends" onPress={() => router.push("/trends")} style={styles.trendsBtn}>
          <Ionicons name="trending-up" size={14} color={colors.text} />
          <Text style={styles.trendsText}>TRENDS</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Scope Bar ─── */}
      <View style={styles.scopeBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          {SCOPES.map((s) => {
            const isActive = scope === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.scopeChip, isActive && styles.scopeChipActive]}
                onPress={() => setScope(s.key)}
              >
                <Text style={[styles.scopeChipText, isActive && styles.scopeChipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Theme Bar ─── */}
      <View style={styles.themeBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          <TouchableOpacity
            style={[styles.themeChip, activeTheme === null && styles.themeChipActive]}
            onPress={() => setActiveTheme(null)}
          >
            <Text style={[styles.themeChipText, activeTheme === null && styles.themeChipTextActive]}>✦ TODOS</Text>
          </TouchableOpacity>
          {themes.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.themeChip, activeTheme === t.key && styles.themeChipActive]}
              onPress={() => setActiveTheme(activeTheme === t.key ? null : t.key)}
            >
              <Text style={[styles.themeChipText, activeTheme === t.key && styles.themeChipTextActive]}>
                {t.emoji} {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ─── Sort Toggle ─── */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          testID="sort-recent"
          style={[styles.sortBtn, sort === "recent" && styles.sortBtnActive]}
          onPress={() => setSort("recent")}
        >
          <Text style={[styles.sortText, sort === "recent" && styles.sortTextActive]}>RECENTE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="sort-trending"
          style={[styles.sortBtn, sort === "trending" && styles.sortBtnActive]}
          onPress={() => setSort("trending")}
        >
          <Ionicons name="flame" size={12} color={sort === "trending" ? colors.text : colors.textSecondary} />
          <Text style={[styles.sortText, sort === "trending" && styles.sortTextActive]}>EM ALTA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="sort-styles"
          style={[styles.sortBtn, sort === "styles" && styles.sortBtnActive]}
          onPress={() => setSort("styles")}
        >
          <Ionicons name="star" size={12} color={sort === "styles" ? colors.text : colors.textSecondary} />
          <Text style={[styles.sortText, sort === "styles" && styles.sortTextActive]}>ESTILOS</Text>
        </TouchableOpacity>
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
              {scope === "city" && scopeCity
                ? `Ainda não há posts em ${scopeCity.toUpperCase()}. Muda para MUNDO ou PT.`
                : scope === "country" && scopeCountry
                ? `Ainda não há posts em PT. Muda para MUNDO.`
                : "Seja o primeiro a postar uma imagem com uma palavra."}
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

  // ─── Scope Bar ───
  scopeBar: {
    paddingVertical: IS_SMALL ? 6 : 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  scopeChip: {
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: IS_SMALL ? 10 : 14,
    paddingVertical: IS_SMALL ? 5 : 7,
    backgroundColor: colors.bg,
  },
  scopeChipActive: { backgroundColor: colors.text },
  scopeChipText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5, color: colors.text },
  scopeChipTextActive: { color: colors.textInverse },

  // ─── Theme Bar ───
  themeBar: {
    paddingVertical: IS_SMALL ? 6 : 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  themeChip: {
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.bgSubtle,
  },
  themeChipActive: { backgroundColor: colors.aprovo },
  themeChipText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5, color: colors.textSecondary },
  themeChipTextActive: { color: colors.text },

  // ─── Sort ───
  sortRow: {
    flexDirection: "row",
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    ...brutalShadow,
  },
  sortBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: IS_SMALL ? 7 : 10,
    backgroundColor: colors.bg,
    borderRightWidth: 3,
    borderRightColor: colors.border,
  },
  sortBtnActive: { backgroundColor: colors.neutral },
  sortText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.textSecondary },
  sortTextActive: { color: colors.text },

  listContent: { padding: IS_SMALL ? 12 : 20, paddingBottom: 40, gap: IS_SMALL ? 20 : 32 },
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
