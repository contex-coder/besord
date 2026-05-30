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
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Comment = {
  comment_id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string | null;
  word: string;
  created_at: string;
};

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
  comments_count: number;
  user_vote?: "aprovo" | "desaprovo" | null;
  user_comment?: string | null;
  top_comments: Comment[];
  is_sponsored?: boolean;
  campaign_id?: string | null;
};

type SortMode = "recent" | "trending";

export default function FeedScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");

  const load = useCallback(async (mode: SortMode = sort) => {
    try {
      const r = await apiFetch(`/api/posts?sort=${mode}`);
      if (r.ok) {
        const data = await r.json();
        setPosts(data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch, sort]);

  useFocusEffect(useCallback(() => { load(sort); }, [load, sort]));

  useEffect(() => { load(sort); }, [sort]);  // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => { setRefreshing(true); load(sort); }, [load, sort]);

  const onVote = useCallback(async (post_id: string, vote: "aprovo" | "desaprovo") => {
    setPosts(prev => prev.map(p => {
      if (p.post_id !== post_id) return p;
      const prevVote = p.user_vote;
      let aprovo = p.aprovo_count, desaprovo = p.desaprovo_count;
      if (prevVote === vote) {
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
      const r = await apiFetch(`/api/posts/${post_id}/vote`, { method: "POST", body: JSON.stringify({ vote }) });
      if (r.ok) {
        const updated = await r.json();
        setPosts(prev => prev.map(p => p.post_id === post_id ? updated : p));
      } else load(sort);
    } catch { load(sort); }
  }, [apiFetch, load, sort]);

  const onComment = useCallback(async (post_id: string, word: string) => {
    try {
      const r = await apiFetch(`/api/posts/${post_id}/comment`, { method: "POST", body: JSON.stringify({ word }) });
      if (r.ok) {
        const updated = await r.json();
        setPosts(prev => prev.map(p => p.post_id === post_id ? updated : p));
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao comentar.");
      }
    } catch (e: any) { Alert.alert("Erro", e?.message || "Falha ao comentar."); }
  }, [apiFetch]);

  const onReport = useCallback(async (post_id: string) => {
    Alert.alert("Reportar post", "Deseja reportar este post como inadequado?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Reportar", style: "destructive", onPress: async () => {
        try {
          const r = await apiFetch(`/api/posts/${post_id}/report`, { method: "POST", body: JSON.stringify({}) });
          if (r.ok) {
            const data = await r.json();
            Alert.alert(data.hidden ? "Post ocultado" : "Obrigado!", data.hidden ? "Este post foi removido do feed." : "Sua denúncia foi registrada.");
            load(sort);
          }
        } catch {}
      }},
    ]);
  }, [apiFetch, load, sort]);

  const onWordPress = useCallback((word: string) => {
    router.push(`/word/${encodeURIComponent(word)}`);
  }, [router]);

  if (loading) {
    return <SafeAreaView style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.text} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>BESORD</Text>
        <View style={styles.sortToggle}>
          <TouchableOpacity testID="sort-recent" style={[styles.sortBtn, sort === "recent" && styles.sortBtnActive]} onPress={() => setSort("recent")}>
            <Text style={[styles.sortText, sort === "recent" && styles.sortTextActive]}>RECENTE</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="sort-trending" style={[styles.sortBtn, sort === "trending" && styles.sortBtnActive]} onPress={() => setSort("trending")}>
            <Ionicons name="flame" size={12} color={sort === "trending" ? colors.text : colors.textSecondary} />
            <Text style={[styles.sortText, sort === "trending" && styles.sortTextActive]}>EM ALTA</Text>
          </TouchableOpacity>
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
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={user?.user_id || null}
            onVote={onVote}
            onComment={onComment}
            onReport={onReport}
            onWordPress={onWordPress}
          />
        )}
      />
    </SafeAreaView>
  );
}

function PostCard({ post, currentUserId, onVote, onComment, onReport, onWordPress }: {
  post: Post;
  currentUserId: string | null;
  onVote: (id: string, v: "aprovo" | "desaprovo") => void;
  onComment: (id: string, word: string) => void;
  onReport: (id: string) => void;
  onWordPress: (word: string) => void;
}) {
  const total = post.aprovo_count + post.desaprovo_count;
  const aprovoPct = total === 0 ? 50 : Math.round((post.aprovo_count / total) * 100);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const cleaned = commentInput.replace(/\s+/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 20);
    if (!cleaned) return;
    setSubmitting(true);
    await onComment(post.post_id, cleaned);
    setCommentInput("");
    setSubmitting(false);
  };

  const isOwn = currentUserId === post.author_id;

  return (
    <View style={styles.card} testID={`post-card-${post.post_id}`}>
      {post.is_sponsored && (
        <View style={styles.sponsoredBadge} testID="sponsored-badge">
          <Ionicons name="megaphone" size={12} color={colors.text} />
          <Text style={styles.sponsoredText}>PATROCINADO</Text>
        </View>
      )}
      <View style={styles.authorRow}>
        {post.author_picture ? (
          <Image source={{ uri: post.author_picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{post.author_name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.authorName} numberOfLines={1}>{post.author_name.toUpperCase()}</Text>
        {!isOwn && (
          <TouchableOpacity testID={`btn-report-${post.post_id}`} onPress={() => onReport(post.post_id)} style={styles.reportBtn}>
            <Ionicons name="flag-outline" size={16} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.imageWrap}>
        <Image source={{ uri: post.image_base64 }} style={styles.postImage} resizeMode="cover" />
        <TouchableOpacity
          testID={`word-link-${post.post_id}`}
          style={styles.wordOverlay}
          onPress={() => onWordPress(post.word)}
          activeOpacity={0.7}
        >
          <Text style={styles.wordOverlayText} numberOfLines={1}>#{post.word}</Text>
        </TouchableOpacity>
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

      <View style={styles.voteBar}>
        <View style={[styles.voteBarFill, { width: `${aprovoPct}%`, backgroundColor: colors.aprovo }]} />
      </View>
      <View style={styles.voteStatRow}>
        <Text style={styles.voteStatText}>{aprovoPct}% APROVO</Text>
        <Text style={styles.voteStatText}>{100 - aprovoPct}% DESAPROVO</Text>
      </View>

      <View style={styles.commentsBlock}>
        <View style={styles.commentsHeader}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.text} />
          <Text style={styles.commentsTitle}>{post.comments_count} COMENTÁRIOS (1 PALAVRA)</Text>
        </View>
        {post.top_comments.slice(0, 3).map(c => (
          <View key={c.comment_id} style={styles.commentRow}>
            {c.user_picture ? (
              <Image source={{ uri: c.user_picture }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.avatarFallback]}>
                <Text style={styles.commentAvatarText}>{c.user_name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.commentName} numberOfLines={1}>{c.user_name.split(" ")[0].toUpperCase()}</Text>
            <TouchableOpacity onPress={() => onWordPress(c.word)} activeOpacity={0.7}>
              <Text style={styles.commentWord}>#{c.word}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.commentInputRow}>
          <TextInput
            testID={`input-comment-${post.post_id}`}
            style={styles.commentInput}
            placeholder={post.user_comment ? `SEU: ${post.user_comment}` : "1 PALAVRA"}
            placeholderTextColor="#A1A1AA"
            value={commentInput}
            onChangeText={(t) => setCommentInput(t.replace(/\s+/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 20).toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />
          <TouchableOpacity
            testID={`btn-comment-${post.post_id}`}
            style={[styles.commentSendBtn, (!commentInput || submitting) && styles.commentSendBtnDisabled]}
            onPress={handleSubmit}
            disabled={!commentInput || submitting}
          >
            <Ionicons name="send" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
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
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 26, fontWeight: "900", letterSpacing: -1, color: colors.text },
  sortToggle: { flexDirection: "row", borderWidth: 3, borderColor: colors.border, ...brutalShadow },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.bg },
  sortBtnActive: { backgroundColor: colors.neutral },
  sortText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.textSecondary },
  sortTextActive: { color: colors.text },

  listContent: { padding: 20, paddingBottom: 40, gap: 32 },
  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },

  card: { gap: 10 },
  sponsoredBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.neutral, borderWidth: 3, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2 },
  sponsoredText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontWeight: "900", color: colors.text },
  authorName: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1 },
  reportBtn: { width: 32, height: 32, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },

  imageWrap: { borderWidth: 4, borderColor: colors.border, ...brutalShadow, backgroundColor: colors.bgSubtle },
  postImage: { width: "100%", aspectRatio: 4 / 5 },
  wordOverlay: {
    position: "absolute",
    bottom: -16,
    left: 12,
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...brutalShadow,
  },
  wordOverlayText: { fontSize: 30, fontWeight: "900", letterSpacing: -1, color: colors.text },

  voteRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  voteBtn: { flex: 1, height: 60, borderWidth: 3, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, ...brutalShadow },
  voteBtnActive: { transform: [{ translateY: 2 }, { translateX: 2 }], shadowOpacity: 0, elevation: 0 },
  voteBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  voteCount: { fontSize: 15, fontWeight: "900", color: colors.text, marginLeft: 4 },

  voteBar: { height: 16, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.desaprovo, marginTop: 10, overflow: "hidden" },
  voteBarFill: { height: "100%" },
  voteStatRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  voteStatText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },

  commentsBlock: { marginTop: 14, borderTopWidth: 3, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  commentsHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentsTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.text },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAvatar: { width: 24, height: 24, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  commentAvatarText: { fontSize: 10, fontWeight: "900", color: colors.text },
  commentName: { fontSize: 11, fontWeight: "900", color: colors.textSecondary, flexShrink: 1, minWidth: 50 },
  commentWord: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.3, textDecorationLine: "underline" },
  commentInputRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  commentInput: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  commentSendBtn: { width: 42, height: 42, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.aprovo, alignItems: "center", justifyContent: "center" },
  commentSendBtnDisabled: { backgroundColor: colors.bgSubtle, opacity: 0.6 },
});
