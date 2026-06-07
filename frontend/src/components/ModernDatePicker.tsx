import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, brutalShadow } from "@/src/theme";

type Props = {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (iso: string) => void;
};

const MONTHS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const DAY_NAMES = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export default function ModernDatePicker({ value, onChange }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selected = value ? new Date(value + "T12:00:00") : null;

  const selectDay = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${year}-${m}-${d}`);
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const isToday = (d: number) => {
    return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (d: number) => {
    if (!selected) return false;
    return d === selected.getDate() && month === selected.getMonth() && year === selected.getFullYear();
  };

  const isPast = (d: number) => {
    const date = new Date(year, month, d);
    return date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };

  return (
    <View style={styles.container}>
      {/* Header mês/ano */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Nomes dos dias */}
      <View style={styles.weekRow}>
        {DAY_NAMES.map((n, i) => (
          <View key={i} style={styles.weekCell}>
            <Text style={styles.weekText}>{n}</Text>
          </View>
        ))}
      </View>

      {/* Grid de dias */}
      <View style={styles.grid}>
        {days.map((d, i) => (
          <View key={i} style={styles.dayCell}>
            {d !== null ? (
              <TouchableOpacity
                style={[
                  styles.dayBtn,
                  isSelected(d) && styles.daySelected,
                  isToday(d) && !isSelected(d) && styles.dayToday,
                  isPast(d) && styles.dayPast,
                ]}
                onPress={() => !isPast(d) && selectDay(d)}
                disabled={isPast(d)}
              >
                <Text style={[
                  styles.dayText,
                  isSelected(d) && styles.dayTextSelected,
                  isPast(d) && styles.dayTextPast,
                ]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.dayEmpty} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: 8,
    ...brutalShadow,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  monthTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1, color: colors.text },
  weekRow: { flexDirection: "row", marginTop: 6 },
  weekCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  weekText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, color: colors.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.28%", aspectRatio: 1, padding: 2 },
  dayBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 0,
  },
  daySelected: { backgroundColor: colors.text, borderColor: colors.text },
  dayToday: { borderColor: colors.border },
  dayPast: { opacity: 0.3 },
  dayEmpty: { flex: 1 },
  dayText: { fontSize: 14, fontWeight: "800", color: colors.text },
  dayTextSelected: { color: colors.textInverse },
  dayTextPast: { color: colors.textSecondary },
});
