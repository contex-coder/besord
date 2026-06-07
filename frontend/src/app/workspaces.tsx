import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { errorMessage } from "@/src/utils/errorMessage";

type Workspace = {
  workspace_id: string;
  owner_user_id: string;
  type: "personal" | "business";
  name: string;
  tax_id?: string | null;
  tax_id_label?: string | null;
  nif?: string | null;
  billing_email?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  is_default?: boolean;
  verified?: boolean;
};

type Country = { code: string; name: string; tax_label: string };

export default function WorkspacesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ new?: string }>();
  const { apiFetch, refreshUser } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(params.new === "1");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const countryInitRef = React.useRef(false);
  const load = useCallback(async () => {
    try {
      const [wsRes, ctyRes] = await Promise.all([
        apiFetch("/api/workspaces"),
        apiFetch("/api/countries").catch(() => null),
      ]);
      if (wsRes.ok) {
        const data = await wsRes.json();
        setWorkspaces(data.workspaces || []);
        setActiveId(data.active_workspace_id || null);
      }
      if (ctyRes && ctyRes.ok) {
        const cd = await ctyRes.json();
        const list: Country[] = cd.countries || [];
        setCountries(list);
        if (!countryInitRef.current) {
          countryInitRef.current = true;
          setSelectedCountry(list.find((c) => c.code === "PT") || list[0] || null);
        }
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
    if (!selectedCountry) { setCreateError("Escolhe o país."); return; }
    if (!taxId.trim()) { setCreateError(`Indica o ${selectedCountry.tax_label}.`); return; }
    if (!billingEmail.trim()) { setCreateError("Indica o email de faturação."); return; }
    setSubmitting(true);
    const r = await apiFetch("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({
        type: "business",
        name: name.trim(),
        tax_id: taxId.trim(),
        tax_id_label: selectedCountry.tax_label,
        country_code: selectedCountry.code,
        country_name: selectedCountry.name,
        billing_email: billingEmail.trim().toLowerCase(),
        contact_name: contactName.trim() || null,
        contact_email: (contactEmail.trim() || billingEmail.trim()).toLowerCase(),
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      setCreateError(errorMessage(body, "Não foi possível criar."));
      return;
    }
    setName(""); setTaxId(""); setBillingEmail(""); setContactName(""); setContactEmail("");
    setShowCreate(false);
    await refreshUser();  // critical: updates user.has_business so profile reflects new company
    load();
  };

  const onResendVerification = async (wsId: string, email: string) => {
    const r = await apiFetch(`/api/workspaces/${wsId}/verify-email/send`, { method: "POST" });
    if (r.ok) {
      Alert.alert("Email enviado", `Verifica a caixa de entrada de ${email} para confirmar a empresa.`);
    } else {
      const body = await r.json().catch(() => null);
      Alert.alert("Erro", errorMessage(body, "Falhou o reenvio."));
    }
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
        <Text style={styles.title}>MINHAS EMPRESAS</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.intro}>
          Adiciona aqui as empresas em nome das quais queres anunciar. Pessoal paga com BW. Cada empresa paga com Stripe usando o próprio ID fiscal.
        </Text>

        {workspaces.map((ws) => {
          const isActive = ws.workspace_id === activeId;
          return (
            <View key={ws.workspace_id} style={[styles.card, isActive && styles.cardActive]} testID={`ws-${ws.workspace_id}`}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, ws.type === "business" ? styles.badgeBiz : styles.badgePf]}>
                  <Text style={styles.badgeText}>{ws.type === "business" ? "EMPRESA" : "PESSOAL"}</Text>
                </View>
                {ws.type === "business" && (
                  ws.verified
                    ? <View style={[styles.badge, { backgroundColor: colors.aprovo }]}>
                        <Text style={[styles.badgeText, { color: colors.text }]}>✓ VERIFICADA</Text>
                      </View>
                    : <View style={[styles.badge, { backgroundColor: colors.desaprovo }]}>
                        <Text style={[styles.badgeText, { color: colors.bg }]}>! NÃO VERIFICADA</Text>
                      </View>
                )}
                {isActive && <Text style={styles.activeLabel}>● ATIVO</Text>}
              </View>
              <Text style={styles.wsName}>{ws.name}</Text>
              {(ws.tax_id || ws.nif) ? <Text style={styles.wsMeta}>{(ws.tax_id_label || "ID")}: {ws.tax_id || ws.nif}</Text> : null}
              {ws.billing_email ? <Text style={styles.wsMeta}>{ws.billing_email}</Text> : null}
              {(ws.country_name || ws.country_code) ? <Text style={styles.wsMeta}>{ws.country_name || ws.country_code}</Text> : null}

              {ws.type === "business" && !ws.verified && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>
                    ⚠ Confirma o email <Text style={{ fontWeight: "900" }}>{ws.billing_email}</Text> para esta empresa poder anunciar.
                  </Text>
                  <TouchableOpacity
                    style={styles.warnBtn}
                    onPress={() => onResendVerification(ws.workspace_id, ws.billing_email || "")}
                    testID={`btn-resend-${ws.workspace_id}`}
                  >
                    <Text style={styles.warnBtnText}>REENVIAR EMAIL</Text>
                  </TouchableOpacity>
                </View>
              )}

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

              <Text style={styles.label}>PAÍS</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setCountryPickerOpen(true)}
                testID="input-country"
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: selectedCountry ? colors.text : colors.textSecondary }}>
                    {selectedCountry ? `${selectedCountry.name}` : "Escolhe o país..."}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.text} />
                </View>
              </TouchableOpacity>

              <Text style={styles.label}>NOME COMERCIAL</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Minha Empresa, Lda." placeholderTextColor="#D4D4D8" testID="input-ws-name" />

              <Text style={styles.label}>{selectedCountry ? selectedCountry.tax_label : "TAX ID"}</Text>
              <TextInput style={styles.input} value={taxId} onChangeText={setTaxId}
                         placeholder={selectedCountry?.tax_label || "Tax ID"}
                         placeholderTextColor="#D4D4D8" autoCapitalize="characters" testID="input-ws-taxid" />

              <Text style={styles.label}>EMAIL DE FATURAÇÃO</Text>
              <TextInput style={styles.input} value={billingEmail} onChangeText={setBillingEmail} placeholder="fatura@empresa.com" placeholderTextColor="#D4D4D8" autoCapitalize="none" keyboardType="email-address" testID="input-ws-billing-email" />

              <Text style={styles.label}>NOME DO CONTACTO (opcional)</Text>
              <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="João Silva" placeholderTextColor="#D4D4D8" autoCapitalize="words" />

              <Text style={styles.label}>EMAIL DE CONTACTO (opcional)</Text>
              <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="contacto@empresa.com" placeholderTextColor="#D4D4D8" autoCapitalize="none" keyboardType="email-address" />

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

      {countryPickerOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setCountryPickerOpen(false)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 20 }}
            activeOpacity={1}
            onPress={() => setCountryPickerOpen(false)}
          >
            <View style={{ backgroundColor: colors.bg, borderWidth: 4, borderColor: colors.border, maxHeight: 400, ...brutalShadow }}>
              <View style={{ padding: 14, borderBottomWidth: 3, borderBottomColor: colors.border, backgroundColor: colors.text }}>
                <Text style={{ fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.textInverse, textAlign: "center" }}>
                  ESCOLHE O PAÍS
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 340 }}>
                {countries.length === 0 ? (
                  <View style={{ padding: 24, alignItems: "center" }}>
                    <ActivityIndicator color={colors.text} />
                    <Text style={{ marginTop: 8, fontSize: 12, fontWeight: "700", color: colors.textSecondary }}>A carregar países...</Text>
                  </View>
                ) : countries.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: selectedCountry?.code === c.code ? colors.aprovo : colors.bg,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                    onPress={() => { setSelectedCountry(c); setCountryPickerOpen(false); }}
                  >
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }}>{c.name}</Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginTop: 2 }}>{c.tax_label}</Text>
                    </View>
                    {selectedCountry?.code === c.code && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.text} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
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
  warnBox: { marginTop: 10, padding: 10, borderWidth: 2, borderColor: colors.desaprovo, backgroundColor: "#FFF8E1" },
  warnText: { fontSize: 11, fontWeight: "700", color: colors.text, lineHeight: 15 },
  warnBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.text, alignSelf: "flex-start", borderWidth: 2, borderColor: colors.border },
  warnBtnText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.textInverse },
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

