import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Post = {
  post_id: string;
  word: string;
  image_base64: string;
  author_id: string;
  aprovo_count: number;
  desaprovo_count: number;
};

export default function PerfilScreen() {
  const { user, signOut, apiFetch } = useAuth();
  const router = useRouter();
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await apiFetch("/api/posts");
      if (r.ok) {
        const data = await r.json();
        setMyPosts(data.filter((p: Post) => p.author_id === user.user_id));
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSignOut = () => {
    const doLogout = async () => {
      await signOut();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Force clean reload on web so all state resets
        window.location.assign("/");
      } else {
        router.replace("/");
      }
    };
    if (Platform.OS === "web") {
      // Alert.alert callbacks on RN-Web are unreliable — use native confirm
      if (typeof window !== "undefined" && window.confirm("Tem certeza que deseja sair?")) {
        doLogout();
      }
      return;
    }
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: doLogout },
    ]);
  };

  if (!user) return null;

  const totalAprovo = myPosts.reduce((s, p) => s + p.aprovo_count, 0);
  const totalDesaprovo = myPosts.reduce((s, p) => s + p.desaprovo_count, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>PERFIL</Text>
        <TouchableOpacity testID="btn-logout" style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={myPosts}
        keyExtractor={(item) => item.post_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.profileBlock}>
            <View style={styles.avatarRow}>
              {user.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{user.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>{user.name.toUpperCase()}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatBox label="POSTS" value={myPosts.length} bg={colors.bg} />
              <StatBox label="APROVO" value={totalAprovo} bg={colors.aprovo} />
              <StatBox label="DESAPROVO" value={totalDesaprovo} bg={colors.desaprovo} />
            </View>

            <TouchableOpacity
              testID="btn-advertise"
              style={styles.advertiseBtn}
              onPress={() => router.push(user.has_business ? "/business/campaigns" : "/business/onboard")}
              activeOpacity={0.85}
            >
              <Ionicons name="rocket" size={20} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.advertiseTitle}>{user.has_business ? "MINHAS CAMPANHAS" : "ANUNCIAR — BESORD INSIGHTS"}</Text>
                <Text style={styles.advertiseSub}>{user.has_business ? "Gerenciar campanhas patrocinadas" : "Veredito do mercado por região"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>

            {user.is_admin && (
              <TouchableOpacity
                testID="btn-admin-panel"
                style={[styles.advertiseBtn, { backgroundColor: colors.text }]}
                onPress={() => router.push("/admin")}
                activeOpacity={0.85}
              >
                <Ionicons name="shield-checkmark" size={20} color={colors.textInverse} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.advertiseTitle, { color: colors.textInverse }]}>PAINEL ADMIN</Text>
                  <Text style={[styles.advertiseSub, { color: colors.textInverse }]}>Gestão completa da app</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>MEUS POSTS</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum post ainda.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <Image source={{ uri: item.image_base64 }} style={styles.gridImage} />
            <View style={styles.gridWord}>
              <Text style={styles.gridWordText} numberOfLines={1}>{item.word}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function StatBox({ label, value, bg }: { label: string; value: number; bg: string }) {
  return (
    <View style={[styles.statBox, { backgroundColor: bg }]}>
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
    paddingVertical: 16,
    borderBottomWidth: 4,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: colors.text },
  logoutBtn: {
    width: 44,
    height: 44,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.desaprovo,
    alignItems: "center",
    justifyContent: "center",
    ...brutalShadow,
  },
  listContent: { padding: 20, paddingBottom: 40, gap: 12 },
  profileBlock: { gap: 16, marginBottom: 8 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 64, height: 64, borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontSize: 24, fontWeight: "900", color: colors.text },
  userName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  userEmail: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, borderWidth: 3, borderColor: colors.border, paddingVertical: 14, alignItems: "center", ...brutalShadow },
  statValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 8 },

  advertiseBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 4, borderColor: colors.border, backgroundColor: colors.neutral, padding: 14, ...brutalShadow },
  advertiseTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: colors.text },
  advertiseSub: { fontSize: 11, fontWeight: "700", color: colors.text, marginTop: 2 },

  gridItem: { flex: 1, marginBottom: 12, borderWidth: 3, borderColor: colors.border, ...brutalShadow },
  gridImage: { width: "100%", aspectRatio: 1 },
  gridWord: { borderTopWidth: 3, borderTopColor: colors.border, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.bg },
  gridWordText: { fontSize: 16, fontWeight: "900", letterSpacing: -0.5, color: colors.text, textAlign: "center" },

  empty: { paddingTop: 30, alignItems: "center" },
  emptyText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
});
