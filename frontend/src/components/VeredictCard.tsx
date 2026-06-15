import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Share, ActivityIndicator, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, brutalShadow } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { track } from "@/src/utils/analytics";

type VeredictData = {
  word: string | null;
  approval_rate: number | null;
  aprovo_votes_cast: number;
  total_votes_cast: number;
  dominant_theme: string | null;
  date: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionInsight?: string | null;
};

export default function VeredictCard({ visible, onClose, sessionInsight }: Props) {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<VeredictData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiFetch("/api/users/me/veredito")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const handleShare = async () => {
    if (!data) return;
    const wordLine = data.word
      ? `A MINHA PALAVRA DE HOJE: ${data.word.toUpperCase()}`
      : "COMPLETEI A MINHA SESSÃO DIÁRIA";
    const rateLine = data.approval_rate != null
      ? `${data.approval_rate}% APROVARAM`
      : "";
    const themeLine = data.dominant_theme
      ? `VOTEI EM: ${data.dominant_theme.toUpperCase()}`
      : `${data.aprovo_votes_cast} APROVAÇÕES EM ${data.total_votes_cast} VOTOS`;

    const message = [
      wordLine,
      rateLine,
      themeLine,
      "",
      "BESORD — 10 VOTOS. UM DIA. QUEM ÉS TU?",
      "besord.vercel.app",
    ].filter(Boolean).join("\n");

    try {
      await Share.share({ message });
      if (user?.user_id) {
        track("veredito_shared", user.user_id, {
          word: data.word, approval_rate: data.approval_rate,
        });
      }
    } catch {}
  };

  const approvalWidth = data?.approval_rate ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.brand}>BESORD</Text>
            <Text style={styles.date}>{data?.date ?? ""}</Text>
          </View>

          <View style={styles.divider} />

          {/* ── Content (scrollável para ecrãs pequenos) ── */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.text} />
              </View>
            ) : (
              <>
                <Text style={styles.label}>A MINHA PALAVRA DE HOJE</Text>
                <Text style={styles.word} numberOfLines={1} adjustsFontSizeToFit>
                  {data?.word
                    ? data.word.toUpperCase()
                    : "—"}
                </Text>

                {/* ── Approval bar ── */}
                {data?.approval_rate != null && (
                  <View style={styles.barSection}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${approvalWidth}%` as any }]} />
                    </View>
                    <Text style={styles.barLabel}>{data.approval_rate}% APROVARAM</Text>
                  </View>
                )}

                {/* ── Votes info ── */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{data?.total_votes_cast ?? 10}</Text>
                    <Text style={styles.statLbl}>VOTOS</Text>
                  </View>
                  <View style={[styles.statBox, styles.statBoxMid]}>
                    <Text style={styles.statNum}>{data?.aprovo_votes_cast ?? 0}</Text>
                    <Text style={styles.statLbl}>APROVEI</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>
                      {(data?.total_votes_cast ?? 0) - (data?.aprovo_votes_cast ?? 0)}
                    </Text>
                    <Text style={styles.statLbl}>DESAPROVEI</Text>
                  </View>
                </View>

                <View style={styles.divider} />
                <Text style={styles.tagline}>O MUNDO AINDA TEM MUITO PARA LHE DAR E PODES SAIR PARA ENCONTRAR AINDA HOJE.</Text>

                {sessionInsight && (
                  <View style={styles.insightBox}>
                    <Text style={styles.insightLabel}>★ ESPELHO DE SESSÃO</Text>
                    <Text style={styles.insightText}>{sessionInsight}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* ── Actions (fora do scroll — sempre visíveis) ── */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={loading}>
              <Ionicons name="share-social" size={18} color={colors.textInverse} />
              <Text style={styles.shareBtnText}>PARTILHAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>FECHAR</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
    color: colors.text,
  },
  date: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  divider: {
    height: 4,
    backgroundColor: colors.border,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  word: {
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.text,
    lineHeight: 54,
  },
  barSection: { gap: 6 },
  barTrack: {
    height: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 3,
    borderColor: colors.border,
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.text,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },
  statsRow: {
    flexDirection: "row",
    borderWidth: 3,
    borderColor: colors.border,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  statBoxMid: {
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.border,
  },
  statNum: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
  },
  statLbl: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  tagline: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textAlign: "center",
  },
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 4,
  },
  loadingBox: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  insightBox: {
    borderWidth: 3,
    borderColor: "#FFD700",
    backgroundColor: "#FFFBE6",
    padding: 12,
    gap: 6,
  },
  insightLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.5,
    color: "#B8860B",
  },
  insightText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 19,
    fontStyle: "italic",
  },
  actions: {
    gap: 10,
  },
  shareBtn: {
    height: 56,
    backgroundColor: colors.text,
    borderWidth: 4,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...brutalShadow,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.textInverse,
  },
  closeBtn: {
    height: 44,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.textSecondary,
  },
});
