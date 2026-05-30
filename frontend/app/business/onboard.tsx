import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import { t } from "@/src/i18n";

const COUNTRIES = [
  { code: "BR", name: "Brasil", taxLabel: "CNPJ" },
  { code: "US", name: "United States", taxLabel: "EIN" },
  { code: "GB", name: "United Kingdom", taxLabel: "VAT" },
  { code: "PT", name: "Portugal", taxLabel: "NIPC" },
  { code: "DE", name: "Germany", taxLabel: "USt-IdNr" },
  { code: "FR", name: "France", taxLabel: "SIRET" },
  { code: "ES", name: "España", taxLabel: "CIF" },
  { code: "IT", name: "Italia", taxLabel: "P.IVA" },
  { code: "CA", name: "Canada", taxLabel: "BN" },
  { code: "MX", name: "México", taxLabel: "RFC" },
  { code: "AR", name: "Argentina", taxLabel: "CUIT" },
  { code: "CN", name: "中国", taxLabel: "USCC" },
  { code: "JP", name: "日本", taxLabel: "法人番号" },
  { code: "OT", name: "Other / Outro", taxLabel: "Tax ID" },
];

export default function BusinessOnboardScreen() {
  const { apiFetch, refreshUser } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [taxId, setTaxId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const submit = async () => {
    if (!companyName || !contactEmail || !contactName) {
      Alert.alert("Atenção", "Preencha os campos obrigatórios.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/business/profile", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          country: country.name,
          country_code: country.code,
          tax_id: taxId || null,
          contact_email: contactEmail,
          contact_name: contactName,
        }),
      });
      if (r.ok) {
        await refreshUser();
        router.replace("/business/campaign/new");
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro", err.detail || "Falha ao salvar.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="btn-back">
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("business_onboard")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Ionicons name="rocket" size={32} color={colors.text} />
          <Text style={styles.infoTitle}>BESORD INSIGHTS</Text>
          <Text style={styles.infoSub}>Promova imagem + palavra. Receba veredito por região. Em USD.</Text>
        </View>

        <Field label={t("company_name") + " *"}>
          <TextInput testID="input-company" style={styles.input} value={companyName} onChangeText={setCompanyName} autoCapitalize="words" />
        </Field>

        <Field label={t("country") + " *"}>
          <TouchableOpacity testID="input-country" style={styles.input} onPress={() => setShowCountryPicker(!showCountryPicker)}>
            <Text style={styles.inputText}>{country.name}</Text>
          </TouchableOpacity>
          {showCountryPicker && (
            <View style={styles.picker}>
              <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                {COUNTRIES.map(c => (
                  <TouchableOpacity key={c.code} style={styles.pickerItem} onPress={() => { setCountry(c); setShowCountryPicker(false); }}>
                    <Text style={styles.pickerText}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </Field>

        <Field label={`${country.taxLabel} (opcional)`}>
          <TextInput testID="input-taxid" style={styles.input} value={taxId} onChangeText={setTaxId} autoCapitalize="characters" />
        </Field>

        <Field label={t("contact_name") + " *"}>
          <TextInput testID="input-contact-name" style={styles.input} value={contactName} onChangeText={setContactName} autoCapitalize="words" />
        </Field>

        <Field label={t("contact_email") + " *"}>
          <TextInput testID="input-contact-email" style={styles.input} value={contactEmail} onChangeText={setContactEmail}
                     autoCapitalize="none" keyboardType="email-address" />
        </Field>

        <TouchableOpacity testID="btn-save-business" style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.text} /> : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.text} />
              <Text style={styles.submitText}>{t("save")}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>Pagamentos seguros via Stripe. Modo TESTE durante o MVP.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  content: { padding: 20, paddingBottom: 60 },
  infoCard: { borderWidth: 4, borderColor: colors.border, backgroundColor: colors.neutral, padding: 16, gap: 6, marginBottom: 20, ...brutalShadow },
  infoTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  infoSub: { fontSize: 13, fontWeight: "700", color: colors.text },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  input: { borderWidth: 3, borderColor: colors.border, height: 52, paddingHorizontal: 12, fontSize: 15, fontWeight: "700", color: colors.text, backgroundColor: colors.bg, justifyContent: "center", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  inputText: { fontSize: 15, fontWeight: "700", color: colors.text },
  picker: { borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bg, marginTop: 4, ...brutalShadow },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.bgSubtle },
  pickerText: { fontSize: 14, fontWeight: "700", color: colors.text },
  submitBtn: { height: 60, backgroundColor: colors.aprovo, borderWidth: 4, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, ...brutalShadow },
  submitText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.text },
  disclaimer: { textAlign: "center", marginTop: 14, fontSize: 11, fontWeight: "700", color: colors.textSecondary },
});
