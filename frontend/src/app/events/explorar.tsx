import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import EventCard, { EventItem } from "@/src/components/EventCard";

export default function ExplorarEventosScreen() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  // Load geo and nearby events on mount
  useEffect(() => {
    (async () => {
      try {
        const geoR = await apiFetch("/api/geo/me");
        if (geoR.ok) {
          const geo = await geoR.json();
          if (geo.lat && geo.lon) {
            setUserLat(geo.lat);
            setUserLon(geo.lon);
            // Load nearby events automatically
            const r = await apiFetch(`/api/events/nearby?lat=${geo.lat}&lon=${geo.lon}&radius_km=10`);
            if (r.ok) {
              const data = await r.json();
              setEvents(data);
            }
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [apiFetch]);

  const searchByCity = useCallback(async (city: string) => {
    if (!city.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await apiFetch(`/api/events/search?q=${encodeURIComponent(city.trim())}`);
      if (r.ok) {
        const data = await r.json();
        setEvents(data);
      } else {
        Alert.alert("Erro", "Falha na pesquisa.");
      }
    } catch {
      Alert.alert("Erro", "Falha na pesquisa.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (searchQuery) {
      await searchByCity(searchQuery);
    } else if (userLat && userLon) {
      try {
        const r = await apiFetch(`/api/events/nearby?lat=${userLat}&lon=${userLon}&radius_km=10`);
        if (r.ok) setEvents(await r.json());
      } catch {}
    }
    setRefreshing(false);
  }, [apiFetch, userLat, userLon, searchQuery, searchByCity]);

  const onCheckin = useCallback(async (eventId: string) => {
    try {
      const r = await apiFetch(`/api/events/${eventId}/checkin`, { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        Alert.alert(
          data.already_checked_in ? "✅ JÁ FIZESTE CHECK-IN" : "✅ CHECK-IN FEITO!",
          data.already_checked_in ? "" : "Agora vais ver os posts deste evento no teu feed."
        );
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Não foi possível fazer check-in.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao fazer check-in.");
    }
  }, [apiFetch]);

  const onPress = useCallback((eventId: string) => {
    router.push(`/evento/${eventId}`);
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EXPLORAR EVENTOS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Search Bar ─── */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar por cidade, país..."
            placeholderTextColor="#A1A1AA"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={() => searchByCity(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearched(false); }}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, !searchQuery.trim() && { opacity: 0.5 }]}
          onPress={() => searchByCity(searchQuery)}
          disabled={!searchQuery.trim()}
        >
          <Text style={styles.searchBtnText}>PESQUISAR</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Quick filters ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFilters}
      >
        {["Lisboa", "Porto", "São Paulo", "Rio de Janeiro", "Madrid", "Paris", "Londres"].map((city) => (
          <TouchableOpacity
            key={city}
            style={[styles.quickChip, searchQuery === city && styles.quickChipActive]}
            onPress={() => {
              setSearchQuery(city);
              searchByCity(city);
            }}
          >
            <Ionicons name="location" size={12} color={searchQuery === city ? colors.textInverse : colors.text} />
            <Text style={[styles.quickChipText, searchQuery === city && styles.quickChipTextActive]}>
              {city.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── Results ─── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        >
          {/* Info */}
          {!searched && events.length > 0 && (
            <View style={styles.infoBar}>
              <Ionicons name="navigate" size={14} color={colors.text} />
              <Text style={styles.infoBarText}>EVENTOS PRÓXIMOS DE TI</Text>
            </View>
          )}
          {searched && (
            <View style={[styles.infoBar, { backgroundColor: colors.neutral }]}>
              <Ionicons name="search" size={14} color={colors.text} />
              <Text style={styles.infoBarText}>
                {events.length} EVENTO{events.length !== 1 ? "S" : ""} EM &quot;{searchQuery.toUpperCase()}&quot;
              </Text>
            </View>
          )}

          {events.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>NENHUM EVENTO</Text>
              <Text style={styles.emptySub}>
                {searched
                  ? `Não encontramos eventos em "${searchQuery}". Tenta outra cidade.`
                  : "Ainda não há eventos ativos perto de ti. Cria um ou pesquisa por cidade!"}
              </Text>
              {/* CTA para criar evento se tiver perfil empresa */}
              {user?.business_profile && (
                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={() => router.push("/business/evento/novo")}
                >
                  <Ionicons name="add-circle" size={18} color={colors.text} />
                  <Text style={styles.ctaText}>CRIAR EVENTO</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.eventsList}>
              {events.map((ev) => (
                <EventCard
                  key={ev.event_id}
                  event={ev}
                  currentUserId={user?.user_id || null}
                  onCheckin={onCheckin}
                  onPress={onPress}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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

  // ─── Search ───
  searchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: colors.border,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    gap: 6,
    ...brutalShadow,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    ...brutalShadow,
  },
  searchBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.textInverse },

  // ─── Quick Filters ───
  quickFilters: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipActive: { backgroundColor: colors.text },
  quickChipText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.text },
  quickChipTextActive: { color: colors.textInverse },

  // ─── Results ───
  listContent: { padding: 16, paddingBottom: 40, gap: 16 },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  infoBarText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text },

  eventsList: { gap: 20 },

  // ─── Empty ───
  empty: {
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  emptySub: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  // ─── CTA ───
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
    ...brutalShadow,
  },
  ctaText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
});
