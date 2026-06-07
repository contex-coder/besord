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
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userWorkspace, setUserWorkspace] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [wsRes, bizRes] = await Promise.all([
        apiFetch("/api/workspaces"),
        apiFetch("/api/business/dashboard"),
      ]);

      if (wsRes.ok) {
        const wsData = await wsRes.json();
        const biz = wsData.workspaces.filter((w: any) => w.type === "business");
        setWorkspaces(biz);
        setActiveId(wsData.active_workspace_id || null);
        const act = biz.find((w: any) => w.workspace_id === wsData.active_workspace_id);
        setUserWorkspace(act || null);
      }

      if (bizRes.ok) {
        const data = await bizRes.json();
        setStats(data);
        setEvents(data.eventos || []);
        setPosts(data.anuncios || []);
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

            {/* ─── Métricas do Dashboard Business ─── */}
            {stats && (
              <View style={styles.metricsGrid}>
                <MetricBox
                  label="EVENTOS"
                  value={String(stats.total_eventos || 0)}
                  icon="location"
                  bg={colors.neutral}
                />
                <MetricBox
                  label="ANÚNCIOS"
                  value={String(stats.total_anuncios || 0)}
                  icon="megaphone"
                  bg={colors.aprovo}
                />
                <MetricBox
                  label="CHECK-INS"
                  value={String(stats.total_checkins_recebidos || 0)}
                  icon="people"
                  bg={colors.neutral}
                />
                <MetricBox
                  label="👍 APROVO"
                  value={String(stats.total_aprovo || 0)}
                  icon="thumbs-up"
                  bg={colors.aprovo}
                />
                <MetricBox
                  label="👎 DESAPROVO"
                  value={String(stats.total_desaprovo || 0)}
                  icon="thumbs-down"
                  bg={colors.neutral}
                />
              </View>
            )}

            {/* ─── Meus Eventos ─── */}
            {events.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>🎪 MEUS EVENTOS</Text>
                {events.map((ev: any) => {
                  const isExpired = ev.status === "expired" || ev.status === "raffle_done";
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
                            👥 {ev.checkins_count || 0} check-ins
                          </Text>
                        </View>
                        <View style={styles.eventMetaRow}>
                          <Text style={styles.eventMeta}>
                            🏪 {ev.exhibitors_count || 0} anúncios
                          </Text>
                          {ev.prize && (
                            <Text style={styles.eventMeta}>🎁 {ev.prize}</Text>
                          )}
                        </View>
                        {!isExpired && (
                          <TouchableOpacity
                            style={styles.postarAnuncioBtn}
                            onPress={() => router.push(`/evento/${ev.event_id}/participar`)}
                          >
                            <Ionicons name="megaphone" size={12} color={colors.text} />
                            <Text style={styles.postarAnuncioBtnText}>CRIAR ANÚNCIO</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* ─── Meus Anúncios em Eventos ─── */}
            {posts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>📊 MEUS ANÚNCIOS EM EVENTOS</Text>
                {posts.slice(0, 10).map((p: any) => {
                  const total = (p.aprovo_count || 0) + (p.desaprovo_count || 0);
                  const aprovoPct = total === 0 ? 50 : Math.round(((p.aprovo_count || 0) / total) * 100);
                  return (
                    <TouchableOpacity
                      key={p.post_id}
                      style={styles.postCard}
                      onPress={() => router.push(`/business/campaigns`)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.postHeader}>
                        <Text style={styles.postWord}>#{p.word}</Text>
                        <Text style={styles.postEvent}>{p.event_title || "Evento"}</Text>
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
                          👍 {p.aprovo_count || 0} · 👎 {p.desaprovo_count || 0} · 💬 {p.comments_count || 0}
                        </Text>
                      </View>
                      {/* Botão de sorteio do prémio do anúncio */}
                      {p.prize && !p.prize_drawn && (
                        <TouchableOpacity
                          style={styles.sortearBtn}
                          onPress={() => router.push(`/evento/${p.event_id || "0"}/post/${p.post_id}/sorteio`)}
                        >
                          <Ionicons name="gift" size={12} color={colors.text} />
                          <Text style={styles.sortearBtnText}>🎲 SORTEAR PRÉMIO</Text>
                        </TouchableOpacity>
                      )}
                      {p.prize && p.prize_drawn && (
                        <View style={[styles.sortearBtn, { backgroundColor: colors.aprovo }]}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.text} />
                          <Text style={styles.sortearBtnText}>PRÉMIO SORTEADO</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* ─── Ações Rápidas ─── */}
            <Text style={styles.sectionTitle}>⚡ AÇÕES RÁPIDAS</Text>
            <View style={styles.actionsGrid}>
              <ActionCard
                icon="location"
                label="CRIAR EVENTO"
                onPress={() => router.push("/business/evento/novo")}
              />
              <ActionCard
                icon="megaphone"
                label="ANUNCIAR EM EVENTO"
                onPress={() => router.push("/events/explorar")}
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

  // ─── Postar Anúncio no Evento ───
  postarAnuncioBtn: {
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
  postarAnuncioBtnText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // ─── Sortear Prémio ───
  sortearBtn: {
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
  sortearBtnText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },
});

