import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function ConviteEventoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      const [eventR, inviteR] = await Promise.all([
        apiFetch(`/api/events/${id}`),
        apiFetch(`/api/events/${id}/invite`, { method: "POST" }),
      ]);
      if (eventR.ok) {
        const ev = await eventR.json();
        setEvent(ev);

        // Verificar se sou organizador
        if (user?.user_id !== ev.company_id && !user?.is_admin) {
          Alert.alert("Acesso negado", "Só o organizador do evento pode gerar convites.");
          router.back();
          return;
        }
      }
      if (inviteR.ok) {
        const data = await inviteR.json();
        setInviteLink(data.invite_url);
        setInviteCode(data.invite_code);
      }
    } catch {}
    setLoading(false);
  }, [id, apiFetch, user, router]);

  useEffect(() => {
    loadEvent();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        const { Clipboard } = require("react-native");
        Clipboard.setString(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível copiar.");
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;
    try {
      const message = `🔗 BESORD — Convite para participares no evento "${event?.title}"!\n\nClica no link para publicares o teu anúncio:\n${inviteLink}\n\nCria o teu anúncio com 1 palavra + 1 imagem. Só €9,99!`;
      if (Platform.OS === "web" && (navigator as any).share) {
        await (navigator as any).share({ title: `Convite: ${event?.title}`, text: message });
      } else if (Platform.OS === "web") {
        await navigator.clipboard.writeText(message);
        Alert.alert("Copiado!", "Mensagem de convite copiada para partilhares.");
      } else {
        const { Share } = require("react-native");
        await Share.share({ message, title: `Convite: ${event?.title}` });
      }
    } catch {}
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>CONVIDAR EMPRESAS</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* ─── Info do Evento ─── */}
        <View style={styles.eventInfo}>
          <Ionicons name="location" size={24} color={colors.text} />
          <View style={styles.eventInfoText}>
            <Text style={styles.eventTitle}>{event.title.toUpperCase()}</Text>
            <Text style={styles.eventType}>
              {event.event_type === "public" ? "EVENTO PÚBLICO" : "EVENTO PRIVADO"}
            </Text>
          </View>
        </View>

        {/* ─── Instruções ─── */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>📋 COMO FUNCIONA</Text>
          <View style={styles.instructionRow}>
            <View style={styles.instructionNum}>
              <Text style={styles.instructionNumText}>1</Text>
            </View>
            <Text style={styles.instructionText}>
              Partilha o código de convite com empresas que queiram anunciar no teu evento.
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <View style={styles.instructionNum}>
              <Text style={styles.instructionNumText}>2</Text>
            </View>
            <Text style={styles.instructionText}>
              Cada empresa paga €9,99 para publicar 1 palavra + 1 imagem no teu evento.
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <View style={styles.instructionNum}>
              <Text style={styles.instructionNumText}>3</Text>
            </View>
            <Text style={styles.instructionText}>
              Os anúncios aparecem no feed do teu evento. Quanto mais check-ins, mais visibilidade!
            </Text>
          </View>
        </View>

        {/* ─── Código de Convite ─── */}
        {inviteCode && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>CÓDIGO DE CONVITE</Text>
            <Text style={styles.codeValue} selectable>
              {inviteCode}
            </Text>
            <Text style={styles.codeHint}>
              Partilha este código com as empresas. Elas precisam dele para participar.
            </Text>
          </View>
        )}

        {/* ─── Link Completo ─── */}
        {inviteLink && (
          <View style={styles.linkBox}>
            <Text style={styles.linkLabel}>LINK COMPLETO</Text>
            <Text style={styles.linkUrl} numberOfLines={3} selectable>
              {inviteLink}
            </Text>
            <View style={styles.linkActions}>
              <TouchableOpacity
                style={[styles.linkBtn, copied && styles.linkBtnCopied]}
                onPress={handleCopy}
              >
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy"}
                  size={18}
                  color={colors.text}
                />
                <Text style={styles.linkBtnText}>
                  {copied ? "COPIADO!" : "COPIAR LINK"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={handleShare}>
                <Ionicons name="share-social" size={18} color={colors.text} />
                <Text style={styles.linkBtnText}>PARTILHAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── Info Preço ─── */}
        <View style={styles.priceInfo}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={styles.priceInfoText}>
            TU (ORGANIZADOR) NÃO PAGAS NADA. CADA EMPRESA PAGA €9,99 PARA PUBLICAR O SEU ANÚNCIO NO TEU EVENTO.
          </Text>
        </View>

        {/* ─── Voltar ao evento ─── */}
        <TouchableOpacity
          style={styles.backToEvent}
          onPress={() => router.push(`/evento/${id}`)}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={styles.backToEventText}>VOLTAR AO EVENTO</Text>
        </TouchableOpacity>
      </View>
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
  eventType: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginTop: 2 },

  // ─── Instruções ───
  instructions: {
    padding: 14,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    gap: 12,
  },
  instructionsTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1.2, color: colors.text, marginBottom: 4 },
  instructionRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  instructionNum: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  instructionNumText: { fontSize: 12, fontWeight: "900", color: colors.text },
  instructionText: { fontSize: 12, fontWeight: "600", color: colors.text, flex: 1, lineHeight: 17 },

  // ─── Código ───
  codeBox: {
    alignItems: "center",
    gap: 8,
    padding: 20,
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  codeLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  codeValue: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 4,
    color: colors.text,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 8,
    overflow: "hidden",
  },
  codeHint: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, textAlign: "center" },

  // ─── Link ───
  linkBox: {
    gap: 10,
    padding: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
  },
  linkLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  linkUrl: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    lineHeight: 18,
  },
  linkActions: {
    flexDirection: "row",
    gap: 10,
  },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
    ...brutalShadow,
  },
  linkBtnCopied: { backgroundColor: colors.aprovo },
  linkBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: colors.text },

  // ─── Price Info ───
  priceInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
  },
  priceInfoText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 15,
  },

  // ─── Back ───
  backToEvent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  backToEventText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
});
