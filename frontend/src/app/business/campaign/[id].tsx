import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "@/s../../contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";
import HeatMap, { GeoPoint } from "@/s../../components/HeatMap";

type Campaign = {
  campaign_id: string; post_id: string | null; word: string; image_base64: string;
  tier_key: string; tier_name: string; scope: string; duration_days: number;
  target_country_code: string | null; target_region: string | null; target_city: string | null;
  status: string; amount_cents: number; included_votes: number; votes_collected: number;
  aprovo_count: number; desaprovo_count: number;
  starts_at: string | null; ends_at: string | null;
  checkout_url: string | null;
};

type RegionRow = { label: string; aprovo: number; desaprovo: number; total: number; aprovo_pct: number };
type TopWord = { word: string; count: number; pct: number };
type Pace = { votes_per_day: number; days_active: number; days_remaining: number; projected_total: number; target: number; on_track: boolean };
type Report = {
  total_votes: number; aprovo_count: number; desaprovo_count: number; aprovo_pct: number;
  verdict_tag: string; summary: string;
  by_country: RegionRow[]; by_region: RegionRow[]; by_city: RegionRow[];
  geo_points?: GeoPoint[];
  word_cloud: { word: string; count: number }[];
  top_3_words: TopWord[]; total_comments: number;
  pace: Pace;
};

export default function CampaignDetailScreen() {
  const { id, paid } = useLocalSearchParams<{ id: string; paid?: string }>();
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelConfirmText, setCancelConfirmText] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const doCancel = useCallback(async () => {
    if (cancelConfirmText.trim().toUpperCase() !== "ELIMINAR") return;
    setCancelling(true);
    try {
      const r = await apiFetch(`/api/business/campaigns/${id}/cancel`, { method: "POST" });
      if (r.ok) {
        const c = await r.json();
        setCampaign(c);
        setCancelModalOpen(false);
        setCancelConfirmText("");
        // Bounce back to campaigns list after a brief moment
        setTimeout(() => router.replace("/business/campaigns"), 600);
      } else {
        const err = await r.json().catch(() => ({}));
        if (typeof window !== "undefined" && (window as any).alert) {
          (window as any).alert(err.detail || "Não foi possível eliminar a campanha.");
        }
      }
    } finally {
      setCancelling(false);
    }
  }, [apiFetch, id, cancelConfirmText, router]);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/business/campaigns/${id}`);
      if (r.ok) {
        const c = await r.json();
        setCampaign(c);
        if (c.status === "active" || c.status === "completed") {
          const rep = await apiFetch(`/api/business/campaigns/${id}/report`);
          if (rep.ok) setReport(await rep.json());
        }
      }
    } finally { setLoading(false); }
  }, [apiFetch, id]);

  const checkPayment = useCallback(async () => {
    setChecking(true);
    try {
      const r = await apiFetch(`/api/business/campaigns/${id}/check-payment`, { method: "POST" });
      if (r.ok) { setCampaign(await r.json()); load(); }
    } finally { setChecking(false); }
  }, [apiFetch, id, load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (paid === "1") checkPayment();
  }, [paid]);  // eslint-disable-line

  if (loading || !campaign) {
    return <SafeAreaView style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.text} /></SafeAreaView>;
  }

  const statusColor = campaign.status === "active" ? colors.aprovo : campaign.status === "completed" ? colors.neutral : colors.desaprovo;
  const statusLabel = campaign.status === "active" ? "ATIVA" : campaign.status === "completed" ? "CONCLUÍDA" : campaign.status === "pending_payment" ? "AGUARDA PAGAMENTO" : campaign.status.toUpperCase();
  const progress = campaign.included_votes > 0 ? Math.min(100, Math.round(campaign.votes_collected / campaign.included_votes * 100)) : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>#{campaign.word}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Image source={{ uri: campaign.image_base64 }} style={styles.heroImage} />
          <View style={styles.heroFooter}>
            <Text style={styles.heroWord}>#{campaign.word}</Text>
            <Text style={styles.heroMeta}>{campaign.tier_name} • {campaign.scope.toUpperCase()} • {campaign.duration_days}D</Text>
            {(campaign.target_country_code || campaign.target_region || campaign.target_city) && (
              <View style={styles.geoTargetBadge} testID="campaign-geo-target">
                <Ionicons name="location" size={14} color={colors.text} />
                <Text style={styles.geoTargetText}>
                  {[campaign.target_city, campaign.target_region, campaign.target_country_code]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {campaign.status === "pending_payment" && campaign.checkout_url && (
          <TouchableOpacity testID="btn-pay-now" style={styles.payBtn} onPress={async () => {
            if (Platform.OS === "web" && typeof window !== "undefined") window.location.href = campaign.checkout_url!;
            else { await WebBrowser.openBrowserAsync(campaign.checkout_url!); checkPayment(); }
          }}>
            <Ionicons name="card" size={22} color={colors.text} />
            <Text style={styles.payText}>PAGAR €{(campaign.amount_cents / 100).toFixed(2)}</Text>
          </TouchableOpacity>
        )}

        {campaign.status === "pending_payment" && (
          <TouchableOpacity testID="btn-check-payment" style={styles.checkBtn} onPress={checkPayment} disabled={checking}>
            {checking ? <ActivityIndicator color={colors.text} /> : (
              <><Ionicons name="refresh" size={18} color={colors.text} /><Text style={styles.checkText}>VERIFICAR PAGAMENTO</Text></>
            )}
          </TouchableOpacity>
        )}

        {(campaign.status === "active" || campaign.status === "completed") && (
          <>
            <Text style={styles.section}>VOTOS COLETADOS</Text>
            <View style={styles.statsRow}>
              <StatBox value={campaign.votes_collected} label="TOTAL" bg={colors.bg} />
              <StatBox value={campaign.aprovo_count} label="APROVO" bg={colors.aprovo} />
              <StatBox value={campaign.desaprovo_count} label="DESAPROVO" bg={colors.desaprovo} />
            </View>

            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>META: {campaign.votes_collected} / {campaign.included_votes} ({progress}%)</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>

            {report && report.total_votes > 0 && (
              <>
                <View style={styles.summaryCard}>
                  <Ionicons name="sparkles" size={22} color={colors.text} />
                  <Text style={styles.summaryText}>{report.summary}</Text>
                </View>

                <View style={styles.verdictWrap}>
                  <Text style={styles.verdictLabel}>VEREDITO COLECTIVO • {report.verdict_tag}</Text>
                  <Text style={styles.verdictBig}>{report.aprovo_pct}% APROVO</Text>
                  <View style={styles.voteBar}>
                    <View style={[styles.voteBarFill, { width: `${report.aprovo_pct}%` }]} />
                  </View>
                </View>

                {report.top_3_words.length > 0 && (
                  <View style={{ marginTop: 18 }}>
                    <Text style={styles.section}>🏆 TOP 3 PALAVRAS NOS COMENTÁRIOS</Text>
                    <View style={styles.podium}>
                      {report.top_3_words.map((w, i) => {
                        const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];
                        const labels = ["1º", "2º", "3º"];
                        return (
                          <View key={w.word} style={[styles.podiumItem, { backgroundColor: medals[i] }]}>
                            <Text style={styles.podiumRank}>{labels[i]}</Text>
                            <Text style={styles.podiumWord} numberOfLines={1}>{w.word}</Text>
                            <Text style={styles.podiumStats}>{w.count} • {w.pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.podiumNote}>{report.total_comments} comentários totais</Text>
                  </View>
                )}

                <View style={{ marginTop: 18 }}>
                  <Text style={styles.section}>⏱️ RITMO DA CAMPANHA</Text>
                  <View style={styles.paceGrid}>
                    <View style={styles.paceBox}>
                      <Text style={styles.paceValue}>{report.pace.votes_per_day}</Text>
                      <Text style={styles.paceLabel}>VOTOS/DIA</Text>
                    </View>
                    <View style={styles.paceBox}>
                      <Text style={styles.paceValue}>{report.pace.days_remaining}d</Text>
                      <Text style={styles.paceLabel}>RESTAM</Text>
                    </View>
                    <View style={[styles.paceBox, { backgroundColor: report.pace.on_track ? colors.aprovo : colors.desaprovo }]}>
                      <Text style={styles.paceValue}>{report.pace.projected_total}</Text>
                      <Text style={styles.paceLabel}>PROJEÇÃO</Text>
                    </View>
                  </View>
                </View>

                <RegionList title="POR PAÍS" rows={report.by_country} />

                {report.geo_points && report.geo_points.length > 0 && (
                  <View style={{ marginTop: 18 }}>
                    <Text style={styles.section}>🗺️ MAPA DE CALOR — ONDE TE VOTARAM</Text>
                    <HeatMap points={report.geo_points} height={360} />
                  </View>
                )}

                <RegionList title="POR REGIÃO" rows={report.by_region} />
                <RegionList title="POR CIDADE" rows={report.by_city} />

                {report.word_cloud.length > 3 && (
                  <View style={styles.cloudWrap}>
                    <Text style={styles.section}>NUVEM DE PALAVRAS COMPLETA</Text>
                    <View style={styles.cloud}>
                      {report.word_cloud.map((w, i) => {
                        const max = report.word_cloud[0].count;
                        const size = 12 + Math.round((w.count / max) * 22);
                        return (
                          <View key={w.word + i} style={styles.cloudPill}>
                            <Text style={[styles.cloudText, { fontSize: size }]}>{w.word}</Text>
                            <Text style={styles.cloudCount}>{w.count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <TouchableOpacity testID="btn-export-csv" style={styles.exportBtn} onPress={async () => {
                  const token = (await import("@/s../../utils/storage")).storage;
                  const t = await token.secureGet<string>("besord_token", "");
                  const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/business/campaigns/${campaign.campaign_id}/report.csv`;
                  if (Platform.OS === "web" && typeof window !== "undefined") {
                    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
                    const blob = await r.blob();
                    const dl = document.createElement("a");
                    dl.href = URL.createObjectURL(blob);
                    dl.download = `besord_${campaign.campaign_id}.csv`;
                    dl.click();
                  } else {
                    await WebBrowser.openBrowserAsync(url + `?auth=${encodeURIComponent(t || "")}`);
                  }
                }}>
                  <Ionicons name="download" size={20} color={colors.text} />
                  <Text style={styles.exportText}>EXPORTAR CSV</Text>
                </TouchableOpacity>

                <TouchableOpacity testID="btn-export-pdf" style={[styles.exportBtn, { backgroundColor: colors.desaprovo, marginTop: 10 }]} onPress={async () => {
                  const token = (await import("@/s../../utils/storage")).storage;
                  const t = await token.secureGet<string>("besord_token", "");
                  const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/business/campaigns/${campaign.campaign_id}/report.pdf`;
                  if (Platform.OS === "web" && typeof window !== "undefined") {
                    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
                    const blob = await r.blob();
                    const dl = document.createElement("a");
                    dl.href = URL.createObjectURL(blob);
                    dl.download = `besord_${campaign.word}.pdf`;
                    dl.click();
                  } else {
                    await WebBrowser.openBrowserAsync(url + `?auth=${encodeURIComponent(t || "")}`);
                  }
                }}>
                  <Ionicons name="document-text" size={20} color={colors.textInverse} />
                  <Text style={[styles.exportText, { color: colors.textInverse }]}>RELATÓRIO PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity testID="btn-share-report" style={[styles.exportBtn, { backgroundColor: colors.neutral, marginTop: 10 }]} onPress={async () => {
                  try {
                    const r = await apiFetch(`/api/business/campaigns/${campaign.campaign_id}/share`, {
                      method: "POST",
                      body: JSON.stringify({ expires_days: 30 }),
                    });
                    if (r.ok) {
                      const data = await r.json();
                      const origin = typeof window !== "undefined" && (window as any).location
                        ? (window as any).location.origin
                        : "https://besord.eu";
                      const shareUrl = `${origin}/api/r/${data.token}`;
                      if (Platform.OS === "web" && typeof navigator !== "undefined") {
                        await (navigator as any).clipboard?.writeText(shareUrl);
                        (window as any).alert?.(`Link copiado!\n\n${shareUrl}\n\nVálido 30 dias.`);
                      } else {
                        const { Share } = await import("react-native");
                        await Share.share({ message: `Vê este relatório Besord: ${shareUrl}`, url: shareUrl });
                      }
                    }
                  } catch (e) { console.error(e); }
                }}>
                  <Ionicons name="link" size={20} color={colors.text} />
                  <Text style={styles.exportText}>PARTILHAR LINK (30D)</Text>
                </TouchableOpacity>
              </>
            )}

            {report && report.total_votes === 0 && (
              <Text style={styles.empty}>Aguardando votos... compartilhe a campanha!</Text>
            )}
          </>
        )}

        {/* Danger zone — advertiser cancellation (NO REFUND). Hidden if already cancelled. */}
        {campaign.status !== "canceled" && (
          <View style={styles.dangerZone} testID="danger-zone">
            <View style={styles.dangerHeader}>
              <Ionicons name="warning" size={16} color={colors.text} />
              <Text style={styles.dangerTitle}>ZONA DE PERIGO</Text>
            </View>
            <Text style={styles.dangerSub}>
              Pode eliminar esta campanha a qualquer momento. A acção é{" "}
              <Text style={{ fontWeight: "900" }}>irreversível</Text> e{" "}
              <Text style={{ fontWeight: "900" }}>não dá direito a reembolso</Text>.
            </Text>
            <TouchableOpacity
              testID="btn-cancel-campaign"
              style={styles.cancelCampaignBtn}
              onPress={() => setCancelModalOpen(true)}
            >
              <Ionicons name="trash" size={18} color={colors.text} />
              <Text style={styles.cancelCampaignText}>ELIMINAR CAMPANHA</Text>
            </TouchableOpacity>
          </View>
        )}

        {campaign.status === "canceled" && (
          <View style={[styles.dangerZone, { backgroundColor: colors.bgSubtle, borderStyle: "solid" }]}>
            <Ionicons name="close-circle" size={18} color={colors.text} />
            <Text style={[styles.dangerTitle, { marginLeft: 6 }]}>CAMPANHA ELIMINADA</Text>
          </View>
        )}
      </ScrollView>

      {/* Cancellation confirmation modal */}
      <Modal
        visible={cancelModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCancelModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="modal-cancel-campaign">
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={28} color={colors.text} />
            </View>
            <Text style={styles.modalTitle}>ELIMINAR CAMPANHA?</Text>
            <Text style={styles.modalBody}>
              Esta ação é <Text style={{ fontWeight: "900" }}>IRREVERSÍVEL</Text>.
              {"\n"}A campanha #{campaign.word} será imediatamente removida do feed.
              {"\n"}
              {"\n"}
              <Text style={{ fontWeight: "900" }}>NÃO HAVERÁ REEMBOLSO</Text> do valor pago
              (€{(campaign.amount_cents / 100).toFixed(2)}).
            </Text>

            <Text style={styles.modalLabel}>
              Para confirmar, escreve <Text style={{ fontWeight: "900" }}>ELIMINAR</Text> abaixo:
            </Text>
            <TextInput
              testID="input-cancel-confirm"
              style={styles.modalInput}
              value={cancelConfirmText}
              onChangeText={setCancelConfirmText}
              placeholder="ELIMINAR"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="btn-cancel-modal-close"
                style={[styles.modalBtn, { backgroundColor: colors.bg }]}
                onPress={() => { setCancelModalOpen(false); setCancelConfirmText(""); }}
                disabled={cancelling}
              >
                <Text style={styles.modalBtnText}>VOLTAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-cancel-modal-confirm"
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.desaprovo },
                  (cancelConfirmText.trim().toUpperCase() !== "ELIMINAR" || cancelling) && styles.modalBtnDisabled,
                ]}
                onPress={doCancel}
                disabled={cancelConfirmText.trim().toUpperCase() !== "ELIMINAR" || cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.modalBtnText}>SIM, ELIMINAR</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ value, label, bg }: { value: number; label: string; bg: string }) {
  return (
    <View style={[styles.statBox, { backgroundColor: bg }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RegionList({ title, rows }: { title: string; rows: RegionRow[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.regionList}>
        {rows.slice(0, 10).map((r, i) => (
          <View key={r.label + i} style={styles.regionRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.regionLabel} numberOfLines={1}>{r.label}</Text>
              <View style={styles.regionBar}>
                <View style={[styles.regionBarFill, { width: `${r.aprovo_pct}%` }]} />
              </View>
            </View>
            <Text style={styles.regionStats}>{r.aprovo_pct}% • {r.total}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border, gap: 8 },
  backBtn: { width: 36, height: 36, borderWidth: 3, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "900", letterSpacing: -0.5, color: colors.text, textAlign: "center" },
  statusBadge: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 4 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8, color: colors.text },
  content: { padding: 20, paddingBottom: 60 },

  heroCard: { borderWidth: 4, borderColor: colors.border, backgroundColor: colors.bg, ...brutalShadow },
  heroImage: { width: "100%", aspectRatio: 4 / 5 },
  heroFooter: { padding: 12, borderTopWidth: 3, borderTopColor: colors.border, gap: 4 },
  heroWord: { fontSize: 28, fontWeight: "900", letterSpacing: -1, color: colors.text },
  heroMeta: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, letterSpacing: 1 },
  geoTargetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  geoTargetText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text },

  payBtn: { marginTop: 18, height: 64, backgroundColor: colors.aprovo, borderWidth: 4, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, ...brutalShadow },
  payText: { fontSize: 18, fontWeight: "900", letterSpacing: 2, color: colors.text },
  checkBtn: { marginTop: 10, height: 48, borderWidth: 3, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.bg },
  checkText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.text },

  section: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text, marginBottom: 10, marginTop: 18 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, borderWidth: 3, borderColor: colors.border, paddingVertical: 14, alignItems: "center", ...brutalShadow },
  statValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 2 },

  progressWrap: { marginTop: 14, gap: 6 },
  progressLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.text },
  progressBar: { height: 14, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.bgSubtle },
  progressFill: { height: "100%", backgroundColor: colors.aprovo },

  verdictWrap: { marginTop: 18, gap: 6 },
  verdictLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 2, color: colors.text },
  verdictBig: { fontSize: 36, fontWeight: "900", letterSpacing: -1, color: colors.text },
  voteBar: { height: 18, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.desaprovo, overflow: "hidden" },
  voteBarFill: { height: "100%", backgroundColor: colors.aprovo },

  regionList: { gap: 10 },
  regionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  regionLabel: { fontSize: 13, fontWeight: "900", color: colors.text, letterSpacing: 0.5 },
  regionBar: { height: 8, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.desaprovo, marginTop: 4, overflow: "hidden" },
  regionBarFill: { height: "100%", backgroundColor: colors.aprovo },
  regionStats: { fontSize: 11, fontWeight: "900", color: colors.text, minWidth: 80, textAlign: "right" },

  cloudWrap: { marginTop: 8 },
  cloud: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cloudPill: { borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.bg, flexDirection: "row", alignItems: "baseline", gap: 6 },
  cloudText: { fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  cloudCount: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  empty: { textAlign: "center", marginTop: 30, fontSize: 14, fontWeight: "700", color: colors.textSecondary },

  summaryCard: { flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 4, borderColor: colors.border, backgroundColor: colors.neutral, padding: 14, marginTop: 18, ...brutalShadow },
  summaryText: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.text, lineHeight: 19 },

  podium: { flexDirection: "row", gap: 8, marginTop: 4 },
  podiumItem: { flex: 1, borderWidth: 3, borderColor: colors.border, padding: 10, alignItems: "center", ...brutalShadow },
  podiumRank: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.text },
  podiumWord: { fontSize: 16, fontWeight: "900", letterSpacing: -0.5, color: colors.text, marginTop: 4 },
  podiumStats: { fontSize: 10, fontWeight: "800", color: colors.text, marginTop: 4 },
  podiumNote: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, marginTop: 6, textAlign: "center" },

  paceGrid: { flexDirection: "row", gap: 8 },
  paceBox: { flex: 1, borderWidth: 3, borderColor: colors.border, padding: 12, alignItems: "center", backgroundColor: colors.bg, ...brutalShadow },
  paceValue: { fontSize: 22, fontWeight: "900", color: colors.text },
  paceLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginTop: 2 },

  exportBtn: { marginTop: 24, height: 56, borderWidth: 4, borderColor: colors.border, backgroundColor: colors.text, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, ...brutalShadow },
  exportText: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.textInverse },

  // Danger zone
  dangerZone: {
    marginTop: 32,
    borderWidth: 4,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: 16,
    gap: 10,
    backgroundColor: "#FFF7F7",
  },
  dangerHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  dangerTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 2, color: colors.text },
  dangerSub: { fontSize: 13, lineHeight: 19, fontWeight: "600", color: colors.text },
  cancelCampaignBtn: {
    height: 52,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.desaprovo,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...brutalShadow,
  },
  cancelCampaignText: { fontSize: 14, fontWeight: "900", letterSpacing: 2, color: colors.text },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    padding: 22,
    gap: 12,
    ...brutalShadow,
  },
  modalIconWrap: {
    alignSelf: "flex-start",
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    padding: 8,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  modalBody: { fontSize: 14, fontWeight: "600", lineHeight: 20, color: colors.text },
  modalLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: colors.text, marginTop: 4 },
  modalInput: {
    borderWidth: 3,
    borderColor: colors.border,
    height: 52,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  modalBtn: {
    flex: 1,
    height: 52,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...brutalShadow,
  },
  modalBtnText: { fontSize: 13, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
  modalBtnDisabled: { opacity: 0.4 },
});
