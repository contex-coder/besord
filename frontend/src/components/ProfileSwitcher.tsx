import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, brutalShadow } from "@/src/theme";

type Workspace = {
  workspace_id: string;
  type: "personal" | "business";
  name: string;
  picture?: string | null;
  tax_id?: string | null;
  verified?: boolean;
  is_default?: boolean;
};

type Props = {
  /** Lista de workspaces disponíveis */
  workspaces: Workspace[];
  /** ID do workspace ativo */
  activeId: string | null;
  /** Chamado quando seleciona um workspace */
  onSwitch: (workspaceId: string) => void;
  /** Força atualização */
  onRefresh?: () => void;
};

export default function ProfileSwitcher({ workspaces, activeId, onSwitch, onRefresh }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const active = workspaces.find((w) => w.workspace_id === activeId);
  const personal = workspaces.find((w) => w.type === "personal");
  const businesses = workspaces.filter((w) => w.type === "business");

  const handleSelect = (wsId: string) => {
    setOpen(false);
    if (wsId !== activeId) {
      onSwitch(wsId);
    }
  };

  return (
    <>
      {/* ─── Botão do Perfil Ativo ─── */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(!open)}
        activeOpacity={0.85}
        testID="profile-switcher-trigger"
      >
        <View style={styles.triggerLeft}>
          {active?.type === "business" ? (
            <View style={styles.bizIcon}>
              <Ionicons name="business" size={14} color={colors.text} />
            </View>
          ) : user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {(active?.name || user?.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.triggerName} numberOfLines={1}>
            {active?.name || user?.name || "Perfil"}
          </Text>
          {active?.type === "business" && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🏢</Text>
            </View>
          )}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* ─── Modal/Dropdown ─── */}
      {open && (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          >
            <View style={styles.dropdown}>
              {/* ─── Pessoal ─── */}
              <Text style={styles.sectionLabel}>👤 PESSOAL</Text>
              {personal && (
                <TouchableOpacity
                  style={[styles.option, personal.workspace_id === activeId && styles.optionActive]}
                  onPress={() => handleSelect(personal.workspace_id)}
                  testID="switcher-personal"
                >
                  {user?.picture ? (
                    <Image source={{ uri: user.picture }} style={styles.optionAvatar} />
                  ) : (
                    <View style={styles.optionAvatarFallback}>
                      <Text style={styles.optionAvatarText}>
                        {personal.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{personal.name}</Text>
                    <Text style={styles.optionMeta}>Conta pessoal · BW</Text>
                  </View>
                  {personal.workspace_id === activeId && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.aprovo} />
                  )}
                </TouchableOpacity>
              )}

              {/* ─── Empresas ─── */}
              {businesses.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>🏢 EMPRESAS</Text>
                  {businesses.map((biz) => (
                    <TouchableOpacity
                      key={biz.workspace_id}
                      style={[styles.option, biz.workspace_id === activeId && styles.optionActive]}
                      onPress={() => handleSelect(biz.workspace_id)}
                      testID={`switcher-biz-${biz.workspace_id}`}
                    >
                      <View style={styles.bizIconSmall}>
                        <Ionicons name="business" size={16} color={colors.text} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optionName}>{biz.name}</Text>
                        <Text style={styles.optionMeta}>
                          {biz.verified ? "✓ Verificada" : "⚠ Pendente"} · Stripe
                        </Text>
                      </View>
                      {biz.workspace_id === activeId && (
                        <Ionicons name="checkmark-circle" size={18} color={colors.aprovo} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* ─── Separador + Ações ─── */}
              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setOpen(false);
                  router.push("/workspaces?new=1");
                }}
              >
                <Ionicons name="add-circle" size={18} color={colors.text} />
                <Text style={styles.actionText}>NOVA EMPRESA</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setOpen(false);
                  if (active?.type === "business") {
                    router.push("/business/dashboard");
                  } else {
                    router.push("/workspaces");
                  }
                }}
              >
                <Ionicons name="settings-outline" size={18} color={colors.text} />
                <Text style={styles.actionText}>GERIR EMPRESAS</Text>
              </TouchableOpacity>

              {active?.type === "business" && onRefresh && (
                <TouchableOpacity style={styles.actionRow} onPress={() => { setOpen(false); onRefresh(); }}>
                  <Ionicons name="refresh" size={18} color={colors.text} />
                  <Text style={styles.actionText}>ATUALIZAR</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // ─── Trigger ───
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    maxWidth: 200,
    ...brutalShadow,
  },
  triggerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  avatar: { width: 24, height: 24, borderWidth: 2, borderColor: colors.border },
  avatarFallback: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral,
  },
  avatarText: { fontSize: 11, fontWeight: "900", color: colors.text },
  bizIcon: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.aprovo,
  },
  triggerName: { fontSize: 12, fontWeight: "900", color: colors.text, maxWidth: 100 },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
  },
  badgeText: { fontSize: 9 },

  // ─── Overlay ───
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "web" ? 70 : 120,
    paddingHorizontal: 16,
  },
  dropdown: {
    backgroundColor: colors.bg,
    borderWidth: 4,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
    ...brutalShadow,
    maxHeight: 500,
  },

  // ─── Sections ───
  sectionLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary, marginBottom: 4 },

  // ─── Options ───
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionActive: {
    backgroundColor: colors.neutral,
    borderColor: colors.border,
  },
  optionAvatar: { width: 32, height: 32, borderWidth: 2, borderColor: colors.border },
  optionAvatarFallback: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral,
  },
  optionAvatarText: { fontSize: 14, fontWeight: "900", color: colors.text },
  optionName: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  optionMeta: { fontSize: 10, fontWeight: "700", color: colors.textSecondary, marginTop: 1 },
  bizIconSmall: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.aprovo,
  },

  // ─── Divider ───
  divider: { height: 2, backgroundColor: colors.border, marginVertical: 8 },

  // ─── Actions ───
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5, color: colors.text },
});
