import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

export default function SorteioAnuncioScreen() {
  const { id: event_id, post_id } = useLocalSearchParams<{ id: string; post_id: string }>();
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const loadPost = useCallback(async () => {
    if (!post_id) return;
    try {
      const r = await apiFetch(`/api/posts?post_id=${post_id}`);
      if (r.ok) {
        const data = await r.json();
        // data pode ser array ou objeto
        const p = Array.isArray(data) ? data[0] : data;
        setPost(p);
      }
    } catch {}
    setLoading(false);
  }, [post_id, apiFetch]);

  useEffect(() => {
    loadPost();
  }, [post_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDraw = async () => {
    if (!post?.prize) {
      Alert.alert("Sem prémio", "Este anúncio não tem prémio configurado.");
      return;
    }
    if (post?.prize_drawn) {
      Alert.alert("Já sorteado", "O prémio deste anúncio já foi sorteado.");
      return;
    }

    const doDraw = async () => {
      setDrawing(true);
      try {
        const r = await apiFetch(`/api/posts/${post_id}/draw-prize`, { method: "POST" });
        if (r.ok) {
          const data = await r.json();
          setResult(data);
          Alert.alert(
            "🎉 Sorteio realizado!",
            `O vencedor foi: ${data.winner_name || "Participante"} (${data.winner_id})`,
            [{ text: "OK" }]
          );
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Não foi possível realizar o sorteio.");
        }
      } catch (e: any) {
        Alert.alert("Erro", e?.message || "Falha ao realizar sorteio.");
      } finally {
        setDrawing(false);
      }
    };

    Alert.alert(
      "Sortear prémio?",
      `Vais sortear "${post.prize}" entre quem votou APROVO neste anúncio.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "🎲 SORTEAR", onPress: doDraw },
      ]
    );
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
        <Text style={styles.headerTitle}>🎲 SORTEAR PRÉMIO</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* ─── Info do Anúncio ─── */}
        {post && (
          <View style={styles.postInfo}>
            <Text style={styles.postWord}>#{post.word}</Text>
            {post.event_title && (
              <Text style={styles.postEvent}>Evento: {post.event_title}</Text>
            )}
          </View>
        )}

        {/* ─── Estado do Sorteio ─── */}
        {post?.prize ? (
          <View style={styles.prizeBox}>
            <Ionicons name="gift" size={48} color={colors.text} />
            <Text style={styles.prizeLabel}>PRÉMIO</Text>
            <Text style={styles.prizeValue}>{post.prize}</Text>
            {post.prize_image_base64 && (
              <Text style={styles.prizeImageHint}>📸 Com imagem de prémio</Text>
            )}
          </View>
        ) : (
          <View style={[styles.prizeBox, { backgroundColor: colors.bgSubtle }]}>
            <Ionicons name="gift-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.prizeLabel}>SEM PRÉMIO</Text>
            <Text style={styles.prizeHint}>Este anúncio não tem prémio para sortear.</Text>
          </View>
        )}

        {/* ─── Resultado ─── */}
        {result ? (
          <View style={styles.resultBox}>
            <Ionicons name="trophy" size={40} color={colors.neutral} />
            <Text style={styles.resultTitle}>🏆 SORTEIO REALIZADO</Text>
            <View style={styles.winnerCard}>
              <Ionicons name="person-circle" size={32} color={colors.text} />
              <View>
                <Text style={styles.winnerLabel}>VENCEDOR</Text>
                <Text style={styles.winnerName}>{result.winner_name || "Participante"}</Text>
                <Text style={styles.winnerId}>ID: {result.winner_id}</Text>
              </View>
            </View>
          </View>
        ) : post?.prize && !post?.prize_drawn ? (
          <View style={styles.drawSection}>
            <Text style={styles.drawInfo}>
              Quem votou 👍 APROVO neste anúncio concorre automaticamente ao prémio.
            </Text>
            <TouchableOpacity
              style={[styles.drawBtn, drawing && { opacity: 0.6 }]}
              onPress={onDraw}
              disabled={drawing}
              activeOpacity={0.85}
            >
              {drawing ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="gift" size={22} color={colors.text} />
                  <Text style={styles.drawBtnText}>🎲 SORTEAR PRÉMIO AGORA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : post?.prize_drawn ? (
          <View style={[styles.resultBox, { backgroundColor: colors.bgSubtle }]}>
            <Ionicons name="checkmark-circle" size={40} color={colors.aprovo} />
            <Text style={styles.resultTitle}>✅ PRÉMIO JÁ SORTEADO</Text>
            <Text style={styles.resultSub}>Este anúncio já teve o seu sorteio realizado.</Text>
          </View>
        ) : null}

        {/* ─── Info importante ─── */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Podes sortear o prémio a qualquer momento, mesmo durante o evento. 
            O vencedor é escolhido aleatoriamente entre todos os que votaram APROVO 
            no teu anúncio.
          </Text>
        </View>
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
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },

  content: { padding: 16, gap: 20, paddingBottom: 40 },

  // ─── Post Info ───
  postInfo: {
    padding: 14,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    gap: 4,
  },
  postWord: { fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  postEvent: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },

  // ─── Prize ───
  prizeBox: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  prizeLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  prizeValue: { fontSize: 20, fontWeight: "900", color: colors.text, textAlign: "center" },
  prizeHint: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  prizeImageHint: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  // ─── Result ───
  resultBox: {
    alignItems: "center",
    gap: 10,
    padding: 20,
    backgroundColor: colors.aprovo,
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  resultTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  resultSub: { fontSize: 13, fontWeight: "600", color: colors.text, textAlign: "center" },
  winnerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    width: "100%",
  },
  winnerLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  winnerName: { fontSize: 16, fontWeight: "900", color: colors.text },
  winnerId: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  // ─── Draw ───
  drawSection: { gap: 12 },
  drawInfo: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
  drawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 60,
    backgroundColor: colors.neutral,
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
  },
  drawBtnText: { fontSize: 16, fontWeight: "900", letterSpacing: 1.5, color: colors.text },

  // ─── Info ───
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
  },
  infoText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, flex: 1, lineHeight: 16 },
});
