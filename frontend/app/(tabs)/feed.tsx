import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Post = {
  post_id: string;
  word: string;
  image_base64: string;
  author_id: string;
  author_name: string;
  author_picture?: string | null;
  created_at: string;
  aprovo_count: number;
  desaprovo_count: number;
  user_vote?: "aprovo" | "desaprovo" | null;
};

export default function FeedScreen() {
  const { apiFetch } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/posts");
      if (r.ok) {
        const data = await r.json();
        setPosts(data);
      }
    } catch (e) {
      console.warn("Failed to load posts", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const onVote = useCallback(
    async (post_id: string, vote: "aprovo" | "desaprovo") => {
      // Optimistic
      setPosts(prev => prev.map(p => {
        if (p.post_id !== post_id) return p;
        const prevVote = p.user_vote;
        let aprovo = p.aprovo_count;
        let desaprovo = p.desaprovo_count;
        if (prevVote === vote) {
          // toggle off
          if (vote === "aprovo") aprovo--; else desaprovo--;
          return { ...p, user_vote: null, aprovo_count: aprovo, desaprovo_count: desaprovo };
        }
        if (prevVote && prevVote !== vote) {
          if (prevVote === "aprovo") aprovo--; else desaprovo--;
        }
        if (vote === "aprovo") aprovo++; else desaprovo++;
        return { ...p, user_vote: vote, aprovo_count: aprovo, desaprovo_count: desaprovo };
      }));
      try {
        const r = await apiFetch(`/api/posts/${post_id}/vote`, {
          method: "POST",
          body: JSON.stringify({ vote }),
        });
        if (r.ok) {
          const updated = await r.json();
          setPosts(prev => prev.map(p => (p.post_id === post_id ? updated : p)));
        } else {
          load();
        }
      } catch {
        load();
      }
    },
    [apiFetch, load]
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
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>FEED</Text>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="feed-empty">
            <Text style={styles.emptyTitle}>NADA POR AQUI</Text>
            <Text style={styles.emptySub}>Seja o primeiro a postar uma imagem com uma palavra.</Text>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} onVote={onVote} />}
      />
    </SafeAreaView>
  );
}

function PostCard({ post, onVote }: { post: Post; onVote: (id: string, v: "aprovo" | "desaprovo") => void }) {
  const total = post.aprovo_count + post.desaprovo_count;
  const aprovoPct = total === 0 ? 50 : Math.round((post.aprovo_count / total) * 100);

  return (
    <View style={styles.card} testID={`post-card-${post.post_id}`}>
      <View style={styles.authorRow}>
        {post.author_picture ? (
          <Image source={{ uri: post.author_picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{post.author_name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.authorName} numberOfLines={1}>{post.author_name.toUpperCase()}</Text>
      </View>

      <View style={styles.imageWrap}>
        <Image source={{ uri: post.image_base64 }} style={styles.postImage} resizeMode="cover" />
        <View style={styles.wordOverlay}>
          <Text style={styles.wordOverlayText} numberOfLines={1}>{post.word}</Text>
        </View>
      </View>

      <View style={styles.voteRow}>
        <TouchableOpacity
          testID={`btn-aprovo-${post.post_id}`}
          style={[styles.voteBtn, { backgroundColor: colors.aprovo }, post.user_vote === "aprovo" && styles.voteBtnActive]}
          onPress={() => onVote(post.post_id, "aprovo")}
          activeOpacity={0.8}
        >
          <Ionicons name="thumbs-up" size={20} color={colors.text} />
          <Text style={styles.voteBtnText}>APROVO</Text>
          <Text style={styles.voteCount}>{post.aprovo_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`btn-desaprovo-${post.post_id}`}
          style={[styles.voteBtn, { backgroundColor: colors.desaprovo }, post.user_vote === "desaprovo" && styles.voteBtnActive]}
          onPress={() => onVote(post.post_id, "desaprovo")}
          activeOpacity={0.8}
        >
          <Ionicons name="thumbs-down" size={20} color={colors.text} />
          <Text style={styles.voteBtnText}>DESAPROVO</Text>
          <Text style={styles.voteCount}>{post.desaprovo_count}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.voteBar} testID={`vote-bar-${post.post_id}`}>
        <View style={[styles.voteBarFill, { width: `${aprovoPct}%`, backgroundColor: colors.aprovo }]} />
      </View>
      <View style={styles.voteStatRow}>
        <Text style={styles.voteStatText}>{aprovoPct}% APROVO</Text>
        <Text style={styles.voteStatText}>{100 - aprovoPct}% DESAPROVO</Text>
      </View>
    </View>
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
    paddingVertical: 16,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: colors.text },
  headerBadge: { backgroundColor: colors.neutral, borderWidth: 3, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 2, color: colors.text },
  listContent: { padding: 20, paddingBottom: 40, gap: 28 },
  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },

  card: { gap: 10 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 0, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontWeight: "900", color: colors.text },
  authorName: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1 },

  imageWrap: { borderWidth: 4, borderColor: colors.border, ...brutalShadow, backgroundColor: colors.bgSubtle },
  postImage: { width: "100%", aspectRatio: 4 / 5 },
  wordOverlay: {
    position: "absolute",
    bottom: -16,
    left: 12,
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...brutalShadow,
  },
  wordOverlayText: { fontSize: 32, fontWeight: "900", letterSpacing: -1, color: colors.text },

  voteRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  voteBtn: {
    flex: 1,
    height: 60,
    borderWidth: 3,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...brutalShadow,
  },
  voteBtnActive: { transform: [{ translateY: 2 }, { translateX: 2 }], shadowOpacity: 0, elevation: 0 },
  voteBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  voteCount: { fontSize: 15, fontWeight: "900", color: colors.text, marginLeft: 4 },

  voteBar: { height: 16, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.desaprovo, marginTop: 10, overflow: "hidden" },
  voteBarFill: { height: "100%" },
  voteStatRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  voteStatText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
});
