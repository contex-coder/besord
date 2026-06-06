import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type MyEvent = {
  event_id: string;
  title: string;
  image_base64: string;
  date: string;
  status: string;
  event_type: string;
  participants_count: number;
  checkins_count: number;
  exhibitors_count: number;
  prize?: string | null;
  raffle_done: boolean;
  company_name: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
    }).toUpperCase();
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "ATIVO",
    full: "LOTAÇÃO ESGOTADA",
    expired: "EXPIRADO",
    raffle_done: "SORTEIO REALIZADO",
    pending_payment: "AGUARDA PAGAMENTO",
    pending_approval: "PENDENTE APROVAÇÃO",
  };
  return map[status] || status.toUpperCase();
}

function statusColor(status: string): string {
  if (status === "active") return colors.aprovo;
  if (status === "pending_payment" || status === "pending_approval") return colors.neutral;
  return colors.desaprovo;
}

export default function MeusEventosScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/events");
      if (r.ok) {
        const data = await r.json();
        // Filtrar apenas eventos onde sou dono
        const mine = data.filter((e: any) => e.is_owner);
        setEvents(mine);
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

  const criarEvento = () => {
    router.push("/business/evento/novo");
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
        <Text style={styles.headerTitle}>MEUS EVENTOS</Text>
        <TouchableOpacity onPress={criarEvento} style={styles.criarBtn}>
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.event_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>NENHUM EVENTO AINDA</Text>
            <Text style={styles.emptySub}>Cria o teu primeiro evento presencial.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={criarEvento}>
              <Ionicons name="add-circle" size={18} color={colors.text} />
              <Text style={styles.emptyBtnText}>CRIAR EVENTO</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/evento/${item.event_id}`)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.image_base64 }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title.toUpperCase()}
              </Text>
              <Text style={styles.cardDate}>{formatDate(item.date)}</Text>

              <View style={styles.cardBadges}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
                </View>
                {item.event_type === "public" && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.aprovo }]}>
                    <Text style={styles.statusText}>PÚBLICO</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardMetrics}>
                <View style={styles.metric}>
                  <Ionicons name="people" size={12} color={colors.textSecondary} />
                  <Text style={styles.metricText}>{item.checkins_count} CHECK-INS</Text>
                </View>
                <View style={styles.metric}>
                  <Ionicons name="storefront" size={12} color={colors.textSecondary} />
                  <Text style={styles.metricText}>{item.exhibitors_count} EMPRESAS</Text>
                </View>
                {item.prize && (
                  <View style={styles.metric}>
                    <Ionicons
                      name={item.raffle_done ? "checkmark-circle" : "gift"}
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.metricText}>
                      {item.raffle_done ? "SORTEADO" : "PRÉMIO"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cardArrow}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}
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
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },
  criarBtn: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.aprovo,
  },

  listContent: { padding: 16, paddingBottom: 40, gap: 14 },

  // ─── Card ───
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
  cardInfo: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
    color: colors.text,
  },
  cardDate: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  cardBadges: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.border,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },
  cardMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  cardArrow: {
    justifyContent: "center",
    paddingRight: 12,
  },

  // ─── Empty ───
  empty: {
    paddingTop: 80,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: colors.text,
  },
  emptySub: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  emptyBtn: {
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
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.text,
  },
});
