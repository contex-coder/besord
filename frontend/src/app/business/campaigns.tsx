import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Campaign = {
  campaign_id: string; word: string; image_base64: string;
  tier_name: string; status: string;
  votes_collected: number; aprovo_count: number; desaprovo_count: number;
};

type Dashboard = {
  total_campaigns: number; active_count: number; completed_count: number;
  canceled_count: number; pending_count: number;
  total_votes_collected: number; total_votes_target: number;
  aprovo_pct: number; total_amount_eur: number;
};

export default function CampaignsListScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        apiFetch("/api/campaigns"),
        apiFetch("/api/business/dashboard"),
      ]);
      if (r1.ok) setCampaigns(await r1.json());
      if (r2.ok) setDash(await r2.json());
    } finally { setLoading(false); }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>MINHAS CAMPANHAS</Text>
        <TouchableOpacity onPress={() => router.push("/business/campaign/new")} style={styles.addBtn} testID="btn-new-campaign">
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}><ActivityIndicator color={colors.text} size="large" /></View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(c) => c.campaign_id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            dash && dash.total_campaigns > 0 ? (
              <View style={styles.dashCard} testID="business-dashboard">
                <Text style={styles.dashTitle}>VISÃO GERAL</Text>
                <View style={styles.kpiRow}>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiVal}>{dash.total_campaigns}</Text>
                    <Text style={styles.kpiLabel}>CAMPANHAS</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiVal}>{dash.total_votes_collected}</Text>
                    <Text style={styles.kpiLabel}>VOTOS</Text>
                  </View>
                  <View style={[styles.kpi, { backgroundColor: colors.aprovo }]}>
                    <Text style={styles.kpiVal}>{dash.aprovo_pct}%</Text>
                    <Text style={styles.kpiLabel}>APROVO</Text>
                  </View>
                  <View style={[styles.kpi, { backgroundColor: colors.neutral }]}>
                    <Text style={styles.kpiVal}>€{dash.total_amount_eur.toFixed(0)}</Text>
                    <Text style={styles.kpiLabel}>INVESTIDO</Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusChip}>● {dash.active_count} ATIVA</Text>
                  <Text style={styles.statusChip}>● {dash.completed_count} CONCL.</Text>
                  <Text style={styles.statusChip}>● {dash.canceled_count} ELIM.</Text>
                  <Text style={styles.statusChip}>● {dash.pending_count} PEND.</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NENHUMA CAMPANHA</Text>
              <Text style={styles.emptySub}>Crie sua primeira campanha para coletar veredito do mercado.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/business/campaign/new")}>
                <Text style={styles.emptyBtnText}>CRIAR CAMPANHA</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor =
              item.status === "active" ? colors.aprovo :
              item.status === "completed" ? colors.neutral :
              item.status === "canceled" ? colors.bgSubtle :
              colors.desaprovo;
            const statusLabel =
              item.status === "active" ? "ATIVA" :
              item.status === "completed" ? "CONCLUÍDA" :
              item.status === "canceled" ? "ELIMINADA" :
              item.status === "pending_payment" ? "AGUARDA PAGTO" :
              item.status.toUpperCase();
            return (
              <TouchableOpacity testID={`campaign-${item.campaign_id}`} style={styles.card} onPress={() => router.push(`/business/campaign/${item.campaign_id}`)}>
                <Image source={{ uri: item.image_base64 }} style={styles.thumb} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardWord} numberOfLines={1}>#{item.word}</Text>
                  <Text style={styles.cardTier}>{item.tier_name}</Text>
                  <Text style={styles.cardStats}>👍 {item.aprovo_count} • 👎 {item.desaprovo_count}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.aprovo, alignItems: "center", justifyContent: "center", ...brutalShadow },
  title: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text },
  list: { padding: 20, gap: 12 },
  card: { flexDirection: "row", gap: 12, borderWidth: 3, borderColor: colors.border, padding: 10, backgroundColor: colors.bg, alignItems: "center", ...brutalShadow },
  thumb: { width: 70, height: 70, borderWidth: 2, borderColor: colors.border },
  cardWord: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  cardTier: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.textSecondary },
  cardStats: { fontSize: 12, fontWeight: "700", color: colors.text },
  statusPill: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: "900", color: colors.text, letterSpacing: 0.5 },
  empty: { paddingTop: 60, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 30, marginBottom: 20 },
  emptyBtn: { borderWidth: 4, borderColor: colors.border, backgroundColor: colors.aprovo, paddingHorizontal: 20, paddingVertical: 14, ...brutalShadow },
  emptyBtnText: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.text },
  dashCard: { borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bg, padding: 14, marginBottom: 16, ...brutalShadow },
  dashTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 2, color: colors.text, marginBottom: 10 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bg, padding: 8, alignItems: "center" },
  kpiVal: { fontSize: 18, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  kpiLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary, marginTop: 2 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  statusChip: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
});
