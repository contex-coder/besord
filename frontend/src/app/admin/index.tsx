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

type PendingEvent = {
  event_id: string;
  company_id: string;
  company_name: string;
  title: string;
  description: string;
  image_base64: string;
  date: string;
  event_type: string;
  status: string;
  created_at: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).toUpperCase();
  } catch {
    return iso;
  }
}

export default function AdminScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [activeEvents, setActiveEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"pending" | "active">("pending");

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/events");
      if (r.ok) {
        const data = await r.json();
        const pending = data.filter((e: any) => e.status === "pending_approval");
        const active = data.filter((e: any) => e.status === "active");
        setPendingEvents(pending);
        setActiveEvents(active);
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

  const onApprove = async (eventId: string, eventTitle: string) => {
    const doApprove = async () => {
      try {
        const r = await apiFetch(`/api/events/${eventId}/approve`, { method: "POST" });
        if (r.ok) {
          Alert.alert("✅ Evento aprovado!", `${eventTitle} está agora ativo.`);
          load();
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Falha ao aprovar.");
        }
      } catch {
        Alert.alert("Erro", "Falha ao aprovar evento.");
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Aprovar evento "${eventTitle}"?`)) {
        doApprove();
      }
      return;
    }
    Alert.alert("Aprovar evento?", eventTitle, [
      { text: "Cancelar", style: "cancel" },
      { text: "Aprovar", onPress: doApprove },
    ]);
  };

  // Verificar se é admin
  if (!user?.is_admin) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="shield-outline" size={64} color={colors.textSecondary} />
        <Text style={styles.noAccessTitle}>ACESSO NEGADO</Text>
        <Text style={styles.noAccessSub}>Apenas administradores podem aceder.</Text>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>ADMIN</Text>
        <TouchableOpacity
          onPress={() => router.push("/admin/tiers")}
          style={styles.tiersBtn}
        >
          <Ionicons name="pricetags" size={16} color={colors.text} />
          <Text style={styles.tiersBtnText}>PREÇOS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/business/evento/novo")}
          style={styles.tiersBtn}
        >
          <Ionicons name="add-circle" size={16} color={colors.text} />
          <Text style={styles.tiersBtnText}>CRIAR EVENTO</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/admin/config")}
          style={styles.tiersBtn}
        >
          <Ionicons name="settings" size={16} color={colors.text} />
          <Text style={styles.tiersBtnText}>CONFIG</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Tabs ─── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "pending" && styles.tabActive]}
          onPress={() => setTab("pending")}
        >
          <Ionicons name="time" size={16} color={tab === "pending" ? colors.text : colors.textSecondary} />
          <Text style={[styles.tabText, tab === "pending" && styles.tabTextActive]}>
            PENDENTES ({pendingEvents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "active" && styles.tabActive]}
          onPress={() => setTab("active")}
        >
          <Ionicons name="checkmark-circle" size={16} color={tab === "active" ? colors.text : colors.textSecondary} />
          <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>
            ATIVOS ({activeEvents.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tab === "pending" ? pendingEvents : activeEvents}
        keyExtractor={(item) => item.event_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={tab === "pending" ? "checkmark-circle" : "calendar-outline"}
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>
              {tab === "pending" ? "NENHUM PENDENTE" : "NENHUM EVENTO ATIVO"}
            </Text>
            <Text style={styles.emptySub}>
              {tab === "pending"
                ? "Todos os eventos estão tratados."
                : "Os eventos ativos aparecem aqui."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image
              source={{ uri: item.image_base64 }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title.toUpperCase()}
              </Text>
              <Text style={styles.cardCompany}>{item.company_name.toUpperCase()}</Text>
              <Text style={styles.cardMeta}>{formatDate(item.date)}</Text>
              <View style={styles.cardBadges}>
                {item.event_type === "public" && (
                  <View style={[styles.badge, { backgroundColor: colors.aprovo }]}>
                    <Text style={styles.badgeText}>PÚBLICO</Text>
                  </View>
                )}
                {item.event_type === "private" && (
                  <View style={[styles.badge, { backgroundColor: colors.neutral }]}>
                    <Text style={styles.badgeText}>PRIVADO</Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: colors.bgSubtle }]}>
                  <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => router.push(`/evento/${item.event_id}`)}
                >
                  <Ionicons name="eye" size={14} color={colors.text} />
                  <Text style={styles.viewBtnText}>VER</Text>
                </TouchableOpacity>
                {tab === "pending" && (
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => onApprove(item.event_id, item.title)}
                  >
                    <Ionicons name="checkmark" size={14} color={colors.text} />
                    <Text style={styles.approveBtnText}>APROVAR</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },

  // ─── No Access ───
  noAccessTitle: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 12 },
  noAccessSub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginTop: 4 },

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
  headerTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  tiersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
    ...brutalShadow,
  },
  tiersBtnText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: colors.text },

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
  cardTitle: { fontSize: 14, fontWeight: "900", letterSpacing: -0.2, color: colors.text },
  cardCompany: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  cardMeta: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },
  cardBadges: { flexDirection: "row", gap: 4, marginTop: 4 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.border,
  },
  badgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 1, color: colors.text },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: colors.border },
  viewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  viewBtnText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.aprovo,
  },
  approveBtnText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // ─── Empty ───
  empty: { paddingTop: 80, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40 },
});
