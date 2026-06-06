import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import ProfileSwitcher from "@/src/components/ProfileSwitcher";

type BizStats = {
  active_campaigns: number;
  total_events: number;
  total_spent: number;
  total_posts: number;
  total_votes_received: number;
  total_bw_distributed: number;
  total_event_checkins: number;
};

type BizEvent = {
  event_id: string;
  title: string;
  image_base64: string;
  date: string;
  checkins_count: number;
  exhibitors_count: number;
  prize?: string | null;
  status: string;
};

type BizPost = {
  post_id: string;
  word: string;
  aprovo_count: number;
  desaprovo_count: number;
  comments_count: number;
  created_at: string;
  event_title?: string | null;
};

type Workspace = {
  workspace_id: string;
  type: "personal" | "business";
  name: string;
  picture?: string | null;
  verified?: boolean;
  is_default?: boolean;
};

export default function BusinessDashboardScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<BizStats | null>(null);
  const [events, setEvents] = useState<BizEvent[]>([]);
  const [posts, setPosts] = useState<BizPost[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userWorkspace, setUserWorkspace] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [wsRes, statsRes] = await Promise.all([
        apiFetch("/api/workspaces"),
        apiFetch("/api/business/dashboard").catch(() => null),
      ]);

      if (wsRes.ok) {
        const wsData = await wsRes.json();
        const biz = wsData.workspaces.filter((w: any) => w.type === "business");
        setWorkspaces(biz);
        setActiveId(wsData.active_workspace_id || null);

        // Se existe active, guardar o workspace atual
        const act = biz.find((w: any) => w.workspace_id === wsData.active_workspace_id);
        setUserWorkspace(act || null);
      }

      if (statsRes && statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // Carregar eventos
      const eventsRes = await apiFetch("/api/events");
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(evData.filter((e: any) => e.is_owner));
      }

      // Carregar posts empresariais (através de campaigns)
      const campRes = await apiFetch("/api/business/campaigns");
      if (campRes.ok) {
        const campData = await campRes.json();
        const postsList = (campData.campaigns || campData).map((c: any) => ({
          post_id: c.post_id,
          word: c.word || "—",
          aprovo_count: c.aprovo_count || 0,
          desaprovo_count: c.desaprovo_count || 0,
          comments_count: c.comments_count || 0,
          created_at: c.created_at,
          event_title: c.event_title || null,
        }));
        setPosts(postsList);
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

  const handleSwitch = async (wsId: string) => {
    const r = await apiFetch(`/api/workspaces/${wsId}/activate`, { method: "POST" });
    if (r.ok) {
      setActiveId(wsId);
      load();
    } else {
      Alert.alert("Erro", "Não foi possível alternar o perfil.");
    }
  };

  const formatEuro = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  const hasBiz = workspaces.length > 0;
  const activeBiz = workspaces.find((w) => w.workspace_id === activeId);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏢 EMPRESA</Text>
        {hasBiz && (
          <ProfileSwitcher
            workspaces={workspaces}
            activeId={activeId}
            onSwitch={handleSwitch}
            onRefresh={onRefresh}
          />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        {!hasBiz ? (
          /* ─── Sem Empresa ─── */
          <View style={styles.emptyBiz}>
            <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyBizTitle}>NENHUMA EMPRESA ATIVA</Text>
            <Text style={styles.emptyBizSub}>
              Adiciona a tua empresa para criar eventos, postar anúncios e aceder a relatórios.
            </Text>
            <TouchableOpacity
              style={styles.emptyBizBtn}
              onPress={() => router.push("/workspaces?new=1")}
            >
              <Ionicons name="add" size={20} color={colors.text} />
              <Text style={styles.emptyBizBtnText}>ADICIONAR EMPRESA</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── Empresa Ativa ─── */}
            <View style={styles.activeBizBanner}>
              <View style={styles.bizIconLarge}>
                <Ionicons name="business" size={28} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bizName}>{activeBiz?.name?.toUpperCase() || "EMPRESA"}</Text>
                <View style={styles.bizStatusRow}>
                  <View
                    style={[
                      styles.bizStatus,
                      { backgroundColor: activeBiz?.verified ? colors.aprovo : colors.desaprovo },
                    ]}
                  >
                    <Text style={styles.bizStatusText}>
                      {activeBiz?.verified ? "✓ VERIFICADA" : "⚠ PENDENTE"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.configBtn}
                    onPress={() => router.push("/workspaces")}
                  >
                    <Ionicons name="settings-outline" size={14} color={colors.text} />
                    <Text style={styles.configBtnText}>CONFIG</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ─── Métricas ─── */}
            {stats && (
              <View style={styles.metricsGrid}>
                <MetricBox
                  label="CAMPANHAS ATIVAS"
                  value={String(stats.active_campaigns)}
                  icon="rocket"
                  bg={colors.neutral}
                />
                <MetricBox
                  label="GASTO TOTAL"
                  value={formatEuro(stats.total_spent)}
                  icon="cash"
                  bg={colors.aprovo}
                />
                <MetricBox
                  label="POSTS EVENTO"
                  value={String(stats.total_posts)}
                  icon="megaphone"
                  bg={colors.neutral}
                />
                <MetricBox
                  label="EVENTOS"
                  value={String(stats.total_events)}
                  icon="location"
                  bg={colors.aprovo}
                />
                <MetricBox
                  label="VOTOS RECEBIDOS"
                  value={String(stats.total_votes_received)}
                  icon="thumbs-up"
                  bg={colors.neutral}
                />
                <MetricBox
                  label="BW DISTRIBUÍDOS"
                  value={String(stats.total_bw_distributed)}
                  icon="wallet"
                  bg={colors.aprovo}
                />
              </View>
            )}

            {/* ─── Ações Rápidas ─── */}
            <Text style={styles.sectionTitle}>📋 AÇÕES RÁPIDAS</Text>
            <View style={styles.actionsGrid}>
              <ActionCard
                icon="location"
                label="CRIAR EVENTO"
                onPress={() => router.push("/business/evento/novo")}
              />
              <ActionCard
                icon="megaphone"
                label="POSTAR ANÚNCIO"
                onPress={() => router.push("/eventos")}
              />
              <ActionCard
                icon="bar-chart"
                label="RELATÓRIOS"
                onPress={() => router.push("/business/campaigns")}
              />
              <ActionCard
                icon="document-text"
                label="RECIBOS"
                onPress={() => router.push("/business/recibos")}
              />
            </View>

            {/* ─── Meus Eventos Ativos ─── */}
            {events.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>🎪 MEUS EVENTOS</Text>
                {events.map((ev) => {
                  const isExpired = ev.status === "expired";
                  return (
                    <TouchableOpacity
                      key={ev.event_id}
                      style={[styles.eventCard, isExpired && { opacity: 0.6 }]}
                      onPress={() => router.push(`/evento/${ev.event_id}`)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: ev.image_base64 }}
                        style={styles.eventImage}
                        resizeMode="cover"
                      />
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle}>{ev.title.toUpperCase()}</Text>
                        <View style={styles.eventMetaRow}>
                          <Text style={styles.eventMeta}>
                            📅 {ev.date?.split("T")[0] || ev.date}
                          </Text>
                          <Text style={styles.eventMeta}>
                            👥 {ev.checkins_count} check-ins
                          </Text>
                        </View>
                        <View style={styles.eventMetaRow}>
                          <Text style={styles.eventMeta}>
                            🏪 {ev.exhibitors_count} anúncios
                          </Text>
                          {ev.prize && (
                            <Text style={styles.eventMeta}>🎁 {ev.prize}</Text>
                          )}
                        </View>
                        {isExpired && (
                          <TouchableOpacity
                            style={styles.raffleBtn}
                            onPress={() => router.push(`/evento/${ev.event_id}/sorteio`)}
                          >
                            <Ionicons name="gift" size={12} color={colors.text} />
                            <Text style={styles.raffleBtnText}>SORTEAR PRÉMIO</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* ─── Últimos Posts (Anúncios) ─── */}
            {posts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>📊 ÚLTIMOS ANÚNCIOS</Text>
                {posts.slice(0, 5).map((p) => {
                  const total = p.aprovo_count + p.desaprovo_count;
                  const aprovoPct = total === 0 ? 50 : Math.round((p.aprovo_count / total) * 100);
                  return (
                    <TouchableOpacity
                      key={p.post_id}
                      style={styles.postCard}
                      onPress={() => router.push(`/evento/${p.event_title || "0"}/post/${p.post_id}/relatorio`)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.postHeader}>
                        <Text style={styles.postWord}>#{p.word}</Text>
                        {p.event_title && (
                          <Text style={styles.postEvent}>{p.event_title}</Text>
                        )}
                      </View>
                      <View style={styles.postStats}>
                        <View style={styles.postVoteBar}>
                          <View
                            style={[
                              styles.postVoteFill,
                              { width: `${aprovoPct}%`, backgroundColor: colors.aprovo },
                            ]}
                          />
                        </View>
                        <Text style={styles.postVoteText}>
                          👍 {p.aprovo_count} · 👎 {p.desaprovo_count} · 💬 {p.comments_count}
                        </Text>
                      </View>
                      <View style={styles.postActions}>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        <Text style={styles.postActionText}>VER RELATÓRIO</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-componentes ───

function MetricBox({ label, value, icon, bg }: { label: string; value: string; icon: string; bg: string }) {
  return (
    <View style={[styles.metricBox, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={18} color={colors.text} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={22} color={colors.text} />
      <Text style={styles.actionCardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },

  // ─── Header ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    gap: 10,
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
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text },

  content: { padding: 16, gap: 16, paddingBottom: 60 },

  // ─── Empty ───
  emptyBiz: { paddingTop: 80, alignItems: "center", gap: 10 },
  emptyBizTitle: { fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" },
  emptyBizSub: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 30, lineHeight: 18 },
  emptyBizBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  emptyBizBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },

  // ─── Active Biz Banner ───
  activeBizBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  bizIconLarge: {
    width: 48,
    height: 48,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.aprovo,
  },
  bizName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  bizStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  bizStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.border,
  },
  bizStatusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8, color: colors.text },
  configBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  configBtnText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8, color: colors.text },

  // ─── Metrics ───
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricBox: {
    width: "47%",
    padding: 12,
    borderWidth: 3,
    borderColor: colors.border,
    gap: 4,
    ...brutalShadow,
  },
  metricValue: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  metricLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // ─── Section ───
  sectionTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 8 },

  // ─── Actions ───
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: "47%",
    padding: 16,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    gap: 8,
    ...brutalShadow,
  },
  actionCardLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text, textAlign: "center" },

  // ─── Event Card ───
  eventCard: {
    flexDirection: "row",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
    overflow: "hidden",
  },
  eventImage: {
    width: 80,
    borderRightWidth: 3,
    borderRightColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  eventInfo: { flex: 1, padding: 10, gap: 4 },
  eventTitle: { fontSize: 13, fontWeight: "900", color: colors.text, letterSpacing: -0.2 },
  eventMetaRow: { flexDirection: "row", gap: 10 },
  eventMeta: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  raffleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  raffleBtnText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // ─── Post Card ───
  postCard: {
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 12,
    gap: 8,
    ...brutalShadow,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  postWord: { fontSize: 18, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  postEvent: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, flex: 1 },
  postStats: { gap: 4 },
  postVoteBar: {
    height: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.desaprovo,
    overflow: "hidden",
  },
  postVoteFill: { height: "100%" },
  postVoteText: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  postActionText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
});
