import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors } from "@/src/theme";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL ?? "https://besord-backend.onrender.com";

interface InviteInfo {
  valid: boolean;
  invited_by_name: string;
  invited_by_avatar: string | null;
  next_founder_number: number;
  remaining_spots: number;
}

export default function FounderInvitePage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch(`${BACKEND}/api/founders/validate/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.detail) {
          setError(data.detail === "Código já utilizado" ? "Este convite já foi utilizado." : "Código inválido.");
        } else {
          setInfo(data);
        }
      })
      .catch(() => setError("Não foi possível verificar o convite."))
      .finally(() => setLoading(false));
  }, [code]);

  const handleRedeem = async () => {
    if (!token) {
      router.push("/onboarding");
      return;
    }
    setRedeeming(true);
    try {
      const r = await fetch(`${BACKEND}/api/founders/redeem/${code}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.ok) {
        setRedeemed(true);
      } else {
        setError(data.detail ?? "Erro ao activar convite.");
      }
    } catch {
      setError("Erro de rede.");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#000" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>BESORD</Text>
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace("/")}>
            <Text style={styles.btnText}>VOLTAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (redeemed) {
    const num = info?.next_founder_number ?? "?";
    return (
      <View style={styles.container}>
        <Text style={styles.title}>BESORD</Text>
        <View style={styles.card}>
          <Text style={styles.founderBadge}>FUNDADOR #{num}</Text>
          <Text style={styles.subtitle}>
            O teu lugar na história está garantido.{"\n"}Este badge é permanente.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace("/(tabs)/feed")}>
            <Text style={styles.btnText}>ENTRAR →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BESORD</Text>

      <View style={styles.card}>
        <Text style={styles.inviteLabel}>CONVITE PESSOAL</Text>
        <Text style={styles.inviterText}>
          {info?.invited_by_name ?? "Besord"} convidou-te.
        </Text>

        <Text style={styles.founderBadge}>
          FUNDADOR #{info?.next_founder_number ?? "?"}
        </Text>

        <Text style={styles.spotsText}>
          {info?.remaining_spots ?? 0} lugar{(info?.remaining_spots ?? 0) !== 1 ? "es" : ""} restante{(info?.remaining_spots ?? 0) !== 1 ? "s" : ""} de 100
        </Text>

        <Text style={styles.description}>
          A única app que te dá 10 votos por dia — e depois fecha.{"\n"}
          Não é para toda a gente.
        </Text>

        {user ? (
          <TouchableOpacity
            style={[styles.btn, redeeming && styles.btnDisabled]}
            onPress={handleRedeem}
            disabled={redeeming}
          >
            {redeeming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>ACTIVAR CONVITE →</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.push(`/onboarding?founder_code=${code}`)}
          >
            <Text style={styles.btnText}>CRIAR CONTA E ENTRAR →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 6,
    color: colors.petrol,
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    borderWidth: 3,
    borderColor: "#000",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0.5,
    elevation: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    gap: 16,
  },
  inviteLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    color: "#666",
  },
  inviterText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
  },
  founderBadge: {
    fontSize: 28,
    fontWeight: "900",
    color: "#000",
    textAlign: "center",
    letterSpacing: 2,
    borderWidth: 3,
    borderColor: "#000",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  spotsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    letterSpacing: 1,
  },
  description: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    backgroundColor: "#000",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 3,
    borderColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0.5,
    elevation: 6,
    width: "100%",
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 2 },
  errorText: { fontSize: 16, color: "#c00", textAlign: "center", fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#333", textAlign: "center", lineHeight: 22 },
});
