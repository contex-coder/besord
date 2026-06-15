import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type PublicPost = {
  post_id: string;
  word: string;
  image_base64: string;
  aprovo_count: number;
  desaprovo_count: number;
};

type PublicProfile = {
  user_id: string;
  name: string;
  picture: string | null;
  bio: string;
  location: string;
  admirers_count: number;
  bw_total_earned: number;
  is_admired: boolean;
  posts: PublicPost[];
};

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiFetch, user: me } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [admireLoading, setAdmireLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const r = await apiFetch(`/api/users/${id}/profile`);
      if (r.ok) {
        setProfile(await r.json());
      }
    } finally {
      setLoading(false);
    }
  }, [id, apiFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdmire = async () => {
    if (!profile) return;
    setAdmireLoading(true);
    try {
      const method = profile.is_admired ? "DELETE" : "POST";
      const r = await apiFetch(`/api/users/${profile.user_id}/admire`, { method });
      if (r.ok) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                is_admired: !prev.is_admired,
                admirers_count: prev.is_admired
                  ? Math.max(0, prev.admirers_count - 1)
                  : prev.admirers_count + 1,
              }
            : prev
        );
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Não foi possível actualizar.");
      }
    } finally {
      setAdmireLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ActivityIndicator color={colors.text} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Utilizador não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const isOwnProfile = me?.user_id === profile.user_id;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PERFIL</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={profile.posts}
        keyExtractor={(item) => item.post_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.profileBlock}>
            <View style={styles.avatarRow}>
              {profile.picture ? (
                <Image source={{ uri: profile.picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {(profile.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {(profile.name || "Utilizador").toUpperCase()}
                </Text>
                {!!profile.location && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.location} numberOfLines={1}>{profile.location}</Text>
                  </View>
                )}
              </View>
            </View>

            {!!profile.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}

            <View style={styles.statsRow}>
              <StatBox label="POSTS" value={profile.posts.length} />
              <StatBox label="ADMIRADORES" value={profile.admirers_count} />
              <StatBox label="BW TOTAL" value={profile.bw_total_earned} />
            </View>

            {!isOwnProfile && (
              <TouchableOpacity
                style={[styles.admireBtn, profile.is_admired && styles.admireBtnActive]}
                onPress={handleAdmire}
                disabled={admireLoading}
                activeOpacity={0.8}
              >
                {admireLoading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons
                      name={profile.is_admired ? "heart" : "heart-outline"}
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.admireBtnText}>
                      {profile.is_admired ? "ADMIRANDO" : "ADMIRAR"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>PUBLICAÇÕES</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum post ainda.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <Image source={{ uri: item.image_base64 }} style={styles.gridImage} />
            <View style={styles.gridMeta}>
              <Text style={styles.gridWord} numberOfLines={1}>{item.word}</Text>
              <Text style={styles.gridVotes}>
                ✓{item.aprovo_count} ✗{item.desaprovo_count}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  backBtn: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 20, paddingBottom: 40, gap: 12 },
  profileBlock: { gap: 14, marginBottom: 8 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 72, height: 72, borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontSize: 28, fontWeight: "900", color: colors.text },
  userName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  bio: { fontSize: 13, fontWeight: "600", color: colors.text, lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.bgSubtle,
    ...brutalShadow,
  },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 2 },
  admireBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingVertical: 14,
    ...brutalShadow,
  },
  admireBtnActive: {
    backgroundColor: colors.neutral,
  },
  admireBtnText: { fontSize: 14, fontWeight: "900", letterSpacing: 1, color: colors.text },
  sectionLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 8 },
  gridItem: { flex: 1, marginBottom: 12, borderWidth: 3, borderColor: colors.border, ...brutalShadow },
  gridImage: { width: "100%", aspectRatio: 1 },
  gridMeta: { borderTopWidth: 3, borderTopColor: colors.border, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.bg },
  gridWord: { fontSize: 14, fontWeight: "900", color: colors.text },
  gridVotes: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, marginTop: 2 },
  notFound: { textAlign: "center", marginTop: 60, fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  empty: { paddingTop: 20, alignItems: "center" },
  emptyText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
});
