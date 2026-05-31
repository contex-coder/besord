import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { storage } from "@/src/utils/storage";
import { onboardingState } from "@/src/utils/onboardingState";
import { colors, brutalShadow } from "@/src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const BEETLE = "https://customer-assets.emergentagent.com/job_image-feedback-app/artifacts/k8o964dp_image_e8c30e18-dee9-4061-a6d7-7a53ae2d2b32.png";

const SLIDES = [
  {
    icon: "image" as const,
    title: "UMA IMAGEM,\nUMA PALAVRA",
    sub: "Publica uma foto e descreve com APENAS uma palavra. Simples. Brutalmente honesto.",
    color: colors.neutral,
  },
  {
    icon: "thumbs-up" as const,
    title: "APROVO\nOU DESAPROVO?",
    sub: "Vota nas imagens dos outros. Vê o veredito coletivo em tempo real. Clica numa palavra para descobrir tudo com essa hashtag.",
    color: colors.aprovo,
  },
  {
    icon: "rocket" as const,
    title: "PROMOVE\nA TUA MARCA",
    sub: "Empresas: testem nomes, embalagens, ideias com pessoas reais. Recebem relatório por país, região e cidade.",
    color: colors.desaprovo,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    // Set both storage AND in-memory state synchronously, so the navigator
    // guard in _layout doesn't bounce us back here on the next render.
    onboardingState.set(true);
    try {
      await storage.setItem("besord_onboarded", "1");
    } catch {}
    router.replace("/(tabs)/feed");
  };

  const next = () => {
    if (idx < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
    } else {
      finish();
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== idx) setIdx(i);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.skipRow}>
        <Image source={{ uri: BEETLE }} style={styles.miniBeetle} resizeMode="contain" />
        <Text style={styles.brand}>BESORD</Text>
        <TouchableOpacity testID="btn-skip" onPress={finish}>
          <Text style={styles.skip}>SALTAR</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_W }]}>
            <View style={[styles.iconWrap, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={64} color={colors.text} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity testID="btn-next" style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.nextText}>{idx === SLIDES.length - 1 ? "COMEÇAR" : "PRÓXIMO"}</Text>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  skipRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 4, borderBottomColor: colors.border },
  miniBeetle: { width: 32, height: 32 },
  brand: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5, color: colors.text },
  skip: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: colors.textSecondary },

  slide: { flex: 1, paddingHorizontal: 30, paddingTop: 40, alignItems: "flex-start", gap: 24 },
  iconWrap: { width: 130, height: 130, borderWidth: 4, borderColor: colors.border, alignItems: "center", justifyContent: "center", ...brutalShadow },
  title: { fontSize: 44, fontWeight: "900", letterSpacing: -2, color: colors.text, lineHeight: 46 },
  sub: { fontSize: 16, fontWeight: "700", color: colors.textSecondary, lineHeight: 22 },

  footer: { paddingHorizontal: 20, paddingBottom: 20, gap: 20 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 10, height: 10, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bg },
  dotActive: { backgroundColor: colors.text },
  nextBtn: { height: 64, backgroundColor: colors.text, borderWidth: 4, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, ...brutalShadow },
  nextText: { fontSize: 16, fontWeight: "900", letterSpacing: 2, color: colors.textInverse },
});
