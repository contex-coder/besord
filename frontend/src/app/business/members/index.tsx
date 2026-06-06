import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Member = {
  member_id: string;
  workspace_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: "owner" | "admin" | "member";
  status: "invited" | "active" | "declined";
  created_at: string;
};

export default function BusinessMembersScreen() {
  const { apiFetch } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ wsId?: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);

  const wsId = params.wsId || "";

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const r = await apiFetch(`/api/workspaces/${wsId}/members`);
      if (r.ok) {
        const data = await r.json();
        setMembers(data.members || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiFetch, wsId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSubmitting(true);
    const r = await apiFetch(`/api/workspaces/${wsId}/invite`, {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
    });
    setSubmitting(false);
    if (r.ok) {
      setInviteModal(false);
      setInviteEmail("");
      Alert.alert("Convite enviado", `Foi enviado um convite para ${inviteEmail.trim()}`);
      load();
    } else {
      const err = await r.json().catch(() => ({}));
      Alert.alert("Erro", err.detail || "Não foi possível convidar.");
    }
  };

  const handleRemove = (member: Member) => {
    Alert.alert(
      "Remover membro?",
      `${member.user_name} perderá acesso a esta empresa.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover", style: "destructive",
          onPress: async () => {
            const r = await apiFetch(`/api/workspaces/${wsId}/members/${member.member_id}`, {
              method: "DELETE",
            });
            if (r.ok) load();
            else Alert.alert("Erro", "Não foi possível remover.");
          },
        },
      ]
    );
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { owner: "PROPRIETÁRIO", admin: "ADMIN", member: "MEMBRO" };
    return map[role] || role.toUpperCase();
  };

  const statusIcon = (status: string) => {
    if (status === "active") return { name: "checkmark-circle", color: colors.aprovo };
    if (status === "invited") return { name: "time", color: colors.neutral };
    return { name: "close-circle", color: colors.desaprovo };
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MEMBROS</Text>
        <TouchableOpacity onPress={() => setInviteModal(true)} style={styles.addBtn}>
          <Ionicons name="person-add" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.member_id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.text} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.text} /></View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>SEM MEMBROS</Text>
              <Text style={styles.emptySub}>Convida colaboradores para gerir esta empresa.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const s = statusIcon(item.status);
          const isOwner = item.role === "owner";
          return (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.avatar, { backgroundColor: isOwner ? colors.text : colors.neutral }]}>
                  <Text style={styles.avatarText}>{item.user_name.charAt(0).toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.memberName}>{item.user_name.toUpperCase()}</Text>
                <Text style={styles.memberEmail}>{item.user_email}</Text>
                <View style={styles.badgesRow}>
                  <View style={[styles.roleBadge, { backgroundColor: isOwner ? colors.text : colors.neutral }]}>
                    <Text style={styles.roleBadgeText}>{roleLabel(item.role)}</Text>
                  </View>
                  <Ionicons name={s.name as any} size={14} color={s.color} />
                  <Text style={[styles.statusText, { color: s.color }]}>
                    {item.status === "active" ? "ATIVO" : item.status === "invited" ? "CONVITE PENDENTE" : "RECUSADO"}
                  </Text>
                </View>
              </View>
              {!isOwner && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
                  <Ionicons name="trash-outline" size={16} color={colors.desaprovo} />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      <Modal visible={inviteModal} transparent animationType="fade" onRequestClose={() => setInviteModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInviteModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CONVIDAR MEMBRO</Text>
            <Text style={styles.modalSub}>O convidado precisa ter conta Besord.</Text>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="email@exemplo.com"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>FUNÇÃO</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleChip, inviteRole === "member" && styles.roleChipActive]}
                onPress={() => setInviteRole("member")}
              >
                <Text style={[styles.roleChipText, inviteRole === "member" && styles.roleChipTextActive]}>MEMBRO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleChip, inviteRole === "admin" && styles.roleChipActive]}
                onPress={() => setInviteRole("admin")}
              >
                <Text style={[styles.roleChipText, inviteRole === "admin" && styles.roleChipTextActive]}>ADMIN</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { flex: 1 }]} onPress={() => setInviteModal(false)}>
                <Text style={styles.modalBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.text }]}
                onPress={handleInvite}
                disabled={submitting || !inviteEmail.trim()}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.textInverse }]}>CONVIDAR</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text },
  addBtn: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.aprovo,
  },

  listContent: { padding: 16, paddingBottom: 40, gap: 10 },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 12,
    gap: 12,
    ...brutalShadow,
  },
  cardLeft: {},
  avatar: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "900", color: colors.bg, letterSpacing: -0.5 },
  cardBody: { flex: 1, gap: 2 },
  memberName: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.2 },
  memberEmail: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  badgesRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8, color: colors.bg },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  removeBtn: { padding: 8 },

  // Empty
  empty: { paddingTop: 80, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: colors.text },
  emptySub: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "center", paddingHorizontal: 30 },

  // Modal
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
  modalTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  roleRow: { flexDirection: "row", gap: 8 },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  roleChipActive: { backgroundColor: colors.text },
  roleChipText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.textSecondary },
  roleChipTextActive: { color: colors.textInverse },
  modalBtn: {
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  modalBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.text },
});
