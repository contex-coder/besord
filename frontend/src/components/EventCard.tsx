import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, brutalShadow } from "@/src/theme";

export type EventItem = {
  event_id: string;
  company_id: string;
  company_name: string;
  title: string;
  description: string;
  image_base64: string;
  location: {
    lat?: number | null;
    lon?: number | null;
    address?: string;
    city?: string;
    country_code?: string;
  };
  date: string;
  prize?: string | null;
  max_participants?: number | null;
  participants_count: number;
  bw_reward: number;
  created_at: string;
  expires_at: string;
  status: string;
  raffle_done: boolean;
  raffle_winner_id?: string | null;
  is_participant: boolean;
  is_owner: boolean;
  event_type: string;
  radius_km: number;
  checkins_count: number;
  exhibitors_count: number;
  distance_km?: number | null;
};

type Props = {
  event: EventItem;
  currentUserId: string | null;
  onCheckin: (eventId: string) => void;
  onPress: (eventId: string) => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).toUpperCase();
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function EventCard({
  event,
  currentUserId,
  onCheckin,
  onPress,
}: Props) {
  const isExpired = event.status === "expired" || event.status === "raffle_done";
  const isFull = event.status === "full";
  const daysLeft = daysUntil(event.expires_at);
  const hasPrize = !!event.prize;
  const isOwner = currentUserId === event.company_id;
  const hasCheckedIn = event.checkins_count > 0; // Placeholder, real checkin status from API

  return (
    <TouchableOpacity
      testID={`event-card-${event.event_id}`}
      style={styles.card}
      onPress={() => onPress(event.event_id)}
      activeOpacity={0.8}
    >
      {/* Badge TOPO */}
      <View style={styles.badgeRow}>
        <View style={styles.eventBadge}>
          <Ionicons name="location" size={14} color={colors.text} />
          <Text style={styles.eventBadgeText}>EVENTO</Text>
        </View>
        {event.event_type === "public" && (
          <View style={[styles.eventBadge, { backgroundColor: colors.aprovo }]}>
            <Text style={styles.eventBadgeText}>PÚBLICO</Text>
          </View>
        )}
        {isExpired && (
          <View style={[styles.eventBadge, { backgroundColor: colors.desaprovo }]}>
            <Text style={styles.eventBadgeText}>EXPIRADO</Text>
          </View>
        )}
        {isFull && (
          <View style={[styles.eventBadge, { backgroundColor: colors.neutral }]}>
            <Text style={styles.eventBadgeText}>LOTAÇÃO ESGOTADA</Text>
          </View>
        )}
        {hasPrize && (
          <View style={[styles.eventBadge, { backgroundColor: colors.neutral }]}>
            <Ionicons name="gift" size={12} color={colors.text} />
            <Text style={styles.eventBadgeText}>PRÉMIO</Text>
          </View>
        )}
      </View>

      {/* Imagem */}
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: event.image_base64 }}
          style={styles.eventImage}
          resizeMode="cover"
        />
        {/* Overlay de data */}
        <View style={styles.dateOverlay}>
          <Text style={styles.dateText}>{formatDate(event.date)}</Text>
          <Text style={styles.timeText}>{formatTime(event.date)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoBlock}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title.toUpperCase()}
        </Text>
        <Text style={styles.companyName} numberOfLines={1}>
          {event.company_name.toUpperCase()}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {event.description}
        </Text>

        {/* Métricas */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Ionicons name="people" size={14} color={colors.textSecondary} />
            <Text style={styles.metricText}>
              {event.checkins_count} CHECK-INS
            </Text>
          </View>
          {event.max_participants && (
            <View style={styles.metric}>
              <Ionicons name="ticket" size={14} color={colors.textSecondary} />
              <Text style={styles.metricText}>
                {event.participants_count}/{event.max_participants}
              </Text>
            </View>
          )}
          {hasPrize && (
            <View style={styles.metric}>
              <Ionicons name="gift" size={14} color={colors.textSecondary} />
              <Text style={styles.metricText}>{event.prize}</Text>
            </View>
          )}
        </View>

        {/* Distância / Dias restantes */}
        <View style={styles.bottomRow}>
          {event.distance_km != null && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={12} color={colors.text} />
              <Text style={styles.distanceText}>
                {event.distance_km < 1
                  ? `${Math.round(event.distance_km * 1000)}m`
                  : `${event.distance_km.toFixed(1)}km`}
              </Text>
            </View>
          )}
          {!isExpired && (
            <Text style={styles.daysLeft}>
              {daysLeft === 0
                ? "HOJE"
                : daysLeft === 1
                ? "AMANHÃ"
                : `${daysLeft} DIAS`}
            </Text>
          )}
        </View>
      </View>

      {/* Botão Check-in / Participar */}
      {!isOwner && !isExpired && (
        <TouchableOpacity
          testID={`btn-checkin-${event.event_id}`}
          style={[
            styles.checkinBtn,
            hasCheckedIn && styles.checkinBtnDone,
          ]}
          onPress={() => onCheckin(event.event_id)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={hasCheckedIn ? "checkmark-circle" : "location"}
            size={18}
            color={colors.text}
          />
          <Text style={styles.checkinBtnText}>
            {hasCheckedIn ? "CHECK-IN FEITO" : "FAZER CHECK-IN"}
          </Text>
          {event.bw_reward > 0 && !hasCheckedIn && (
            <Text style={styles.bwReward}>+{event.bw_reward} BW</Text>
          )}
        </TouchableOpacity>
      )}

      {/* BW Reward */}
      {event.bw_reward > 0 && (
        <View style={styles.bwBadge}>
          <Ionicons name="flame" size={12} color={colors.text} />
          <Text style={styles.bwText}>{event.bw_reward} BW</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...brutalShadow,
    marginBottom: 20,
    overflow: "hidden",
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.text,
  },

  imageWrap: {
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  eventImage: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  dateOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  dateText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: colors.text,
  },
  timeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: 2,
  },

  infoBlock: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    color: colors.text,
  },
  companyName: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  description: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    lineHeight: 18,
  },

  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.text,
  },
  daysLeft: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },

  checkinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
    height: 48,
    backgroundColor: colors.aprovo,
    borderWidth: 3,
    borderColor: colors.border,
    ...brutalShadow,
  },
  checkinBtnDone: {
    backgroundColor: colors.bgSubtle,
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ translateY: 2 }, { translateX: 2 }],
  },
  checkinBtnText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.text,
  },
  bwReward: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.text,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  bwBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bwText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.text,
  },
});
