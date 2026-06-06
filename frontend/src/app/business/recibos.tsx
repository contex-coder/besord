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
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Invoice = {
  invoice_id: string;
  stripe_invoice_id?: string | null;
  stripe_session_id?: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  tax_id?: string | null;
  status: string;
  invoice_url?: string | null;
  created_at: string;
};

export default function RecibosScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/business/invoices");
      if (r.ok) {
        const data = await r.json();
        setInvoices(data.invoices || []);
        setTotalSpent(data.total_spent || 0);
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

  const handleDownloadCSV = async () => {
    try {
      const r = await apiFetch("/api/business/invoices/export");
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `recibos_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Erro", "Falha ao exportar recibos.");
      }
    } catch {
      Alert.alert("Erro", "Falha ao exportar. Tenta novamente.");
    }
  };

  const openInvoice = (url: string | null | undefined) => {
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert("Indisponível", "Fatura não disponível para download direto.");
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📄 RECIBOS</Text>
        <TouchableOpacity onPress={handleDownloadCSV} style={styles.csvBtn}>
          <Ionicons name="download" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>TOTAL GASTO (2026)</Text>
        <Text style={styles.totalValue}>{formatEuro(totalSpent)}</Text>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.invoice_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>NENHUM RECIBO AINDA</Text>
            <Text style={styles.emptySub}>
              Os recibos aparecem aqui após cada pagamento processado.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dateStr = item.created_at?.split("T")[0] || item.created_at;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openInvoice(item.invoice_url)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardDate}>{dateStr}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <Text style={styles.cardAmount}>{formatEuro(item.amount_cents)}</Text>
              </View>
              <View style={styles.cardBottom}>
                <View style={[styles.statusBadge, item.status === "paid" ? { backgroundColor: colors.aprovo } : { backgroundColor: colors.neutral }]}>
                  <Text style={styles.statusText}>
                    {item.status === "paid" ? "PAGO" : item.status.toUpperCase()}
                  </Text>
                </View>
                {item.tax_id && (
                  <Text style={styles.cardTax}>{item.tax_id}</Text>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => openInvoice(item.invoice_url)}
                >
                  <Ionicons name="open-outline" size={14} color={colors.text} />
                  <Text style={styles.downloadBtnText}>ABRIR</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
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
  csvBtn: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral,
  },

  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.neutral,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
  },
  totalLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  totalValue: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },

  listContent: { padding: 16, paddingBottom: 40, gap: 12 },

  // ─── Card ───
  card: {
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 14,
    gap: 10,
    ...brutalShadow,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardLeft: { flex: 1, gap: 4 },
  cardDate: { fontSize: 11, fontWeight: "900", color: colors.textSecondary, letterSpacing: 1 },
  cardDesc: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  cardAmount: { fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: colors.border },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.border,
  },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },
  cardTax: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  downloadBtnText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },

  // ─── Empty ───
  empty: { paddingTop: 80, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" },
  emptySub: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 40, lineHeight: 18 },
});
