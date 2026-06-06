import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, brutalShadow } from "@/src/theme";

type Props = {
  /** Coordenada inicial (opcional) */
  initialLat?: number | null;
  initialLon?: number | null;
  /** Chamado quando o utilizador seleciona uma localização */
  onLocationSelect?: (lat: number, lon: number) => void;
  /** Se deve permitir edição (true = criação, false = visualização) */
  editable?: boolean;
  /** Endereço atual */
  address?: string;
};

/**
 * Componente de mapa para eventos.
 * 
 * Web: abre OpenStreetMap num popup/iframe com nominatim para pesquisa.
 * Mobile: abre Google Maps ou OpenStreetMap via Linking.
 * 
 * Para criação de eventos, o utilizador pode:
 * 1. Inserir endereço → pesquisa Nominatim → obtém coordenadas
 * 2. Inserir coordenadas manualmente
 */
export default function EventMap({
  initialLat,
  initialLon,
  onLocationSelect,
  editable = false,
  address: initialAddress,
}: Props) {
  const [lat, setLat] = useState(initialLat?.toString() || "");
  const [lon, setLon] = useState(initialLon?.toString() || "");
  const [searchAddress, setSearchAddress] = useState(initialAddress || "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const hasCoords = lat.trim() && lon.trim();

  const searchNominatim = async () => {
    if (!searchAddress.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const q = encodeURIComponent(searchAddress.trim());
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=PT,ES,FR,GB,DE,IT,US,BR`
      );
      if (r.ok) {
        const data = await r.json();
        if (data.length > 0) {
          const foundLat = parseFloat(data[0].lat);
          const foundLon = parseFloat(data[0].lon);
          setLat(foundLat.toFixed(6));
          setLon(foundLon.toFixed(6));
          setSearchError("");
          if (onLocationSelect) onLocationSelect(foundLat, foundLon);
        } else {
          setSearchError("Localização não encontrada. Tenta ser mais específico.");
        }
      } else {
        setSearchError("Falha na pesquisa. Tenta manualmente.");
      }
    } catch {
      setSearchError("Erro de conexão. Tenta inserir coordenadas manualmente.");
    } finally {
      setSearching(false);
    }
  };

  const openInMaps = () => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return;

    const mapsUrl =
      Platform.OS === "ios"
        ? `https://maps.apple.com/?q=${parsedLat},${parsedLon}`
        : `https://www.google.com/maps?q=${parsedLat},${parsedLon}`;

    Linking.openURL(mapsUrl);
  };

  const openOSM = () => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return;
    Linking.openURL(`https://www.openstreetmap.org/?mlat=${parsedLat}&mlon=${parsedLon}#map=15/${parsedLat}/${parsedLon}`);
  };

  return (
    <View style={styles.container}>
      {/* ─── Mapa Estático (iframe na web, link no mobile) ─── */}
      {hasCoords && (
        <TouchableOpacity style={styles.mapPreview} onPress={openInMaps} activeOpacity={0.85}>
          {Platform.OS === "web" ? (
            <iframe
              title="Mapa do Evento"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lon) - 0.01},${parseFloat(lat) - 0.01},${parseFloat(lon) + 0.01},${parseFloat(lat) + 0.01}&layer=mapnik&marker=${lat},${lon}`}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                borderRadius: 0,
              }}
              scrolling="no"
            />
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map" size={40} color={colors.text} />
              <Text style={styles.mapFallbackText}>
                {parseFloat(lat).toFixed(4)}, {parseFloat(lon).toFixed(4)}
              </Text>
              <Text style={styles.mapFallbackHint}>TOCA PARA ABRIR NO MAPAS</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {!hasCoords && (
        <View style={styles.mapEmpty}>
          <Ionicons name="map-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.mapEmptyText}>NENHUMA LOCALIZAÇÃO DEFINIDA</Text>
        </View>
      )}

      {/* ─── Pesquisa (apenas edição) ─── */}
      {editable && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar local (ex: Av. da Liberdade, Lisboa)"
              placeholderTextColor="#A1A1AA"
              value={searchAddress}
              onChangeText={setSearchAddress}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={searchNominatim}
            />
            <TouchableOpacity
              style={[styles.searchBtn, (!searchAddress || searching) && { opacity: 0.5 }]}
              onPress={searchNominatim}
              disabled={!searchAddress || searching}
            >
              {searching ? (
                <Text style={styles.searchBtnText}>...</Text>
              ) : (
                <Ionicons name="search" size={18} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
          {searchError ? (
            <Text style={styles.searchError}>{searchError}</Text>
          ) : null}

          {/* ─── Coordenadas manuais ─── */}
          <View style={styles.coordsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.coordsLabel}>LATITUDE</Text>
              <TextInput
                style={styles.coordsInput}
                placeholder="38.7223"
                placeholderTextColor="#A1A1AA"
                value={lat}
                onChangeText={(v) => {
                  setLat(v.replace(/[^0-9.\-]/g, ""));
                  if (onLocationSelect && parseFloat(v)) {
                    const l = parseFloat(lon);
                    const p = parseFloat(v);
                    if (Number.isFinite(p) && Number.isFinite(l)) onLocationSelect(p, l);
                  }
                }}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coordsLabel}>LONGITUDE</Text>
              <TextInput
                style={styles.coordsInput}
                placeholder="-9.1393"
                placeholderTextColor="#A1A1AA"
                value={lon}
                onChangeText={(v) => {
                  setLon(v.replace(/[^0-9.\-]/g, ""));
                  if (onLocationSelect && parseFloat(v)) {
                    const l = parseFloat(lat);
                    const p = parseFloat(v);
                    if (Number.isFinite(l) && Number.isFinite(p)) onLocationSelect(l, p);
                  }
                }}
                keyboardType="numeric"
              />
            </View>
          </View>
        </>
      )}

      {/* ─── Ações ─── */}
      {hasCoords && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={openInMaps}>
            <Ionicons name="navigate" size={14} color={colors.text} />
            <Text style={styles.actionText}>MAPAS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={openOSM}>
            <Ionicons name="globe" size={14} color={colors.text} />
            <Text style={styles.actionText}>OPENSTREETMAP</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 12,
    ...brutalShadow,
  },

  // ─── Mapa ───
  mapPreview: {
    width: "100%",
    height: 200,
    borderWidth: 3,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.bgSubtle,
  },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.bgSubtle,
  },
  mapFallbackText: { fontSize: 14, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  mapFallbackHint: { fontSize: 9, fontWeight: "900", color: colors.textSecondary, letterSpacing: 1.5 },

  mapEmpty: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  mapEmptyText: { fontSize: 11, fontWeight: "900", color: colors.textSecondary, letterSpacing: 1.5 },

  // ─── Pesquisa ───
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.bg,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { fontSize: 14, fontWeight: "900", color: colors.text },
  searchError: { fontSize: 10, fontWeight: "700", color: colors.desaprovo, letterSpacing: 0.5 },

  // ─── Coordenadas ───
  coordsRow: { flexDirection: "row", gap: 10 },
  coordsLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: colors.text, marginBottom: 4 },
  coordsInput: {
    borderWidth: 3,
    borderColor: colors.border,
    height: 42,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.bg,
  },

  // ─── Ações ───
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  actionText: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: colors.text },
});
