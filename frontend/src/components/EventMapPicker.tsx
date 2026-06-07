import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, brutalShadow } from "@/src/theme";

type Props = {
  onLocationChange: (loc: {
    lat: number;
    lon: number;
    address: string;
    city: string;
    countryCode: string;
  }) => void;
  initialAddress?: string;
};

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address: { city?: string; town?: string; country_code?: string };
};

export default function EventMapPicker({ onLocationChange, initialAddress }: Props) {
  const [query, setQuery] = useState(initialAddress || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<any>(null);

  const searchNominatim = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`
      );
      if (r.ok) {
        const data: Suggestion[] = await r.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch {} finally {
      setSearching(false);
    }
  }, []);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNominatim(text), 400);
  }, [searchNominatim]);

  const selectSuggestion = useCallback((s: Suggestion) => {
    setSelected(s);
    setQuery(s.display_name.split(",")[0]);
    setShowSuggestions(false);
    const city = s.address?.city || s.address?.town || "";
    onLocationChange({
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon),
      address: s.display_name,
      city,
      countryCode: (s.address?.country_code || "").toUpperCase(),
    });
  }, [onLocationChange]);

  const openInMaps = () => {
    if (!selected) return;
    const url = Platform.OS === "ios"
      ? `https://maps.apple.com/?q=${selected.lat},${selected.lon}`
      : `https://www.google.com/maps?q=${selected.lat},${selected.lon}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Input de pesquisa com ícone */}
      <View style={styles.inputRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Escreve o local do evento..."
          placeholderTextColor="#A1A1AA"
          value={query}
          onChangeText={onChangeText}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {searching && <ActivityIndicator size="small" color={colors.text} style={styles.inputIcon} />}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={() => { setQuery(""); setSelected(null); setSuggestions([]); }}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sugestões com animação */}
      {showSuggestions && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestion}
              onPress={() => selectSuggestion(s)}
            >
              <Ionicons name="location" size={14} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.suggText} numberOfLines={2}>
                  {s.display_name}
                </Text>
                <Text style={styles.suggMeta}>
                  {parseFloat(s.lat).toFixed(4)}, {parseFloat(s.lon).toFixed(4)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Mapa estático */}
      {selected && (
        <TouchableOpacity style={styles.mapPreview} onPress={openInMaps} activeOpacity={0.85}>
          {Platform.OS === "web" ? (
            <iframe
              title="Localização"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(selected.lon) - 0.01},${parseFloat(selected.lat) - 0.01},${parseFloat(selected.lon) + 0.01},${parseFloat(selected.lat) + 0.01}&layer=mapnik&marker=${selected.lat},${selected.lon}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              scrolling="no"
            />
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map" size={32} color={colors.text} />
              <Text style={styles.mapFallbackText}>
                {parseFloat(selected.lat).toFixed(4)}, {parseFloat(selected.lon).toFixed(4)}
              </Text>
              <Text style={styles.mapHint}>TOCA PARA ABRIR NO MAPAS</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {!selected && (
        <View style={styles.mapEmpty}>
          <Ionicons name="map-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.mapEmptyText}>PESQUISA UM LOCAL ACIMA</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    height: 50,
    paddingHorizontal: 12,
    gap: 8,
    ...brutalShadow,
  },
  inputIcon: {},
  input: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text, height: "100%" },
  suggestionsBox: {
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggText: { fontSize: 13, fontWeight: "700", color: colors.text, flex: 1 },
  suggMeta: { fontSize: 10, fontWeight: "600", color: colors.textSecondary, marginTop: 2 },
  mapPreview: {
    width: "100%",
    height: 180,
    borderWidth: 3,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.bgSubtle,
    ...brutalShadow,
  },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.bgSubtle,
  },
  mapFallbackText: { fontSize: 14, fontWeight: "900", color: colors.text },
  mapHint: { fontSize: 9, fontWeight: "900", color: colors.textSecondary, letterSpacing: 1 },
  mapEmpty: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    ...brutalShadow,
  },
  mapEmptyText: { fontSize: 10, fontWeight: "900", color: colors.textSecondary, letterSpacing: 1.5 },
});
