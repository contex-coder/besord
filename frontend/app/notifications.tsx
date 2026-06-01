import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Notif = {
  notification_id: string;
  campaign_id?: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  payload?: Record<string, any>;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/notifications?limit=50");
      if (r.ok) {
        const data = await r.json();
        setItems(data.items || []);
        setUnread(data.unread_count || 0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markAllRead = useCallback(async () => {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    load();
  }, [apiFetch, load]);

  const open = useCallback(async (n: Notif) => {
    if (!n.read_at) {
      await apiFetch(`/api/notifications/${n.notification_id}/read`, { method: "POST" });
    }
    if (n.campaign_id) router.push(`/business/campaign/${n.campaign_id}`);
    load();
  }, [apiFetch, router, load]);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>NOTIFICAÇÕES{unread > 0 ? ` (${unread})` : ""}</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} testID="btn-mark-all-read">
            <Text style={styles.markAllText}>MARCAR LIDAS</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.notification_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>SEM NOTIFICAÇÕES</Text>
            <Text style={styles.emptySub}>
              Quando uma das tuas campanhas atingir 50%, 75% ou 100% da meta, vais ser avisado aqui.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`notif-${item.notification_id}`}
            onPress={() => open(item)}
            style={[styles.card, !item.read_at && styles.cardUnread]}
            activeOpacity={0.7}
          >
            {!item.read_at && <View style={styles.unreadDot} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    gap: 12,
  },
  iconBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  markAllBtn: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.neutral },
  markAllText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 3,
    borderColor: colors.border,
    padding: 14,
    backgroundColor: colors.bg,
    ...brutalShadow,
  },
  cardUnread: { backgroundColor: "#FFF7D5" },
  unreadDot: {
    width: 10, height: 10,
    backgroundColor: colors.desaprovo,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  cardBody: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  cardTime: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary, marginTop: 6 },

  empty: { alignItems: "center", paddingTop: 80, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 1, color: colors.text, marginTop: 12 },
  emptySub: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
});
