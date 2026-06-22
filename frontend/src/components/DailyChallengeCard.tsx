import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Share,
} from "react-native";
import { colors, brutalShadow } from "@/src/theme";
import { useAuth } from "@/src/contexts/AuthContext";

type ChallengeState =
  | { available: false }
  | {
      available: true;
      challenge_id: string;
      date: string;
      image_url: string;
      prompt_theme: string;
      status: "active" | "revealed";
      vote_count: number;
      user_voted_word: string | null;
      top_words?: { word: string; count: number }[];
      analysis?: string;
    };

export default function DailyChallengeCard() {
  const { apiFetch, user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenge = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/daily-challenge");
      const data = await r.json();
      setChallenge(data);
    } catch {
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  const handleVote = async () => {
    const trimmed = word.trim().toUpperCase();
    if (!trimmed || trimmed.length < 2) {
      setError("Escreve pelo menos 2 letras.");
      return;
    }
    setVoting(true);
    setError(null);
    try {
      const r = await apiFetch("/api/daily-challenge/vote", {
        method: "POST",
        body: JSON.stringify({ word: trimmed }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.detail || "Erro ao votar.");
        return;
      }
      setWord("");
      await fetchChallenge();
    } catch {
      setError("Erro de rede.");
    } finally {
      setVoting(false);
    }
  };

  const handleShare = async () => {
    if (!challenge || !challenge.available || challenge.status !== "revealed") return;
    const top = challenge.top_words?.[0]?.word ?? "—";
    try {
      await Share.share({
        message: `🎯 BESORD CHALLENGE — ${challenge.date}\nA palavra mais escolhida: ${top} (${challenge.vote_count} votos)\n\nbesord.vercel.app`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!challenge || !challenge.available) return null;

  const voted = !!challenge.user_voted_word;
  const revealed = challenge.status === "revealed";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>CHALLENGE DO DIA</Text>
        <Text style={styles.voteCount}>{challenge.vote_count} votos</Text>
      </View>

      {/* Imagem */}
      <Image source={{ uri: challenge.image_url }} style={styles.image} resizeMode="cover" />

      {/* Prompt */}
      <Text style={styles.prompt}>{challenge.prompt_theme}</Text>

      {/* Estado: ainda não votou e challenge activo */}
      {!voted && !revealed && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="A TUA PALAVRA"
            placeholderTextColor={colors.textSecondary}
            value={word}
            onChangeText={t => { setWord(t); setError(null); }}
            maxLength={30}
            autoCapitalize="characters"
            returnKeyType="send"
            onSubmitEditing={handleVote}
          />
          <TouchableOpacity
            style={[styles.voteBtn, (!word.trim() || voting) && styles.voteBtnDisabled]}
            onPress={handleVote}
            disabled={!word.trim() || voting}
          >
            {voting
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={styles.voteBtnText}>VOTAR</Text>}
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Estado: já votou, ainda não revelado */}
      {voted && !revealed && (
        <View style={styles.votedBox}>
          <Text style={styles.votedText}>A TUA PALAVRA: {challenge.user_voted_word}</Text>
          <Text style={styles.votedSub}>Resultado revela-se às 20h UTC</Text>
        </View>
      )}

      {/* Estado: revelado */}
      {revealed && (
        <View style={styles.revealBox}>
          {challenge.top_words && challenge.top_words.length > 0 && (
            <>
              <Text style={styles.revealLabel}>TOP PALAVRAS</Text>
              <View style={styles.topWordsRow}>
                {challenge.top_words.slice(0, 3).map((w, i) => (
                  <View key={w.word} style={[styles.topWordChip, i === 0 && styles.topWordFirst]}>
                    <Text style={[styles.topWordText, i === 0 && styles.topWordTextFirst]}>
                      {w.word}
                    </Text>
                    <Text style={[styles.topWordCount, i === 0 && styles.topWordCountFirst]}>
                      {w.count}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {challenge.analysis ? (
            <Text style={styles.analysis}>{challenge.analysis}</Text>
          ) : null}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>PARTILHAR RESULTADO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 4,
    borderColor: colors.border,
    ...brutalShadow,
    backgroundColor: colors.bg,
    marginBottom: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.petrol,
  },
  voteCount: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.border,
  },
  prompt: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
  },
  voteBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 3,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  voteBtnDisabled: {
    opacity: 0.4,
  },
  voteBtnText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.textInverse,
  },
  errorText: {
    fontSize: 11,
    color: colors.desaprovo,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  votedBox: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  votedText: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
  },
  votedSub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  revealBox: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  revealLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  topWordsRow: {
    flexDirection: "row",
    gap: 8,
  },
  topWordChip: {
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    gap: 2,
  },
  topWordFirst: {
    backgroundColor: colors.neutral,
  },
  topWordText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 0.5,
  },
  topWordTextFirst: {
    fontSize: 15,
  },
  topWordCount: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  topWordCountFirst: {
    color: colors.text,
  },
  analysis: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    lineHeight: 19,
    fontStyle: "italic",
    borderLeftWidth: 3,
    borderColor: colors.petrol,
    paddingLeft: 10,
  },
  shareBtn: {
    borderWidth: 3,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.text,
  },
});
