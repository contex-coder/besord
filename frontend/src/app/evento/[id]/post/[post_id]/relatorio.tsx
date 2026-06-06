import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type ReportData = {
  post_id: string;
  word: string;
  event_id?: string | null;
  event_title?: string | null;
  total_votes: number;
  aprovo_count: number;
  desaprovo_count: number;
  total_comments: number;
  top_comment_words: { word: string; count: number }[];
  by_country: { country_code: string; count: number }[];
  by_city: { city: string; count: number }[];
  by_age_group: { age_group: string; count: number }[];
  total_checkins_event: number;
  total_exhibitors_event: number;
  prize?: string | null;
  prize_drawn: boolean;
  created_at: string;
};

export default function RelatorioScreen() {
  const { id, post_id } = useLocalSearchParams<{ id: string; post_id: string }>();
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!post_id) return;
    try {
      const r = await apiFetch(`/api/posts/${post_id}/report`);
      if (r.ok) {
        setReport(await r.json());
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Não foi possível carregar o relatório.");
        router.back();
      }
    } catch {
      Alert.alert("Erro", "Falha ao carregar relatório.");
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [post_id, apiFetch, router]);

  useEffect(() => {
    load();
  }, [post_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleDrawPrize = async () => {
    if (!report?.prize) {
      Alert.alert("Sem prémio", "Este post não tem prémio definido.");
      return;
    }
    if (report.prize_drawn) {
      Alert.alert("Sorteio já realizado", "O prémio deste post já foi sorteado.");
      return;
    }

    const doDraw = async () => {
      try {
        const r = await apiFetch(`/api/posts/${post_id}/draw-prize`, { method: "POST" });
        if (r.ok) {
          const data = await r.json();
          Alert.alert(
            "🎉 SORTEIO REALIZADO!",
            `Vencedor: ${data.winner_name}\n\nPrémio: ${data.prize}`,
            [{ text: "OK", onPress: load }]
          );
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Falha ao sortear prémio.");
        }
      } catch {
        Alert.alert("Erro", "Falha ao sortear prémio.");
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Sortear o prémio "${report.prize}"?`)) {
        doDraw();
      }
      return;
    }
    Alert.alert("Sortear prémio?", `Prémio: ${report.prize}`, [
      { text: "Cancelar", style: "cancel" },
      { text: "🎲 SORTEAR", style: "destructive", onPress: doDraw },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>RELATÓRIO NÃO ENCONTRADO</Text>
      </SafeAreaView>
    );
  }

  const total = report.aprovo_count + report.desaprovo_count;
  const aprovoPct = total === 0 ? 50 : Math.round((report.aprovo_count / total) * 100);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>📊 RELATÓRIO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        {/* ─── Cabeçalho do Post ─── */}
        <View style={styles.postHeader}>
          <View style={styles.wordBox}>
            <Text style={styles.wordText}>#{report.word}</Text>
          </View>
          {report.event_title && (
            <Text style={styles.eventRef}>
              {report.event_title.toUpperCase()}
            </Text>
          )}
          <Text style={styles.dateRef}>
            Criado em {new Date(report.created_at).toLocaleDateString("pt-PT")}
          </Text>
        </View>

        {/* ─── Métricas Gerais ─── */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{total}</Text>
            <Text style={styles.metricLabel}>VOTOS TOTAIS</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.aprovo }]}>
            <Text style={styles.metricValue}>{report.aprovo_count}</Text>
            <Text style={styles.metricLabel}>APROVO</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.desaprovo }]}>
            <Text style={styles.metricValue}>{report.desaprovo_count}</Text>
            <Text style={styles.metricLabel}>DESAPROVO</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{report.total_comments}</Text>
            <Text style={styles.metricLabel}>COMENTÁRIOS</Text>
          </View>
        </View>

        {/* ─── Barra de Votos ─── */}
        <View style={styles.voteBarSection}>
          <View style={styles.voteBar}>
            <View style={[styles.voteBarFill, { width: `${aprovoPct}%`, backgroundColor: colors.aprovo }]} />
          </View>
          <View style={styles.voteBarLabels}>
            <Text style={styles.voteBarText}>{aprovoPct}% APROVO</Text>
            <Text style={styles.voteBarText}>{100 - aprovoPct}% DESAPROVO</Text>
          </View>
        </View>

        {/* ─── Evento Stats ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 ESTATÍSTICAS DO EVENTO</Text>
          <View style={styles.eventStatsGrid}>
            <View style={styles.eventStat}>
              <Text style={styles.eventStatValue}>{report.total_checkins_event}</Text>
              <Text style={styles.eventStatLabel}>CHECK-INS</Text>
            </View>
            <View style={styles.eventStat}>
              <Text style={styles.eventStatValue}>{report.total_exhibitors_event}</Text>
              <Text style={styles.eventStatLabel}>EMPRESAS</Text>
            </View>
          </View>
        </View>

        {/* ─── Top Palavras ─── */}
        {report.top_comment_words.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 PALAVRAS MAIS USADAS</Text>
            <View style={styles.topWordsList}>
              {report.top_comment_words.map((w, i) => (
                <View key={i} style={styles.topWordRow}>
                  <Text style={styles.topWordRank}>{i + 1}.</Text>
                  <Text style={styles.topWordText}>#{w.word}</Text>
                  <View style={styles.topWordBar}>
                    <View
                      style={[
                        styles.topWordBarFill,
                        {
                          width: `${Math.min(
                            100,
                            (w.count / Math.max(...report.top_comment_words.map((x) => x.count))) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.topWordCount}>{w.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Por País ─── */}
        {report.by_country.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌍 POR PAÍS</Text>
            {report.by_country.map((c, i) => (
              <View key={i} style={styles.breakdownRow}>
                <Text style={styles.breakdownCountry}>
                  {c.country_code === "PT" ? "🇵🇹 PORTUGAL" : c.country_code}
                </Text>
                <View style={styles.breakdownBar}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      {
                        width: `${Math.min(
                          100,
                          (c.count / Math.max(...report.by_country.map((x) => x.count))) * 100
                        )}%`,
                        backgroundColor: colors.aprovo,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{c.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Por Cidade ─── */}
        {report.by_city.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 POR CIDADE</Text>
            {report.by_city.map((c, i) => (
              <View key={i} style={styles.breakdownRow}>
                <Text style={styles.breakdownCountry}>{c.city.toUpperCase()}</Text>
                <View style={styles.breakdownBar}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      {
                        width: `${Math.min(
                          100,
                          (c.count / Math.max(...report.by_city.map((x) => x.count))) * 100
                        )}%`,
                        backgroundColor: colors.neutral,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{c.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Por Faixa Etária ─── */}
        {report.by_age_group.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 POR FAIXA ETÁRIA</Text>
            {report.by_age_group.map((g, i) => (
              <View key={i} style={styles.breakdownRow}>
                <Text style={styles.breakdownCountry}>{g.age_group}</Text>
                <View style={styles.breakdownBar}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      {
                        width: `${Math.min(
                          100,
                          (g.count / Math.max(...report.by_age_group.map((x) => x.count))) * 100
                        )}%`,
                        backgroundColor: colors.desaprovo,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{g.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Prémio ─── */}
        {report.prize && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎁 PRÉMIO</Text>
            <View style={styles.prizeBox}>
              <Text style={styles.prizeName}>{report.prize}</Text>
              <View style={[styles.prizeStatus, report.prize_drawn ? { backgroundColor: colors.aprovo } : { backgroundColor: colors.neutral }]}>
                <Ionicons
                  name={report.prize_drawn ? "checkmark-circle" : "time"}
                  size={14}
                  color={colors.text}
                />
                <Text style={styles.prizeStatusText}>
                  {report.prize_drawn ? "SORTEADO" : "PENDENTE"}
                </Text>
              </View>
            </View>
            {!report.prize_drawn && (
              <TouchableOpacity
                style={styles.drawBtn}
                onPress={handleDrawPrize}
                activeOpacity={0.8}
              >
                <Ionicons name="gift" size={18} color={colors.text} />
                <Text style={styles.drawBtnText}>SORTEAR PRÉMIO</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
  headerTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },

  content: { padding: 16, gap: 20, paddingBottom: 60 },

  // ─── Post Header ───
  postHeader: {
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  wordBox: {
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  wordText: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: colors.text },
  eventRef: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  dateRef: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  // ─── Métricas ───
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "47%",
    aspectRatio: 1.5,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    ...brutalShadow,
  },
  metricValue: { fontSize: 32, fontWeight: "900", color: colors.text },
  metricLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: colors.text },

  // ─── Barra Votos ───
  voteBarSection: { gap: 6 },
  voteBar: {
    height: 20,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.desaprovo,
    overflow: "hidden",
  },
  voteBarFill: { height: "100%" },
  voteBarLabels: { flexDirection: "row", justifyContent: "space-between" },
  voteBarText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },

  // ─── Sections ───
  section: {
    gap: 10,
    padding: 14,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
  },
  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: colors.text, marginBottom: 4 },

  // ─── Event Stats ───
  eventStatsGrid: { flexDirection: "row", gap: 12 },
  eventStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    padding: 10,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
  },
  eventStatValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  eventStatLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },

  // ─── Top Words ───
  topWordsList: { gap: 8 },
  topWordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  topWordRank: { fontSize: 12, fontWeight: "900", color: colors.textSecondary, width: 20 },
  topWordText: { fontSize: 14, fontWeight: "900", color: colors.text, width: 100 },
  topWordBar: {
    flex: 1,
    height: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    overflow: "hidden",
  },
  topWordBarFill: { height: "100%", backgroundColor: colors.aprovo },
  topWordCount: { fontSize: 12, fontWeight: "900", color: colors.text, width: 30, textAlign: "right" },

  // ─── Breakdown ───
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownCountry: { fontSize: 12, fontWeight: "900", color: colors.text, width: 100 },
  breakdownBar: {
    flex: 1,
    height: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    overflow: "hidden",
  },
  breakdownBarFill: { height: "100%" },
  breakdownCount: { fontSize: 12, fontWeight: "900", color: colors.text, width: 30, textAlign: "right" },

  // ─── Prize ───
  prizeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
  },
  prizeName: { fontSize: 18, fontWeight: "900", color: colors.text, flex: 1 },
  prizeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  prizeStatusText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },

  drawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
    ...brutalShadow,
  },
  drawBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
});
