import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Platform,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, brutalShadow } from "@/src/theme";

export type CommentItem = {
  comment_id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string | null;
  word: string;
  created_at: string;
};

export type PostItem = {
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
  top_comments: CommentItem[];
  is_sponsored?: boolean;
  campaign_id?: string | null;
};

type Props = {
  post: PostItem;
  currentUserId: string | null;
  onVote: (id: string, v: "aprovo" | "desaprovo") => void;
  onComment: (id: string, word: string) => void;
  onDeleteComment: (id: string) => void;
  onReport: (id: string) => void;
  onDeletePost: (id: string) => void;
  onWordPress: (word: string) => void;
};

function sanitizeWord(input: string): string {
  return input
    .replace(/\s+/g, "")
    .replace(/[^A-Za-zÀ-ÿ0-9]/g, "")
    .slice(0, 20);
}

export default function PostCard({
  post,
  currentUserId,
  onVote,
  onComment,
  onDeleteComment,
  onReport,
  onDeletePost,
  onWordPress,
}: Props) {
  const total = post.aprovo_count + post.desaprovo_count;
  const aprovoPct = total === 0 ? 50 : Math.round((post.aprovo_count / total) * 100);
  const [commentInput, setCommentInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwn = currentUserId === post.author_id;
  const hasMyComment = !!post.user_comment;

  const handleSubmit = async () => {
    const cleaned = sanitizeWord(commentInput);
    if (!cleaned) return;
    setSubmitting(true);
    try {
      await onComment(post.post_id, cleaned);
      setCommentInput("");
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    setCommentInput((post.user_comment || "").toUpperCase());
    setEditing(true);
  };

  const cancelEdit = () => {
    setCommentInput("");
    setEditing(false);
  };

  const handleShare = async () => {
    const origin =
      typeof window !== "undefined" && (window as any).location
        ? (window as any).location.origin
        : "https://besord.app";
    const url = `${origin}/word/${encodeURIComponent(post.word)}`;
    const message = `BESORD — #${post.word}\n${aprovoPct}% APROVO • ${100 - aprovoPct}% DESAPROVO\n${total} votos\n${url}`;
    try {
      if (Platform.OS === "web" && (navigator as any).share) {
        await (navigator as any).share({ title: `Besord #${post.word}`, text: message, url });
      } else if (Platform.OS === "web" && typeof window !== "undefined") {
        await navigator.clipboard?.writeText(message);
        if (typeof window !== "undefined" && (window as any).alert) {
          (window as any).alert("Veredito copiado!");
        }
      } else {
        await Share.share({ message, title: `Besord #${post.word}` });
      }
    } catch {}
  };

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
        <Text style={styles.authorName} numberOfLines={1}>
          {post.author_name.toUpperCase()}
        </Text>
        {isOwn ? (
          <TouchableOpacity
            testID={`btn-delete-${post.post_id}`}
            onPress={() => onDeletePost(post.post_id)}
            style={[styles.iconBtn, { backgroundColor: colors.desaprovo }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID={`btn-report-${post.post_id}`}
            onPress={() => onReport(post.post_id)}
            style={styles.iconBtn}
          >
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
          <Text style={styles.wordOverlayText} numberOfLines={1}>
            #{post.word}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.voteRow}>
        <TouchableOpacity
          testID={`btn-aprovo-${post.post_id}`}
          style={[
            styles.voteBtn,
            { backgroundColor: colors.aprovo },
            post.user_vote === "aprovo" && styles.voteBtnActive,
          ]}
          onPress={() => onVote(post.post_id, "aprovo")}
          activeOpacity={0.8}
        >
          <Ionicons name="thumbs-up" size={20} color={colors.text} />
          <Text style={styles.voteBtnText}>APROVO</Text>
          <Text style={styles.voteCount}>{post.aprovo_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`btn-desaprovo-${post.post_id}`}
          style={[
            styles.voteBtn,
            { backgroundColor: colors.desaprovo },
            post.user_vote === "desaprovo" && styles.voteBtnActive,
          ]}
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
        <TouchableOpacity
          testID={`btn-share-${post.post_id}`}
          onPress={handleShare}
          style={styles.shareBtn}
        >
          <Ionicons name="share-social" size={14} color={colors.text} />
          <Text style={styles.shareText}>PARTILHAR</Text>
        </TouchableOpacity>
        <Text style={styles.voteStatText}>{100 - aprovoPct}% DESAPROVO</Text>
      </View>

      <View style={styles.commentsBlock}>
        <View style={styles.commentsHeader}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.text} />
          <Text style={styles.commentsTitle}>
            {post.comments_count} COMENTÁRIOS (1 PALAVRA)
          </Text>
        </View>

        {post.top_comments.slice(0, 3).map((c) => (
          <View key={c.comment_id} style={styles.commentRow}>
            {c.user_picture ? (
              <Image source={{ uri: c.user_picture }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.avatarFallback]}>
                <Text style={styles.commentAvatarText}>
                  {c.user_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.commentName} numberOfLines={1}>
              {c.user_name.split(" ")[0].toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => onWordPress(c.word)} activeOpacity={0.7}>
              <Text style={styles.commentWord}>#{c.word}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {hasMyComment && !editing && (
          <View style={styles.myCommentRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.text} />
            <Text style={styles.myCommentLabel}>O TEU:</Text>
            <Text style={styles.myCommentWord}>#{post.user_comment}</Text>
            <View style={styles.myCommentActions}>
              <TouchableOpacity
                testID={`btn-edit-comment-${post.post_id}`}
                style={[styles.tinyBtn, { backgroundColor: colors.neutral }]}
                onPress={startEdit}
              >
                <Ionicons name="pencil" size={12} color={colors.text} />
                <Text style={styles.tinyBtnText}>EDITAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`btn-delete-comment-${post.post_id}`}
                style={[styles.tinyBtn, { backgroundColor: colors.desaprovo }]}
                onPress={() => onDeleteComment(post.post_id)}
              >
                <Ionicons name="trash-outline" size={12} color={colors.text} />
                <Text style={styles.tinyBtnText}>REMOVER</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(!hasMyComment || editing) && (
          <View style={styles.commentInputRow}>
            <TextInput
              testID={`input-comment-${post.post_id}`}
              style={styles.commentInput}
              placeholder={editing ? "NOVA PALAVRA" : "1 PALAVRA"}
              placeholderTextColor="#A1A1AA"
              value={commentInput}
              onChangeText={(t) => setCommentInput(sanitizeWord(t).toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              editable={!submitting}
            />
            <TouchableOpacity
              testID={`btn-comment-${post.post_id}`}
              style={[
                styles.commentSendBtn,
                (!commentInput || submitting) && styles.commentSendBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!commentInput || submitting}
            >
              <Ionicons name="send" size={16} color={colors.text} />
            </TouchableOpacity>
            {editing && (
              <TouchableOpacity
                testID={`btn-cancel-edit-comment-${post.post_id}`}
                style={[styles.commentSendBtn, { backgroundColor: colors.bgSubtle }]}
                onPress={cancelEdit}
              >
                <Ionicons name="close" size={16} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  sponsoredBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  sponsoredText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontWeight: "900", color: colors.text },
  authorName: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text, flex: 1 },
  iconBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },

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

  voteBar: {
    height: 16,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.desaprovo,
    marginTop: 10,
    overflow: "hidden",
  },
  voteBarFill: { height: "100%" },
  voteStatRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  voteStatText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.neutral,
  },
  shareText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },

  commentsBlock: {
    marginTop: 14,
    borderTopWidth: 3,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  commentsHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentsTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.text },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAvatar: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  commentAvatarText: { fontSize: 10, fontWeight: "900", color: colors.text },
  commentName: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.textSecondary,
    flexShrink: 1,
    minWidth: 50,
  },
  commentWord: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.3,
    textDecorationLine: "underline",
  },

  myCommentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexWrap: "wrap",
  },
  myCommentLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  myCommentWord: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  myCommentActions: { flexDirection: "row", gap: 6, marginLeft: "auto" },
  tinyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tinyBtnText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },

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
  commentSendBtn: {
    width: 42,
    height: 42,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.aprovo,
    alignItems: "center",
    justifyContent: "center",
  },
  commentSendBtnDisabled: { backgroundColor: colors.bgSubtle, opacity: 0.6 },
});
