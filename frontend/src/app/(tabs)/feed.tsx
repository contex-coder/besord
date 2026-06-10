import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  ScrollView,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

import PostCard, { PostItem } from "@/src/components/PostCard";
import EventCard, { EventItem } from "@/src/components/EventCard";
import BeetleMascot from "@/src/components/BeetleMascot";
import ProfileSwitcher from "@/src/components/ProfileSwitcher";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_SMALL = SCREEN_W < 380;

type SortMode = "recent" | "trending" | "styles";
type ScopeMode = "world" | "country" | "city";
type FeedTab = "global" | "admired";

type Theme = { key: string; name: string; emoji: string; covers: string };

const COUNTRIES = [
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brasil" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "Espanha" },
  { code: "FR", name: "Franca" },
  { code: "DE", name: "Alemanha" },
  { code: "GB", name: "Reino Unido" },
  { code: "IT", name: "Italia" },
  { code: "JP", name: "Japao" },
  { code: "CN", name: "China" },
  { code: "AO", name: "Angola" },
  { code: "MZ", name: "Mocambique" },
  { code: "CV", name: "Cabo Verde" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
];

export default function FeedScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [checkedInEventIds, setCheckedInEventIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");
  const [scope, setScope] = useState<ScopeMode>("world");
  const [scopeCountry, setScopeCountry] = useState<string | null>(null);
  const [scopeCity, setScopeCity] = useState<string | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [mascotTapCount, setMascotTapCount] = useState(0);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [showScopePicker, setShowScopePicker] = useState(false);
  const [customCountry, setCustomCountry] = useState("");
  const [customCity, setCustomCity] = useState("");
  // Hype toggle state
  const [hypeActive, setHypeActive] = useState(false);
  const [feedTab, setFeedTab] = useState<FeedTab>("global");
  const [admiredPosts, setAdmiredPosts] = useState<PostItem[]>([]);
  // Time-Gate
  const [dailyRemaining, setDailyRemaining] = useState<number>(10);
  const [showTimeGateWarning, setShowTimeGateWarning] = useState(false);
  // Word Links bottom sheet
  const [wordSheetWord, setWordSheetWord] = useState<string | null>(null);
  const [wordSheetPosts, setWordSheetPosts] = useState<PostItem[]>([]);
  const [wordSheetLoading, setWordSheetLoading] = useState(false);

  const mascotPhrases = [
    "BESORD!",
    "VOTA! ✅",
    "🔥 EM ALTA!",
    "BW +1!",
    "BOOST! 🚀",
    "👑 REI!",
  ];
  const mascotPhrase = mascotPhrases[mascotTapCount % mascotPhrases.length];

  const handleMascotPress = () => {
    setMascotTapCount((prev) => prev + 1);
  };

  // Load geo info on mount + request device location
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/geo/me");
        if (r.ok) {
          const data = await r.json();
          if (data.country_code) setScopeCountry(data.country_code);
          if (data.city) setScopeCity(data.city);
          if (data.lat) setUserLat(data.lat);
          if (data.lon) setUserLon(data.lon);
        }
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setUserLat(pos.coords.latitude);
              setUserLon(pos.coords.longitude);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
      } catch {}
    })();
  }, [apiFetch]);

  // Load themes once
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/themes");
        if (r.ok) setThemes(await r.json());
      } catch {}
    })();
  }, [apiFetch]);

  // Load workspaces for ProfileSwitcher
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/workspaces");
        if (r.ok) {
          const data = await r.json();
          setWorkspaces(data.workspaces?.filter((w: any) => w.type === "business") || []);
          setActiveWsId(data.active_workspace_id || null);
        }
      } catch {}
    })();
  }, [apiFetch]);

  const handleSwitchWorkspace = async (wsId: string) => {
    const r = await apiFetch(`/api/workspaces/${wsId}/activate`, { method: "POST" });
    if (r.ok) {
      setActiveWsId(wsId);
    }
  };

  // Load nearby events
  useEffect(() => {
    if (userLat != null && userLon != null) {
      (async () => {
        try {
          const r = await apiFetch(`/api/events/nearby?lat=${userLat}&lon=${userLon}&radius_km=10`);
          if (r.ok) {
            const data = await r.json();
            setEvents(data);
          }
        } catch {}
      })();
    }
  }, [apiFetch, userLat, userLon]);

  const buildQueryString = useCallback(
    (mode: SortMode, sc: ScopeMode, th: string | null, hype: boolean) => {
      const params = new URLSearchParams();
      if (mode === "styles") {
        params.set("source", "styles");
        params.set("sort", "recent");
      } else {
        params.set("sort", mode);
      }
      params.set("scope", sc);
      if (sc === "country" && scopeCountry) params.set("country_code", scopeCountry);
      if (sc === "city" && scopeCity) params.set("city", scopeCity);
      if (th) params.set("theme", th);
      if (hype) params.set("is_hype", "true");
      return params.toString();
    },
    [scopeCountry, scopeCity]
  );

  const load = useCallback(
    async (mode: SortMode = sort, sc: ScopeMode = scope, th: string | null = activeTheme, hype: boolean = hypeActive) => {
      try {
        const qs = buildQueryString(mode, sc, th, hype);
        const r = await apiFetch(`/api/posts?${qs}`);
        if (r.ok) {
          const data = await r.json();
          setPosts(data);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiFetch, sort, scope, activeTheme, hypeActive, buildQueryString]
  );

  // Reload when any filter changes
  useEffect(() => {
    load(sort, scope, activeTheme, hypeActive);
  }, [sort, scope, activeTheme, hypeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      load(sort, scope, activeTheme, hypeActive);
    }, [load, sort, scope, activeTheme, hypeActive])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(sort, scope, activeTheme, hypeActive);
  }, [load, sort, scope, activeTheme, hypeActive]);

  const onVote = useCallback(
    async (post_id: string, vote: "aprovo" | "desaprovo") => {
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
        const r = await apiFetch(`/api/posts/${post_id}/vote`, {
          method: "POST",
          body: JSON.stringify({ vote }),
        });
        if (r.ok) {
          const updated = await r.json();
          setPosts((prev) => prev.map((p) => (p.post_id === post_id ? updated : p)));
          const remaining = updated.daily_interactions_remaining ?? 10;
          setDailyRemaining(remaining);
          if (remaining <= 3) setShowTimeGateWarning(true);
        } else if (r.status === 429) {
          // Time-Gate reached — revert optimistic update
          load(sort, scope, activeTheme, hypeActive);
          setDailyRemaining(0);
          setShowTimeGateWarning(true);
        } else {
          load(sort, scope, activeTheme, hypeActive);
        }
      } catch {
        load(sort, scope, activeTheme, hypeActive);
      }
    },
    [apiFetch, load, sort, scope, activeTheme, hypeActive]
  );

  const onComment = useCallback(
    async (post_id: string, word: string) => {
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
    },
    [apiFetch]
  );

  const onDeleteComment = useCallback(
    async (post_id: string) => {
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
    },
    [apiFetch]
  );

  const onDeletePost = useCallback(
    async (post_id: string) => {
      const doDelete = async () => {
        try {
          const r = await apiFetch(`/api/posts/${post_id}`, { method: "DELETE" });
          if (r.ok) {
            setPosts((prev) => prev.filter((p) => p.post_id !== post_id));
          } else {
            const err = await r.json().catch(() => ({}));
            Alert.alert("Erro", err.detail || "Não foi possível eliminar.");
          }
        } catch (e: any) {
          Alert.alert("Erro", e?.message || "Falha ao eliminar.");
        }
      };
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm("Eliminar este post? Esta ação é irreversível.")) {
          doDelete();
        }
        return;
      }
      Alert.alert("Eliminar post?", "Esta ação é irreversível.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: doDelete },
      ]);
    },
    [apiFetch]
  );

  const onReport = useCallback(
    async (post_id: string) => {
      const doReport = async () => {
        try {
          const r = await apiFetch(`/api/posts/${post_id}/report`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          if (r.ok) {
            const data = await r.json();
            Alert.alert(
              data.hidden ? "Post ocultado" : "Obrigado!",
              data.hidden ? "Este post foi removido do feed." : "Sua denúncia foi registrada."
            );
            load(sort, scope, activeTheme, hypeActive);
          }
        } catch {}
      };
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm("Reportar este post como inadequado?")) {
          doReport();
        }
        return;
      }
      Alert.alert("Reportar post", "Deseja reportar este post como inadequado?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Reportar", style: "destructive", onPress: doReport },
      ]);
    },
    [apiFetch, load, sort, scope, activeTheme, hypeActive]
  );

  const loadAdmired = useCallback(async () => {
    try {
      const r = await apiFetch("/api/feed/admired");
      if (r.ok) setAdmiredPosts(await r.json());
    } catch {}
  }, [apiFetch]);

  useEffect(() => {
    if (feedTab === "admired") loadAdmired();
  }, [feedTab, loadAdmired]);

  const onWordPress = useCallback(
    async (word: string) => {
      setWordSheetWord(word);
      setWordSheetPosts([]);
      setWordSheetLoading(true);
      try {
        const r = await apiFetch(`/api/posts?sort=recent&word=${encodeURIComponent(word)}`);
        if (r.ok) setWordSheetPosts(await r.json());
      } finally {
        setWordSheetLoading(false);
      }
    },
    [apiFetch]
  );

  const onEventCheckin = useCallback(
    async (eventId: string) => {
      try {
        const r = await apiFetch(`/api/events/${eventId}/checkin`, { method: "POST" });
        if (r.ok) {
          setCheckedInEventIds((prev) => [...prev, eventId]);
          Alert.alert("✅ CHECK-IN FEITO!", "Agora vais ver os posts deste evento no teu feed.");
        } else {
          const err = await r.json().catch(() => ({}));
          Alert.alert("Erro", err.detail || "Não foi possível fazer check-in.");
        }
      } catch (e: any) {
        Alert.alert("Erro", e?.message || "Falha ao fazer check-in.");
      }
    },
    [apiFetch]
  );

  const onEventPress = useCallback(
    (eventId: string) => {
      router.push(`/evento/${eventId}`);
    },
    [router]
  );

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image source={require("@/assets/images/besord_i.png")} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.brand}>BESORD</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {workspaces.length > 0 && (
            <ProfileSwitcher
              workspaces={workspaces}
              activeId={activeWsId}
              onSwitch={handleSwitchWorkspace}
            />
          )}
          <TouchableOpacity testID="btn-trends" onPress={() => router.push("/trends")} style={styles.trendsBtn}>
            <Ionicons name="trending-up" size={14} color={colors.text} />
            <Text style={styles.trendsText}>TRENDS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Subtabs Global | Admirados ─── */}
      <View style={styles.subtabRow}>
        <TouchableOpacity
          style={[styles.subtab, feedTab === "global" && styles.subtabActive]}
          onPress={() => setFeedTab("global")}
        >
          <Text style={[styles.subtabText, feedTab === "global" && styles.subtabTextActive]}>GLOBAL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subtab, feedTab === "admired" && styles.subtabActive]}
          onPress={() => setFeedTab("admired")}
        >
          <Ionicons name="heart" size={12} color={feedTab === "admired" ? colors.text : colors.textSecondary} />
          <Text style={[styles.subtabText, feedTab === "admired" && styles.subtabTextActive]}>ADMIRADOS</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Scope + Hype + Search bar (linha única) — apenas no Global ─── */}
      {feedTab === "global" && <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          {/* Scope chips */}
          {[
            { key: "world" as ScopeMode, label: "🌍" },
            { key: "country" as ScopeMode, label: scopeCountry ? `🇵🇹` : "📍" },
            { key: "city" as ScopeMode, label: scopeCity ? "📍CIDADE" : "📍" },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.scopeChip, scope === s.key && styles.scopeChipActive]}
              onPress={() => {
                if (s.key === "city" || s.key === "country") {
                  setShowScopePicker(true);
                } else {
                  setScope(s.key);
                }
              }}
            >
              <Text style={[styles.scopeChipText, scope === s.key && styles.scopeChipTextActive]}>
                {s.label}
              </Text>
              <Ionicons name="chevron-down" size={10} color={scope === s.key ? "#FFF" : colors.text} />
            </TouchableOpacity>
          ))}

          {/* Divider */}
          <View style={styles.filterDivider} />

          {/* Hype toggle button */}
          <TouchableOpacity
            style={[styles.hypeChip, hypeActive && styles.hypeChipActive]}
            onPress={() => setHypeActive(!hypeActive)}
          >
            <Ionicons
              name={hypeActive ? "flame" : "flame-outline"}
              size={14}
              color={hypeActive ? "#FFF" : colors.text}
            />
            <Text style={[styles.hypeChipText, hypeActive && styles.hypeChipTextActive]}>
              HYPES
            </Text>
          </TouchableOpacity>

          {/* Trends button (ao lado do Hype) */}
          <TouchableOpacity
            style={styles.trendChip}
            onPress={() => router.push("/trends")}
          >
            <Ionicons name="trending-up" size={14} color={colors.text} />
            <Text style={styles.trendChipText}>TRENDS</Text>
          </TouchableOpacity>

          {/* Explorar Eventos */}
          <TouchableOpacity
            style={styles.eventChip}
            onPress={() => router.push("/events/explorar")}
          >
            <Ionicons name="location" size={14} color={colors.text} />
            <Text style={styles.eventChipText}>EVENTOS</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>}

      {/* ─── Sort Toggle — apenas no Global ─── */}
      {feedTab === "global" && <View style={styles.sortRow}>
        <TouchableOpacity
          testID="sort-recent"
          style={[styles.sortBtn, sort === "recent" && styles.sortBtnActive]}
          onPress={() => setSort("recent")}
        >
          <Text style={[styles.sortText, sort === "recent" && styles.sortTextActive]}>RECENTE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="sort-trending"
          style={[styles.sortBtn, sort === "trending" && styles.sortBtnActive]}
          onPress={() => setSort("trending")}
        >
          <Ionicons name="flame" size={12} color={sort === "trending" ? colors.text : colors.textSecondary} />
          <Text style={[styles.sortText, sort === "trending" && styles.sortTextActive]}>EM ALTA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="sort-styles"
          style={[styles.sortBtn, sort === "styles" && styles.sortBtnActive]}
          onPress={() => setSort("styles")}
        >
          <Ionicons name="star" size={12} color={sort === "styles" ? colors.text : colors.textSecondary} />
          <Text style={[styles.sortText, sort === "styles" && styles.sortTextActive]}>ESTILOS</Text>
        </TouchableOpacity>
      </View>}

      {/* ——— Scope Picker Modal ——— */}
      <Modal visible={showScopePicker} transparent animationType="fade" onRequestClose={() => setShowScopePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowScopePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ESCOLHER LOCAL</Text>
            <Text style={styles.modalLabel}>PAIS</Text>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.countryItem, customCountry === c.code && styles.countryItemActive]}
                  onPress={() => setCustomCountry(c.code)}
                >
                  <Text style={styles.countryItemText}>{c.name}</Text>
                  <Text style={styles.countryItemCode}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.modalLabel, { marginTop: 10 }]}>CIDADE</Text>
            <TextInput
              style={styles.modalInput}
              value={customCity}
              onChangeText={setCustomCity}
              placeholder="Ex: Lisboa, Sao Paulo..."
              placeholderTextColor="#A1A1AA"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setShowScopePicker(false)}>
                <Text style={styles.modalBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.text }]} onPress={() => {
                if (customCountry) { setScopeCountry(customCountry); setScope("country"); }
                if (customCity) { setScopeCity(customCity); setScope("city"); }
                setShowScopePicker(false);
              }}>
                <Text style={[styles.modalBtnText, { color: colors.textInverse }]}>APLICAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Time-Gate Warning Banner ─── */}
      {showTimeGateWarning && (
        <View style={styles.timeGateBanner}>
          <Ionicons name="time-outline" size={16} color={colors.text} />
          <Text style={styles.timeGateText}>
            {dailyRemaining === 0
              ? "O mundo já te deu o suficiente por hoje. Vá viver."
              : `Restam ${dailyRemaining} interacção${dailyRemaining !== 1 ? "ões" : ""} hoje.`}
          </Text>
          <TouchableOpacity onPress={() => setShowTimeGateWarning(false)}>
            <Ionicons name="close" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={feedTab === "admired" ? admiredPosts : posts}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={feedTab === "admired" ? loadAdmired : onRefresh}
            tintColor={colors.text}
          />
        }
        ListHeaderComponent={
          <View>
            {/* ─── Event Bar (horizontal scroll) ─── */}
            {events.length > 0 && (
              <View style={styles.eventBar}>
                <View style={styles.eventBarHeader}>
                  <Ionicons name="location" size={14} color={colors.text} />
                  <Text style={styles.eventBarTitle}>EVENTOS PRÓXIMOS</Text>
                  <TouchableOpacity
                    style={styles.exploreEventsBtn}
                    onPress={() => router.push("/events/explorar")}
                  >
                    <Ionicons name="search" size={12} color={colors.text} />
                    <Text style={styles.exploreEventsText}>EXPLORAR</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}
                >
                  {events.map((ev) => (
                    <View key={ev.event_id} style={{ width: 280 }}>
                      <EventCard
                        event={ev}
                        currentUserId={user?.user_id || null}
                        onCheckin={onEventCheckin}
                        onPress={onEventPress}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── Indicador Feed Misto ─── */}
            {checkedInEventIds.length > 0 && (
              <View style={styles.feedEventHeader}>
                <Ionicons name="location" size={16} color={colors.text} />
                <Text style={styles.feedEventHeaderText}>
                  INCLUINDO POSTS DE {checkedInEventIds.length} EVENTO{checkedInEventIds.length > 1 ? "S" : ""}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="feed-empty">
            <Text style={styles.emptyTitle}>NADA POR AQUI</Text>
            <Text style={styles.emptySub}>
              {hypeActive
                ? "Ainda não há hypes ativos. Ativa o modo hype nos teus posts!"
                : scope === "city" && scopeCity
                ? `Ainda não há posts em ${scopeCity.toUpperCase()}. Muda para MUNDO ou PT.`
                : scope === "country" && scopeCountry
                ? `Ainda não há posts em PT. Muda para MUNDO.`
                : "Seja o primeiro a postar uma imagem com uma palavra."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={user?.user_id || null}
            onVote={onVote}
            onComment={onComment}
            onDeleteComment={onDeleteComment}
            onReport={onReport}
            onDeletePost={onDeletePost}
            onWordPress={onWordPress}
            onAuthorPress={(userId) => router.push(`/user/${userId}`)}
            dailyRemaining={dailyRemaining}
          />
        )}
      />

      {/* ─── Word Links Bottom Sheet ─── */}
      <Modal
        visible={wordSheetWord !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setWordSheetWord(null)}
      >
        <TouchableOpacity
          style={styles.wordSheetOverlay}
          activeOpacity={1}
          onPress={() => setWordSheetWord(null)}
        />
        <View style={styles.wordSheetContainer}>
          <View style={styles.wordSheetHandle} />
          <View style={styles.wordSheetHeader}>
            <Text style={styles.wordSheetTitle}>#{wordSheetWord}</Text>
            <TouchableOpacity
              onPress={() => {
                setWordSheetWord(null);
                if (wordSheetWord) router.push(`/word/${encodeURIComponent(wordSheetWord)}`);
              }}
              style={styles.wordSheetFullBtn}
            >
              <Ionicons name="expand-outline" size={14} color={colors.text} />
              <Text style={styles.wordSheetFullText}>VER TUDO</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWordSheetWord(null)} style={styles.wordSheetCloseBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          {wordSheetLoading ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={wordSheetPosts}
              keyExtractor={(item) => item.post_id}
              contentContainerStyle={{ paddingBottom: 32 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 40 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>
                    Nenhum post com esta palavra ainda.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <PostCard
                  post={item}
                  currentUserId={user?.user_id || null}
                  onVote={onVote}
                  onComment={onComment}
                  onDeleteComment={onDeleteComment}
                  onReport={onReport}
                  onDeletePost={onDeletePost}
                  onWordPress={onWordPress}
                  onAuthorPress={(userId) => { setWordSheetWord(null); router.push(`/user/${userId}`); }}
                  dailyRemaining={dailyRemaining}
                />
              )}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  headerLogo: { width: 36, height: 36 },
  brand: { fontSize: 26, fontWeight: "900", letterSpacing: -1, color: colors.text },
  trendsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.aprovo,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...brutalShadow,
  },
  trendsText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.text },

  // ─── Subtabs Global | Admirados ───
  subtabRow: {
    flexDirection: "row",
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  subtab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    backgroundColor: colors.bg,
    borderRightWidth: 2,
    borderRightColor: colors.border,
  },
  subtabActive: { backgroundColor: colors.neutral },
  subtabText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: colors.textSecondary },
  subtabTextActive: { color: colors.text },

  // ─── Filter bar (Scope + Hype + Trends numa linha) ───
  filterBar: {
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  scopeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.bgSubtle,
  },
  scopeChipActive: { backgroundColor: colors.text },
  scopeChipText: { fontSize: 12, fontWeight: "900", color: colors.text },
  scopeChipTextActive: { color: colors.textInverse },
  filterDivider: { width: 3, backgroundColor: colors.border, marginHorizontal: 4 },

  // ─── Hype Chip ───
  hypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.bgSubtle,
  },
  hypeChipActive: { backgroundColor: colors.neutral, borderWidth: 3 },
  hypeChipText: { fontSize: 11, fontWeight: "900", color: colors.text },
  hypeChipTextActive: { color: colors.text },

  // ─── Trend Chip ───
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.bgSubtle,
  },
  trendChipText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.text },

  // ─── Event Chip ───
  eventChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.aprovo,
  },
  eventChipText: { fontSize: 11, fontWeight: "900", color: colors.text },

  // ——— Scope Picker Modal ———
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    padding: 16,
    ...brutalShadow,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text, marginBottom: 12 },
  modalLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginBottom: 6 },
  countryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryItemActive: { backgroundColor: colors.neutral },
  countryItemText: { fontSize: 13, fontWeight: "700", color: colors.text },
  countryItemCode: { fontSize: 11, fontWeight: "900", color: colors.textSecondary },
  modalInput: {
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  modalBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.text },

  // ─── Sort ───
  sortRow: {
    flexDirection: "row",
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    ...brutalShadow,
  },
  sortBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: IS_SMALL ? 7 : 10,
    backgroundColor: colors.bg,
    borderRightWidth: 3,
    borderRightColor: colors.border,
  },
  sortBtnActive: { backgroundColor: colors.neutral },
  sortText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.textSecondary },
  sortTextActive: { color: colors.text },

  // ─── Event Bar ───
  eventBar: {
    marginBottom: 16,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSubtle,
    paddingTop: 12,
  },
  eventBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  eventBarTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.text,
    flex: 1,
  },
  exploreEventsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exploreEventsText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },

  // ─── Feed Misto ───
  feedEventHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
  },
  feedEventHeaderText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.text,
  },
  listContent: { paddingBottom: 40, gap: 0 },
  // ─── Time-Gate Banner ───
  timeGateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.neutral,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
  },
  timeGateText: { flex: 1, fontSize: 12, fontWeight: "900", color: colors.text },

  // ─── Word Links Bottom Sheet ───
  wordSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  wordSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "75%",
    backgroundColor: colors.bg,
    borderTopWidth: 4,
    borderTopColor: colors.border,
    ...brutalShadow,
  },
  wordSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 2,
  },
  wordSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
    gap: 8,
  },
  wordSheetTitle: { flex: 1, fontSize: 20, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  wordSheetFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.bgSubtle,
  },
  wordSheetFullText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },
  wordSheetCloseBtn: {
    width: 36,
    height: 36,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },

  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
