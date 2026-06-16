import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import PostCard, { PostItem } from "@/src/components/PostCard";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).toUpperCase();
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function EventDetailScreen() {
  const { id, anuncio } = useLocalSearchParams<{ id: string; anuncio?: string }>();
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<any>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Detetar se veio do Stripe (pagamento concluído)
  useEffect(() => {
    if (anuncio === "sucesso") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 8000);
    }
  }, [anuncio]);

  const isOwner = user?.user_id === event?.company_id;
  const isAdmin = user?.is_admin;
  const isPublicReadyForInvites = event?.event_type === "public" && event?.status === "active";

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      const r = await apiFetch(`/api/events/${id}`);
      if (r.ok) {
        const data = await r.json();
        setEvent(data);
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Evento não encontrado.");
        router.back();
      }
    } catch {
      Alert.alert("Erro", "Falha ao carregar evento.");
      router.back();
    }
  }, [id, apiFetch, router]);

  const loadPosts = useCallback(async () => {
    if (!id) return;
    try {
      const r = await apiFetch(`/api/posts?event_id=${id}`);
      if (r.ok) {
        const data = await r.json();
        setPosts(data);
      }
    } catch {}
  }, [id, apiFetch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await loadEvent();
    await loadPosts();
    setLoading(false);
    setRefreshing(false);
  }, [loadEvent, loadPosts]);

  useEffect(() => {
    loadAll();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // ─── Check-in ───
  const onCheckin = async () => {
    try {
      const r = await apiFetch(`/api/events/${id}/checkin`, { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        if (data.already_checked_in) {
          Alert.alert("✅ JÁ FIZESTE CHECK-IN");
        } else {
          Alert.alert("✅ CHECK-IN FEITO!", "Agora vais ver os posts deste evento no teu feed.");
        }
        loadEvent(); // recarregar para atualizar contagem
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Não foi possível fazer check-in.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao fazer check-in.");
    }
  };

  // ─── Aprovar evento (admin) ───
  const onApprove = async () => {
    Alert.alert("Aprovar evento?", "O evento público ficará ativo para empresas participarem.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aprovar",
        onPress: async () => {
          try {
            const r = await apiFetch(`/api/events/${id}/approve`, { method: "POST" });
            if (r.ok) {
              Alert.alert("✅ Evento aprovado!");
              loadEvent();
            } else {
              const err = await r.json().catch(() => ({}));
              Alert.alert("Erro", err.detail || "Falha ao aprovar.");
            }
          } catch {
            Alert.alert("Erro", "Falha ao aprovar evento.");
          }
        },
      },
    ]);
  };

  // ─── Ir para convite ───
  const onInvite = () => {
    router.push(`/evento/${id}/convite`);
  };

  // ─── Ir para sorteio ───
  const onRaffle = () => {
    router.push(`/evento/${id}/sorteio`);
  };

  // ─── Apagar evento ───
  const onDeleteEvent = () => {
    Alert.alert(
      "Apagar evento?",
      "Esta ação não pode ser desfeita. O evento deixa de estar visível, mas o histórico de quem participou é mantido.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            try {
              const r = await apiFetch(`/api/events/${id}`, { method: "DELETE" });
              if (r.ok) {
                Alert.alert("Evento apagado", "", [{ text: "OK", onPress: () => router.back() }]);
              } else {
                const err = await r.json().catch(() => ({}));
                Alert.alert("Erro", err.detail || "Não foi possível apagar o evento.");
              }
            } catch {
              Alert.alert("Erro", "Falha ao apagar o evento.");
            }
          },
        },
      ]
    );
  };

  // ─── Votar num post ───
  const onVote = async (post_id: string, vote: "aprovo" | "desaprovo") => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.post_id !== post_id) return p;
        const prevVote = p.user_vote;
        let aprovo = p.aprovo_count,
          desaprovo = p.desaprovo_count;
        if (prevVote === vote) {
          if (vote === "aprovo") aprovo--;
          else desaprovo--;
          return { ...p, user_vote: null, aprovo_count: aprovo, desaprovo_count: desaprovo };
        }
        if (prevVote && prevVote !== vote) {
          if (prevVote === "aprovo") aprovo--;
          else desaprovo--;
        }
        if (vote === "aprovo") aprovo++;
        else desaprovo++;
        return { ...p, user_vote: vote, aprovo_count: aprovo, desaprovo_count: desaprovo };
      })
    );
    try {
      await apiFetch(`/api/posts/${post_id}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote }),
      });
      loadPosts();
    } catch {
      loadPosts();
    }
  };

  // ─── Comentar ───
  const onComment = async (post_id: string, word: string) => {
    try {
      const r = await apiFetch(`/api/posts/${post_id}/comment`, {
        method: "POST",
        body: JSON.stringify({ word }),
      });
      if (r.ok) {
        const updated = await r.json();
        setPosts((prev) => prev.map((p) => (p.post_id === post_id ? updated : p)));
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao comentar.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao comentar.");
    }
  };

  const onDeleteComment = async (post_id: string) => {
    const doDelete = async () => {
      try {
        const r = await apiFetch(`/api/posts/${post_id}/comment`, { method: "DELETE" });
        if (r.ok) {
          const updated = await r.json();
          setPosts((prev) => prev.map((p) => (p.post_id === post_id ? updated : p)));
        }
      } catch {}
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Eliminar o teu comentário?")) {
        doDelete();
      }
      return;
    }
    Alert.alert("Eliminar comentário?", "", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: doDelete },
    ]);
  };

  const onDeletePost = async (post_id: string) => {
    const doDelete = async () => {
      try {
        const r = await apiFetch(`/api/posts/${post_id}`, { method: "DELETE" });
        if (r.ok) {
          setPosts((prev) => prev.filter((p) => p.post_id !== post_id));
        }
      } catch {}
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Eliminar este post?")) {
        doDelete();
      }
      return;
    }
    Alert.alert("Eliminar post?", "", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: doDelete },
    ]);
  };

  const onReport = async (post_id: string) => {
    try {
      const r = await apiFetch(`/api/posts/${post_id}/report`, { method: "POST", body: JSON.stringify({}) });
      if (r.ok) {
        const data = await r.json();
        Alert.alert(data.hidden ? "Post ocultado" : "Obrigado!", data.hidden ? "Este post foi removido." : "Denúncia registrada.");
        if (data.hidden) setPosts((prev) => prev.filter((p) => p.post_id !== post_id));
      }
    } catch {}
  };

  const onWordPress = (word: string) => {
    router.push(`/word/${encodeURIComponent(word)}`);
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

  const isExpired = event.status === "expired" || event.status === "raffle_done" || event.status === "cancelled";
  const hasCheckedIn = event.checkins_count > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>DETALHE DO EVENTO</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} onScrollEndDrag={onRefresh}>
        {/* ─── Banner de Sucesso (pós-pagamento) ─── */}
        {showSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={24} color={colors.text} />
            <View>
              <Text style={styles.successTitle}>✅ PAGAMENTO CONCLUÍDO!</Text>
              <Text style={styles.successSub}>O teu anúncio está ativo neste evento. Vai aparecer na secção abaixo.</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSuccess(false)}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Imagem ─── */}
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: event.image_base64 }}
            style={styles.eventImage}
            resizeMode="cover"
          />
          <View style={styles.dateOverlay}>
            <Text style={styles.dateText}>{formatDate(event.date)}</Text>
            <Text style={styles.timeText}>{formatTime(event.date)}</Text>
          </View>
        </View>

        {/* ─── Badges ─── */}
        <View style={styles.badgeRow}>
          <View style={styles.eventBadge}>
            <Ionicons name="location" size={14} color={colors.text} />
            <Text style={styles.eventBadgeText}>EVENTO</Text>
          </View>
          {event.event_type === "public" && (
            <View style={[styles.eventBadge, { backgroundColor: colors.aprovo }]}>
              <Text style={styles.eventBadgeText}>PÚBLICO</Text>
            </View>
          )}
          {event.event_type === "private" && (
            <View style={[styles.eventBadge, { backgroundColor: colors.neutral }]}>
              <Text style={styles.eventBadgeText}>PRIVADO</Text>
            </View>
          )}
          {event.status === "pending_approval" && (
            <View style={[styles.eventBadge, { backgroundColor: colors.neutral }]}>
              <Text style={styles.eventBadgeText}>PENDENTE APROVAÇÃO</Text>
            </View>
          )}
          {isExpired && (
            <View style={[styles.eventBadge, { backgroundColor: colors.desaprovo }]}>
              <Text style={styles.eventBadgeText}>EXPIRADO</Text>
            </View>
          )}
          {event.prize && (
            <View style={[styles.eventBadge, { backgroundColor: colors.neutral }]}>
              <Ionicons name="gift" size={12} color={colors.text} />
              <Text style={styles.eventBadgeText}>PRÉMIO</Text>
            </View>
          )}
        </View>

        {/* ─── Info ─── */}
        <View style={styles.infoBlock}>
          <Text style={styles.title}>{event.title.toUpperCase()}</Text>
          <Text style={styles.companyName}>{event.company_name.toUpperCase()}</Text>

          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}

          {/* Localização */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={colors.textSecondary} />
            <Text style={styles.locationText}>
              {event.location?.address || `${event.location?.lat?.toFixed(4)}, ${event.location?.lon?.toFixed(4)}`}
            </Text>
            {event.distance_km != null && (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>
                  {event.distance_km < 1
                    ? `${Math.round(event.distance_km * 1000)}m`
                    : `${event.distance_km.toFixed(1)}km`}
                </Text>
              </View>
            )}
          </View>

          {/* Métricas */}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={styles.metricValue}>{event.checkins_count}</Text>
              <Text style={styles.metricLabel}>CHECK-INS</Text>
            </View>
            {event.max_participants && (
              <View style={styles.metric}>
                <Ionicons name="ticket" size={16} color={colors.textSecondary} />
                <Text style={styles.metricValue}>{event.participants_count}</Text>
                <Text style={styles.metricLabel}>/{event.max_participants}</Text>
              </View>
            )}
            <View style={styles.metric}>
              <Ionicons name="storefront" size={16} color={colors.textSecondary} />
              <Text style={styles.metricValue}>{event.exhibitors_count}</Text>
              <Text style={styles.metricLabel}>EMPRESAS</Text>
            </View>
            <View style={styles.metric}>
              <Ionicons name="flame" size={16} color={colors.textSecondary} />
              <Text style={styles.metricValue}>+{event.bw_reward}</Text>
              <Text style={styles.metricLabel}>BW</Text>
            </View>
          </View>
        </View>

        {/* ─── Botões de Ação ─── */}
        <View style={styles.actionsBlock}>
          {/* Check-in */}
          {!isOwner && !isExpired && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.aprovo }]}
              onPress={onCheckin}
              activeOpacity={0.8}
            >
              <Ionicons name="location" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>
                {event.checkins_count > 0 ? "✅ CHECK-IN FEITO" : "FAZER CHECK-IN"}
              </Text>
              {event.bw_reward > 0 && (
                <Text style={styles.bwReward}>+{event.bw_reward} BW</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Admin: Aprovar evento */}
          {isAdmin && event.status === "pending_approval" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.aprovo }]}
              onPress={onApprove}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>APROVAR EVENTO</Text>
            </TouchableOpacity>
          )}

          {/* Owner: Convidar empresas (evento público ativo) */}
          {isOwner && isPublicReadyForInvites && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.neutral }]}
              onPress={onInvite}
              activeOpacity={0.8}
            >
              <Ionicons name="link" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>CONVIDAR EMPRESAS</Text>
            </TouchableOpacity>
          )}

          {/* Empresa: Quero anunciar aqui (evento público ativo e não sou owner) */}
          {!isOwner && event?.event_type === "public" && event?.status === "active" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.neutral }]}
              onPress={() => {
                // Ir para o ecrã de participação — se tiver business profile
                if (!user?.business_profile) {
                  Alert.alert(
                    "Precisas de um perfil de empresa",
                    "Para anunciar em eventos, cria o teu perfil empresarial primeiro.",
                    [
                      { text: "Criar agora", onPress: () => router.push("/business/onboard") },
                      { text: "Voltar", style: "cancel" },
                    ]
                  );
                  return;
                }
                router.push(`/evento/${id}/participar`);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="megaphone" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>📢 QUERO ANUNCIAR AQUI</Text>
            </TouchableOpacity>
          )}

          {/* Owner: Publicar imagem (singular/plural/pessoal) */}
          {isOwner && !isExpired && ["singular", "plural", "pessoal"].includes(event.event_type) && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.aprovo }]}
              onPress={() => router.push(`/evento/${id}/publicar`)}
              activeOpacity={0.8}
            >
              <Ionicons name="image" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>PUBLICAR IMAGEM</Text>
            </TouchableOpacity>
          )}

          {/* Owner: Sorteio */}
          {isOwner && !isExpired && event.prize && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.neutral }]}
              onPress={onRaffle}
              activeOpacity={0.8}
            >
              <Ionicons name="gift" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>SORTEAR PRÉMIO</Text>
            </TouchableOpacity>
          )}

          {/* Ver no mapa */}
          {event.location?.lat && event.location?.lon && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.bgSubtle }]}
              onPress={() => {
                const url = `https://www.google.com/maps?q=${event.location.lat},${event.location.lon}`;
                Linking.openURL(url);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="map" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>VER NO MAPA</Text>
            </TouchableOpacity>
          )}

          {/* Owner: Apagar evento */}
          {isOwner && !isExpired && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.desaprovo }]}
              onPress={onDeleteEvent}
              activeOpacity={0.8}
            >
              <Ionicons name="trash" size={20} color={colors.text} />
              <Text style={styles.actionBtnText}>APAGAR EVENTO</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Anúncios / Posts do Evento ─── */}
        <View style={styles.postsSection}>
          <View style={styles.postsSectionHeader}>
            <Ionicons name="megaphone" size={18} color={colors.text} />
            <Text style={styles.postsSectionTitle}>
              ANÚNCIOS DO EVENTO ({posts.length})
            </Text>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsText}>
                {isExpired
                  ? "Este evento não teve anúncios."
                  : isOwner
                  ? "Ainda não há anúncios. Se o evento for público, convida empresas!"
                  : "Ainda não há anúncios neste evento. Volta mais tarde!"}
              </Text>
            </View>
          ) : (
            <View style={styles.postsList}>
              {posts.map((post) => (
                <PostCard
                  key={post.post_id}
                  post={post}
                  currentUserId={user?.user_id || null}
                  onVote={onVote}
                  onComment={onComment}
                  onDeleteComment={onDeleteComment}
                  onReport={onReport}
                  onDeletePost={onDeletePost}
                  onWordPress={onWordPress}
                />
              ))}
            </View>
          )}
        </View>
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
    backgroundColor: colors.bg,
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
    letterSpacing: 1.2,
    color: colors.text,
    flex: 1,
    textAlign: "center",
  },

  // ─── Success Banner ───
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: colors.aprovo,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  successTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5, color: colors.text },
  successSub: { fontSize: 10, fontWeight: "600", color: colors.text, marginTop: 2 },

  scrollContent: { paddingBottom: 40 },

  // ─── Imagem ───
  imageWrap: {
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  eventImage: { width: "100%", aspectRatio: 16 / 9 },
  dateOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    ...brutalShadow,
  },
  dateText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5, color: colors.text },
  timeText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginTop: 2 },

  // ─── Badges ───
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.text,
  },

  // ─── Info ───
  infoBlock: {
    padding: 16,
    gap: 8,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: "900", letterSpacing: -0.3, color: colors.text },
  companyName: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },
  description: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, lineHeight: 20, marginTop: 4 },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  locationText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, flex: 1 },
  distanceBadge: {
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceText: { fontSize: 11, fontWeight: "900", color: colors.text },

  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  metric: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricValue: { fontSize: 14, fontWeight: "900", color: colors.text },
  metricLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },

  // ─── Ações ───
  actionsBlock: {
    padding: 16,
    gap: 10,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  actionBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  bwReward: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  // ─── Posts ───
  postsSection: { padding: 16 },
  postsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
  },
  postsSectionTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 1.2, color: colors.text },

  emptyPosts: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyPostsText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  postsList: { gap: 24 },
});
