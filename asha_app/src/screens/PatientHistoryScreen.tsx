/**
 * src/screens/PatientHistoryScreen.tsx
 *
 * Frontline ASHA Offline Patient Registry.
 * Lists all locally evaluated patients with search and triage summaries.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, PatientRecord } from "../types";
import { TouchButton } from "../components/TouchButton";
import { StorageService } from "../services/storageService";

interface PatientHistoryScreenProps {
  language: Language;
  onBack: () => void;
}

export const PatientHistoryScreen: React.FC<PatientHistoryScreenProps> = ({
  language,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadRecords = async () => {
    try {
      const all = await StorageService.getAllPatientRecords();
      setRecords(all);
    } catch (e) {
      console.error("Failed to load patient records:", e);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const filtered = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.patient.patient_display_name.toLowerCase().includes(q) ||
      r.patient.patient_village.toLowerCase().includes(q) ||
      r.patient.mobile.includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.history_search}
          placeholderTextColor={THEME.colors.textMuted}
        />
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t.history_empty}</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const urgency = item.triage?.urgency || "low";
            return (
              <View key={item.patient.patient_id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.patientName}>
                      {item.patient.patient_display_name}
                    </Text>
                    <Text style={styles.patientMeta}>
                      {item.patient.patient_village} · {item.patient.patient_age_years}{" "}
                      {t.age_years_unit} · {item.patient.mobile}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.urgencyPill,
                      urgency === "emergency"
                        ? styles.urgencyRed
                        : urgency === "high"
                        ? styles.urgencyAmber
                        : styles.urgencyBlue,
                    ]}
                  >
                    <Text style={styles.urgencyPillText}>{urgency.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Symptoms Summary */}
                <Text style={styles.symptomsList} numberOfLines={2}>
                  {t.symptoms_summary_label} {item.symptoms.join(", ")}
                </Text>

                {/* Triage & Sync Status */}
                <View style={styles.footerRow}>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                  <View
                    style={[
                      styles.syncBadge,
                      item.synced ? styles.syncBadgeGreen : styles.syncBadgeAmber,
                    ]}
                  >
                    <Text
                      style={[
                        styles.syncBadgeText,
                        item.synced
                          ? styles.syncBadgeTextGreen
                          : styles.syncBadgeTextAmber,
                      ]}
                    >
                      {item.synced ? t.synced_badge : t.local_only_badge}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchButton title={t.btn_back_to_dashboard} variant="secondary" onPress={onBack} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  searchBar: {
    padding: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  searchInput: {
    height: 44,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: THEME.spacing.md,
    paddingBottom: 80,
  },
  emptyBox: {
    padding: THEME.spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: THEME.colors.textMuted,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  patientMeta: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  urgencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  urgencyRed: {
    backgroundColor: THEME.colors.emergencyBorder,
  },
  urgencyAmber: {
    backgroundColor: THEME.colors.highBorder,
  },
  urgencyBlue: {
    backgroundColor: THEME.colors.primary,
  },
  urgencyPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  symptomsList: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceSubtle,
    paddingTop: 6,
  },
  dateText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  syncBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeGreen: {
    backgroundColor: THEME.colors.lowBg,
  },
  syncBadgeAmber: {
    backgroundColor: THEME.colors.highBg,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  syncBadgeTextGreen: {
    color: THEME.colors.lowText,
  },
  syncBadgeTextAmber: {
    color: THEME.colors.highText,
  },
  bottomBar: {
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
});
