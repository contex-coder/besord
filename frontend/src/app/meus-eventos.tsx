import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type EventItem = {
  event_id: string;
  title: string;
  image_base64: string;
  date: string;
  checkins_count: number;
  status: string;
};

export default function MeusEventosVisitadosScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [votedPostIds, setVotedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"eventos" | "anuncios">("eventos");

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/me/event-posts-voted");
      if (r.ok) {
        const data = await r.json();
        setEvents(data.eventos || []);
        setPosts(data.posts || []);
        setVotedPostIds(data.voted_post_ids || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
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
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📍 MEUS EVENTOS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Tabs ─── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "eventos" && styles.tabActive]}
          onPress={() => setTab("eventos")}
        >
          <Ionicons name="location" size={16} color={tab === "eventos" ? colors.text : colors.textSecondary} />
          <Text style={[styles.tabText, tab === "eventos" && styles.tabTextActive]}>
            EVENTOS ({events.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "anuncios" && styles.tabActive]}
          onPress={() => setTab("anuncios")}
        >
          <Ionicons name="megaphone" size={16} color={tab === "anuncios" ? colors.text : colors.textSecondary} />
          <Text style={[styles.tabText, tab === "anuncios" && styles.tabTextActive]}>
            ANÚNCIOS VOTADOS ({posts.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tab === "eventos" ? events : posts}
        keyExtractor={(item: any) => tab === "eventos" ? item.event_id : item.post_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={tab === "eventos" ? "calendar-outline" : "megaphone-outline"}
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>
              {tab === "eventos" ? "NENHUM EVENTO VISITADO" : "NENHUM ANÚNCIO VOTADO"}
            </Text>
            <Text style={styles.emptySub}>
              {tab === "eventos"
                ? "Faz check-in em eventos para os veres aqui."
                : "Vota em anúncios de eventos para os seguires aqui."}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: any }) => {
          if (tab === "eventos") {
            const ev = item as EventItem;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/evento/${ev.event_id}`)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: ev.image_base64 }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View style={styles.cardInfo}>
                  <View style={styles.cardBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.aprovo} />
                    <Text style={styles.cardBadgeText}>ESTIVE LÁ</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{ev.title.toUpperCase()}</Text>
                  <Text style={styles.cardDate}>{ev.date?.split("T")[0] || ev.date}</Text>
                  <Text style={styles.cardMeta}>{ev.checkins_count || 0} check-ins</Text>
                </View>
                <View style={styles.cardArrow}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          } else {
            const post = item;
            const voted = votedPostIds.includes(post.post_id);
            return (
              <TouchableOpacity
                style={styles.postCard}
                onPress={() => router.push(`/evento/${post.event_id || "0"}`)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: post.image_base64 }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
                <View style={styles.postInfo}>
                  <Text style={styles.postWord}>#{post.word}</Text>
                  {post.event_title && (
                    <Text style={styles.postEvent}>{post.event_title}</Text>
                  )}
                  <View style={styles.postStats}>
                    <Text style={styles.postStat}>👍 {post.aprovo_count || 0}</Text>
                    <Text style={styles.postStat}>👎 {post.desaprovo_count || 0}</Text>
                    <Text style={styles.postStat}>💬 {post.comments_count || 0}</Text>
                  </View>
                  {voted && (
                    <View style={styles.votedBadge}>
                      <Ionicons name="checkmark" size={12} color={colors.text} />
                      <Text style={styles.votedBadgeText}>VOTASTE</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },

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

  // ─── Tabs ───
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.bg,
    borderRightWidth: 3,
    borderRightColor: colors.border,
  },
  tabActive: { backgroundColor: colors.neutral },
  tabText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  tabTextActive: { color: colors.text },

  listContent: { padding: 16, paddingBottom: 40, gap: 12 },

  // ─── Card (Evento) ───
  card: {
    flexDirection: "row",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
    overflow: "hidden",
  },
  cardImage: {
    width: 100,
    borderRightWidth: 3,
    borderRightColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  cardInfo: { flex: 1, padding: 12, gap: 4 },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.aprovo,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  cardBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },
  cardTitle: { fontSize: 14, fontWeight: "900", letterSpacing: -0.2, color: colors.text },
  cardDate: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  cardMeta: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  cardArrow: { justifyContent: "center", paddingRight: 12 },

  // ─── Post Card ───
  postCard: {
    flexDirection: "row",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
    overflow: "hidden",
  },
  postImage: {
    width: 80,
    borderRightWidth: 3,
    borderRightColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  postInfo: { flex: 1, padding: 10, gap: 4 },
  postWord: { fontSize: 16, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  postEvent: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  postStats: { flexDirection: "row", gap: 8 },
  postStat: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.aprovo,
    borderWidth: 2,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  votedBadgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // ─── Empty ───
  empty: { paddingTop: 80, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
});
