import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { useAuth } from "@/s../../contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Overview = {
  users_total: number; businesses_total: number; posts_total: number; votes_total: number; comments_total: number;
  campaigns_total: number; active_campaigns: number; paid_campaigns: number;
  total_revenue_cents: number; total_revenue_usd: number;
  stripe_mode: string;
  top_words: { word: string; posts: number; engagement: number }[];
};

type Advertiser = { user_id: string; email: string; name: string; company_name?: string; country?: string; tax_id?: string; campaigns: number; spent_cents: number };
type Promo = { code: string; discount_pct: number; max_uses?: number; uses: number; expires_at?: string; active: boolean };

export default function AdminDashboard() {
  const { apiFetch, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "advertisers" | "promos" | "tools">("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPromo, setNewPromo] = useState({ code: "", discount_pct: "20" });

  const load = useCallback(async () => {
    try {
      const [o, a, p] = await Promise.all([
        apiFetch("/api/admin/overview"),
        apiFetch("/api/admin/advertisers"),
        apiFetch("/api/admin/promos"),
      ]);
      if (o.ok) setOverview(await o.json());
      if (a.ok) setAdvertisers(await a.json());
      if (p.ok) setPromos(await p.json());
    } catch {} finally { setLoading(false); }
  }, [apiFetch]);

  useFocusEffect(useCallback(() => {
    if (!user?.is_admin) { router.replace("/(tabs)/feed"); return; }
    load();
  }, [user, load, router]));

  const createPromo = async () => {
    if (!newPromo.code) return;
    const r = await apiFetch("/api/admin/promos", { method: "POST", body: JSON.stringify({ code: newPromo.code, discount_pct: parseInt(newPromo.discount_pct) || 10 }) });
    if (r.ok) { setNewPromo({ code: "", discount_pct: "20" }); load(); }
    else Alert.alert("Erro", "Falha ao criar código");
  };

  const deletePromo = async (code: string) => {
    Alert.alert("Apagar?", code, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => { await apiFetch(`/api/admin/promos/${code}`, { method: "DELETE" }); load(); } },
    ]);
  };

  if (!user?.is_admin) return null;
  if (loading) return <SafeAreaView style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.text} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>ADMIN</Text>
        <View style={[styles.modeBadge, { backgroundColor: overview?.stripe_mode === "LIVE" ? colors.aprovo : overview?.stripe_mode === "TEST" ? colors.neutral : colors.desaprovo }]}>
          <Text style={styles.modeText}>{overview?.stripe_mode}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(["overview", "advertisers", "promos", "tools"] as const).map(k => (
          <TouchableOpacity key={k} testID={`tab-${k}`} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{k.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "overview" && overview && (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label="RECEITA TOTAL" value={`$${overview.total_revenue_usd.toFixed(2)}`} bg={colors.aprovo} />
              <Kpi label="CAMPANHAS PAGAS" value={overview.paid_campaigns} bg={colors.neutral} />
              <Kpi label="ANUNCIANTES" value={overview.businesses_total} bg={colors.bg} />
              <Kpi label="USUÁRIOS" value={overview.users_total} bg={colors.bg} />
              <Kpi label="POSTS" value={overview.posts_total} bg={colors.bg} />
              <Kpi label="VOTOS" value={overview.votes_total} bg={colors.bg} />
            </View>
            <Text style={styles.section}>TOP PALAVRAS (ENGAJAMENTO)</Text>
            {overview.top_words.map((w, i) => (
              <View key={w.word + i} style={styles.row}>
                <Text style={styles.rowMain}>#{w.word}</Text>
                <Text style={styles.rowSub}>{w.posts} posts • {w.engagement} eng</Text>
              </View>
            ))}
          </>
        )}

        {tab === "advertisers" && (
          <>
            <Text style={styles.section}>{advertisers.length} ANUNCIANTES</Text>
            {advertisers.map(a => (
              <View key={a.user_id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowMain}>{a.company_name || a.name}</Text>
                  <Text style={styles.rowSub}>{a.email} • {a.country || "—"} • {a.campaigns} camp</Text>
                </View>
                <Text style={styles.rowAmount}>${(a.spent_cents / 100).toFixed(0)}</Text>
              </View>
            ))}
            {advertisers.length === 0 && <Text style={styles.empty}>Sem anunciantes ainda.</Text>}
          </>
        )}

        {tab === "promos" && (
          <>
            <Text style={styles.section}>CRIAR CÓDIGO</Text>
            <View style={styles.promoForm}>
              <TextInput testID="input-promo-code" style={styles.input} placeholder="CÓDIGO" placeholderTextColor="#A1A1AA"
                         value={newPromo.code} onChangeText={(v) => setNewPromo({ ...newPromo, code: v.toUpperCase() })} autoCapitalize="characters" />
              <TextInput testID="input-promo-pct" style={[styles.input, { width: 80 }]} placeholder="%" placeholderTextColor="#A1A1AA"
                         value={newPromo.discount_pct} onChangeText={(v) => setNewPromo({ ...newPromo, discount_pct: v.replace(/\D/g, "").slice(0, 3) })} keyboardType="numeric" />
              <TouchableOpacity testID="btn-create-promo" style={styles.createBtn} onPress={createPromo}>
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.section}>CÓDIGOS ATIVOS</Text>
            {promos.map(p => (
              <View key={p.code} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowMain}>{p.code}</Text>
                  <Text style={styles.rowSub}>{p.discount_pct}% off • usado {p.uses}x</Text>
                </View>
                <TouchableOpacity onPress={() => deletePromo(p.code)} style={styles.delBtn}>
                  <Ionicons name="trash" size={16} color={colors.desaprovo} />
                </TouchableOpacity>
              </View>
            ))}
            {promos.length === 0 && <Text style={styles.empty}>Sem códigos.</Text>}
          </>
        )}

        {tab === "tools" && (
          <>
            <Text style={styles.section}>GESTÃO E DEPLOY</Text>
            <ToolBtn icon="logo-github" label="Push para GitHub" desc="Use o botão 'Save to GitHub' no canto superior direito do Emergent" />
            <ToolBtn icon="rocket" label="Publicar (App Store / Play)" desc="Use o botão 'Publish' no canto superior direito" />
            <ToolBtn icon="link" label="Link público da web" desc="https://image-feedback-app.preview.emergentagent.com" onPress={() => Linking.openURL("https://image-feedback-app.preview.emergentagent.com")} />
            <ToolBtn icon="server" label="Migrar backend" desc="Veja docs Vercel / Railway / AWS no PRD.md" />
            <ToolBtn icon="leaf" label="Migrar MongoDB → Atlas" desc="mongodump local → mongorestore Atlas" />
            <ToolBtn icon="card" label="Stripe Dashboard" desc="Gerir pagamentos reais" onPress={() => Linking.openURL("https://dashboard.stripe.com")} />
            <ToolBtn icon="pricetag" label="Editar preços dos planos" desc="Ajusta valor e votos incluídos de cada tier" onPress={() => router.push("/admin/tiers")} />
            <ToolBtn icon="download" label="Site público besord.eu (ZIP)" desc="Baixar pacote pronto para upload via cPanel" onPress={() => Linking.openURL("/api/download/besord-site.zip")} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, bg }: { label: string; value: string | number; bg: string }) {
  return (
    <View style={[styles.kpi, { backgroundColor: bg }]}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function ToolBtn({ icon, label, desc, onPress }: { icon: any; label: string; desc: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.toolBtn} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={styles.toolLabel}>{label}</Text>
        <Text style={styles.toolDesc}>{desc}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={16} color={colors.text} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border, gap: 8 },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  modeBadge: { borderWidth: 3, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 4, ...brutalShadow },
  modeText: { fontSize: 11, fontWeight: "900", color: colors.text, letterSpacing: 1 },

  tabs: { flexDirection: "row", borderBottomWidth: 4, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { backgroundColor: colors.neutral, borderRightWidth: 3, borderLeftWidth: 3, borderColor: colors.border },
  tabText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  tabTextActive: { color: colors.text },

  content: { padding: 20, gap: 8 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  kpi: { width: "48%", borderWidth: 3, borderColor: colors.border, padding: 12, ...brutalShadow },
  kpiValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  kpiLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 2 },

  section: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 2, borderColor: colors.border, padding: 10, backgroundColor: colors.bg },
  rowMain: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  rowSub: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: "900", color: colors.text },

  promoForm: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 3, borderColor: colors.border, height: 48, paddingHorizontal: 10, fontSize: 14, fontWeight: "900", color: colors.text, backgroundColor: colors.bg, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  createBtn: { width: 48, height: 48, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.aprovo, alignItems: "center", justifyContent: "center", ...brutalShadow },
  delBtn: { width: 32, height: 32, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },

  toolBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 3, borderColor: colors.border, padding: 14, backgroundColor: colors.bg, marginBottom: 8, ...brutalShadow },
  toolLabel: { fontSize: 14, fontWeight: "900", color: colors.text },
  toolDesc: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginTop: 2 },

  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 20, fontWeight: "700" },
});
