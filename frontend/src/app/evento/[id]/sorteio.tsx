import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function SorteioEventoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      const r = await apiFetch(`/api/events/${id}`);
      if (r.ok) {
        const ev = await r.json();
        setEvent(ev);

        // Verificar se sou organizador
        if (user?.user_id !== ev.company_id && !user?.is_admin) {
          Alert.alert("Acesso negado", "Só o organizador do evento pode realizar o sorteio.");
          router.back();
          return;
        }

        // Verificar se tem prémio
        if (!ev.prize) {
          Alert.alert("Sem prémio", "Este evento não tem prémio definido para sorteio.");
          router.back();
          return;
        }

        // Verificar se já foi sorteado
        if (ev.raffle_done) {
          Alert.alert("Sorteio já realizado", `O vencedor do "${ev.prize}" foi apurado.`);
          router.back();
          return;
        }
      }
    } catch {}
    setLoading(false);
  }, [id, apiFetch, user, router]);

  useEffect(() => {
    loadEvent();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRaffle = async () => {
    const confirmMsg = `Confirmar o sorteio do prémio "${event.prize}"?\n\n` +
      "Vai ser escolhido aleatoriamente um voto APROVO nos anúncios do evento.\n\n" +
      "Esta ação é IRREVERSÍVEL.";

    const doIt = async () => {
      setSubmitting(true);
      try {
        const r = await apiFetch(`/api/events/${id}/raffle`, { method: "POST" });
        if (r.ok) {
          const data = await r.json();
          Alert.alert(
            "🎉 SORTEIO REALIZADO!",
            `Vencedor: ${data.winner_name}\n\n` +
            `Prémio: ${data.prize}\n\n` +
            `O vencedor será notificado.`,
            [{ text: "OK", onPress: () => router.back() }]
          );
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Falha ao realizar sorteio.");
        }
      } catch (e: any) {
        Alert.alert("Erro", e?.message || "Falha ao realizar sorteio.");
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(confirmMsg)) {
        doIt();
      }
      return;
    }
    Alert.alert("🎲 Realizar sorteio?", confirmMsg, [
      { text: "Cancelar", style: "cancel" },
      { text: "🎲 SORTEAR!", style: "destructive", onPress: doIt },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>EVENTO NÃO ENCONTRADO</Text>
      </SafeAreaView>
    );
  }

  const canRaffle = event.status === "expired" || event.checkins_count > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>🎲 SORTEIO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ─── Info Evento ─── */}
        <View style={styles.eventInfo}>
          <Ionicons name="gift" size={32} color={colors.text} />
          <View style={styles.eventInfoText}>
            <Text style={styles.eventTitle}>{event.title.toUpperCase()}</Text>
            <Text style={styles.eventCompany}>{event.company_name.toUpperCase()}</Text>
          </View>
        </View>

        {/* ─── Prémio ─── */}
        <View style={styles.prizeBox}>
          <Text style={styles.prizeLabel}>PRÉMIO</Text>
          <Text style={styles.prizeValue}>{event.prize}</Text>
        </View>

        {/* ─── Estatísticas ─── */}
        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>📊 ESTATÍSTICAS</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{event.checkins_count}</Text>
              <Text style={styles.statLabel}>CHECK-INS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{event.exhibitors_count}</Text>
              <Text style={styles.statLabel}>EMPRESAS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{event.participants_count}</Text>
              <Text style={styles.statLabel}>PARTICIPANTES</Text>
            </View>
          </View>
        </View>

        {/* ─── Info Sorteio ─── */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.text} />
          <Text style={styles.infoText}>
            O sorteio escolhe um voto APROVO aleatório entre todos os anúncios do evento.
            Quanto mais APROVOS um anúncio tiver, maior a probabilidade de ganhar.
          </Text>
        </View>

        {/* ─── Botão ─── */}
        <TouchableOpacity
          style={[
            styles.raffleBtn,
            (!canRaffle || submitting) && styles.raffleBtnDisabled,
          ]}
          onPress={doRaffle}
          disabled={!canRaffle || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons name="gift" size={24} color={colors.text} />
              <Text style={styles.raffleBtnText}>🎲 SORTEAR PRÉMIO</Text>
            </>
          )}
        </TouchableOpacity>

        {!canRaffle && (
          <Text style={styles.warning}>
            ⚠️ Ainda não há check-ins ou o evento não expirou. O sorteio pode ser realizado, mas recomenda-se esperar por mais participantes.
          </Text>
        )}

        {/* ─── Voltar ─── */}
        <TouchableOpacity
          style={styles.backBtnEvent}
          onPress={() => router.push(`/evento/${id}`)}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={styles.backBtnEventText}>VOLTAR AO EVENTO</Text>
        </TouchableOpacity>
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
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },

  content: { padding: 16, gap: 20, paddingBottom: 40 },

  // ─── Event Info ───
  eventInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
  },
  eventInfoText: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  eventCompany: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginTop: 2 },

  // ─── Prémio ───
  prizeBox: {
    alignItems: "center",
    gap: 6,
    padding: 24,
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  prizeLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  prizeValue: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text, textAlign: "center" },

  // ─── Stats ───
  statsBox: {
    padding: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
    gap: 10,
  },
  statsTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1.2, color: colors.text },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 24, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },

  // ─── Info ───
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.textSecondary, lineHeight: 17 },

  // ─── Botão ───
  raffleBtn: {
    height: 64,
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    ...brutalShadow,
  },
  raffleBtnDisabled: { opacity: 0.5 },
  raffleBtnText: { fontSize: 18, fontWeight: "900", letterSpacing: 1, color: colors.text },

  warning: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 20 },

  // ─── Back ───
  backBtnEvent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtnEventText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
});
