import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Workspace = {
  workspace_id: string;
  owner_user_id: string;
  type: "personal" | "business";
  name: string;
  nif?: string | null;
  billing_email?: string | null;
  country_code?: string | null;
  is_default?: boolean;
};

export default function WorkspacesScreen() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("PT");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch("/api/workspaces");
      if (r.ok) {
        const data = await r.json();
        setWorkspaces(data.workspaces || []);
        setActiveId(data.active_workspace_id || null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const activate = async (wsId: string) => {
    const r = await apiFetch(`/api/workspaces/${wsId}/activate`, { method: "POST" });
    if (r.ok) {
      setActiveId(wsId);
    }
  };

  const onDelete = (ws: Workspace) => {
    if (ws.type === "personal") {
      Alert.alert("Não permitido", "O workspace pessoal não pode ser apagado.");
      return;
    }
    Alert.alert(
      "Apagar workspace?",
      `${ws.name} será arquivado. As campanhas anteriores permanecem visíveis no histórico.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar", style: "destructive",
          onPress: async () => {
            const r = await apiFetch(`/api/workspaces/${ws.workspace_id}`, { method: "DELETE" });
            if (r.ok) load();
          },
        },
      ]
    );
  };

  const onCreate = async () => {
    setCreateError(null);
    if (!name.trim()) { setCreateError("Indica o nome da empresa."); return; }
    if (!nif.trim()) { setCreateError("Indica o NIF."); return; }
    if (!email.trim()) { setCreateError("Indica o email de faturação."); return; }
    setSubmitting(true);
    const r = await apiFetch("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({
        type: "business",
        name: name.trim(),
        nif: nif.trim(),
        billing_email: email.trim().toLowerCase(),
        country_code: country.trim().toUpperCase() || null,
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      setCreateError(body?.detail || "Não foi possível criar.");
      return;
    }
    setName(""); setNif(""); setEmail(""); setCountry("PT");
    setShowCreate(false);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="btn-back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>WORKSPACES</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.intro}>
          Um único login, vários contextos. Pessoal paga com BW. Cada empresa paga com Stripe usando o próprio NIF.
        </Text>

        {workspaces.map((ws) => {
          const isActive = ws.workspace_id === activeId;
          return (
            <View key={ws.workspace_id} style={[styles.card, isActive && styles.cardActive]} testID={`ws-${ws.workspace_id}`}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, ws.type === "business" ? styles.badgeBiz : styles.badgePf]}>
                  <Text style={styles.badgeText}>{ws.type === "business" ? "EMPRESA" : "PESSOAL"}</Text>
                </View>
                {isActive && <Text style={styles.activeLabel}>● ATIVO</Text>}
              </View>
              <Text style={styles.wsName}>{ws.name}</Text>
              {ws.nif ? <Text style={styles.wsMeta}>NIF: {ws.nif}</Text> : null}
              {ws.billing_email ? <Text style={styles.wsMeta}>{ws.billing_email}</Text> : null}
              {ws.country_code ? <Text style={styles.wsMeta}>{ws.country_code}</Text> : null}

              <View style={styles.actionsRow}>
                {!isActive && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => activate(ws.workspace_id)} testID={`btn-activate-${ws.workspace_id}`}>
                    <Text style={styles.actionBtnText}>ATIVAR</Text>
                  </TouchableOpacity>
                )}
                {ws.type === "business" && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => onDelete(ws)}>
                    <Text style={[styles.actionBtnText, { color: colors.desaprovo }]}>APAGAR</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {!showCreate ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)} testID="btn-show-create">
            <Ionicons name="add" size={22} color={colors.text} />
            <Text style={styles.addBtnText}>NOVA EMPRESA</Text>
          </TouchableOpacity>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>NOVA EMPRESA (PJ)</Text>
              <Text style={styles.label}>NOME COMERCIAL</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Minha Empresa, Lda." placeholderTextColor="#D4D4D8" testID="input-ws-name" />

              <Text style={styles.label}>NIF</Text>
              <TextInput style={styles.input} value={nif} onChangeText={setNif} placeholder="PT500000000" placeholderTextColor="#D4D4D8" autoCapitalize="characters" testID="input-ws-nif" />

              <Text style={styles.label}>EMAIL DE FATURAÇÃO</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="fatura@empresa.pt" placeholderTextColor="#D4D4D8" autoCapitalize="none" keyboardType="email-address" testID="input-ws-email" />

              <Text style={styles.label}>PAÍS (ISO-2)</Text>
              <TextInput style={styles.input} value={country} onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))} placeholder="PT" placeholderTextColor="#D4D4D8" autoCapitalize="characters" maxLength={2} />

              {createError && <Text style={styles.err}>{createError}</Text>}

              <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                <TouchableOpacity style={[styles.formBtn, { backgroundColor: colors.neutral, flex: 1 }]} onPress={() => setShowCreate(false)}>
                  <Text style={styles.formBtnText}>CANCELAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formBtn, { backgroundColor: colors.text, flex: 1 }]} onPress={onCreate} disabled={submitting} testID="btn-create-ws">
                  {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={[styles.formBtnText, { color: colors.textInverse }]}>CRIAR</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: 2, color: colors.text },
  intro: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  card: { borderWidth: 4, borderColor: colors.border, padding: 16, marginBottom: 14, backgroundColor: colors.bg, ...brutalShadow },
  cardActive: { backgroundColor: colors.aprovo },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: colors.border },
  badgePf: { backgroundColor: colors.neutral },
  badgeBiz: { backgroundColor: colors.text },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.bg },
  activeLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text },
  wsName: { fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 4 },
  wsMeta: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: { borderWidth: 3, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg },
  actionDanger: { borderColor: colors.desaprovo },
  actionBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.text },
  addBtn: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.border, paddingVertical: 14, ...brutalShadow, backgroundColor: colors.bg, marginTop: 10 },
  addBtnText: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.text },
  formCard: { borderWidth: 4, borderColor: colors.border, padding: 16, marginTop: 12, backgroundColor: colors.bg, ...brutalShadow },
  formTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.text, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 3, borderColor: colors.border, paddingHorizontal: 12, minHeight: 44, fontSize: 15, fontWeight: "700", color: colors.text, backgroundColor: colors.bg, ...brutalShadow },
  err: { marginTop: 10, fontSize: 12, fontWeight: "900", color: colors.desaprovo },
  formBtn: { paddingVertical: 14, alignItems: "center", borderWidth: 4, borderColor: colors.border, ...brutalShadow },
  formBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text },
});
