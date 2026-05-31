import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

import { colors, brutalShadow } from "@/src/theme";

export type GeoPoint = {
  lat: number;
  lon: number;
  vote: "aprovo" | "desaprovo";
  city?: string | null;
  country_code?: string | null;
};

type Props = {
  points: GeoPoint[];
  height?: number;
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";

function buildSrcDoc(points: GeoPoint[]): string {
  // Avoid embedding huge payloads in HTML attribute — encode safely.
  const features = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: { weight: p.vote === "aprovo" ? 1 : 0.6, vote: p.vote },
    }));

  const json = JSON.stringify({ type: "FeatureCollection", features });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.7.0/mapbox-gl.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #F5F5F4; }
    #map { position: absolute; inset: 0; }
    .legend { position: absolute; bottom: 8px; left: 8px; background: #FFF; border: 3px solid #0A0A0A;
              padding: 6px 8px; font: 900 10px/1 -apple-system,Segoe UI,sans-serif; letter-spacing: 1px; }
    .legend span { display: inline-block; width: 10px; height: 10px; margin-right: 4px; vertical-align: middle; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div><span style="background:#7CFC8B"></span>APROVO</div>
    <div style="margin-top:3px"><span style="background:#FF5C5C"></span>DESAPROVO</div>
  </div>
  <script>
    (function(){
      var data = ${json};
      mapboxgl.accessToken = ${JSON.stringify(MAPBOX_TOKEN)};
      var map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/light-v11",
        center: [0, 20],
        zoom: 1.2,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", function() {
        if (!data.features.length) return;
        // Fit bounds to data
        try {
          var bounds = new mapboxgl.LngLatBounds();
          data.features.forEach(function(f){ bounds.extend(f.geometry.coordinates); });
          map.fitBounds(bounds, { padding: 40, maxZoom: 7, duration: 0 });
        } catch (e) {}

        map.addSource("votes", { type: "geojson", data: data });

        map.addLayer({
          id: "votes-heat",
          type: "heatmap",
          source: "votes",
          maxzoom: 9,
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.2, "rgba(124,252,139,0.45)",
              0.5, "rgba(255,212,0,0.65)",
              0.8, "rgba(255,92,92,0.8)",
              1, "rgba(180,0,0,0.95)"
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 9, 30],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0.6]
          }
        });

        map.addLayer({
          id: "votes-points",
          type: "circle",
          source: "votes",
          minzoom: 6,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 8],
            "circle-color": ["match", ["get", "vote"], "aprovo", "#7CFC8B", "desaprovo", "#FF5C5C", "#FFD400"],
            "circle-stroke-color": "#0A0A0A",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}

export default function HeatMap({ points, height = 360 }: Props) {
  if (Platform.OS !== "web") {
    return (
      <View style={[styles.fallback, { height }]} testID="heatmap-fallback">
        <Text style={styles.fallbackTitle}>MAPA DISPONÍVEL NO BROWSER</Text>
        <Text style={styles.fallbackSub}>
          O mapa interativo está disponível na versão web do dashboard.
          {"\n"}Consulta abaixo a tabela "POR CIDADE" / "POR PAÍS".
        </Text>
      </View>
    );
  }

  const srcDoc = useMemo(() => buildSrcDoc(points || []), [points]);

  if (!MAPBOX_TOKEN) {
    return (
      <View style={[styles.fallback, { height }]} testID="heatmap-no-token">
        <Text style={styles.fallbackTitle}>MAPA INDISPONÍVEL</Text>
        <Text style={styles.fallbackSub}>Token Mapbox não configurado.</Text>
      </View>
    );
  }

  if (!points || points.length === 0) {
    return (
      <View style={[styles.fallback, { height }]} testID="heatmap-empty">
        <Text style={styles.fallbackTitle}>SEM DADOS GEOGRÁFICOS</Text>
        <Text style={styles.fallbackSub}>
          Aguarda votos com geolocalização disponível para construir o mapa.
        </Text>
      </View>
    );
  }

  // On web, render an iframe so mapbox-gl's CSS/JS stays isolated from Expo's bundle.
  return (
    <View style={[styles.mapWrap, { height }]} testID="heatmap-container">
      {React.createElement("iframe" as any, {
        srcDoc,
        title: "Heatmap",
        style: {
          border: "none",
          width: "100%",
          height: "100%",
          display: "block",
        },
        sandbox: "allow-scripts allow-same-origin",
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    overflow: "hidden",
    ...brutalShadow,
  },
  fallback: {
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
    ...brutalShadow,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.text,
    textAlign: "center",
  },
  fallbackSub: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
});
