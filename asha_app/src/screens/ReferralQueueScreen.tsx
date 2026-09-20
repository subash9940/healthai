/**
 * src/screens/ReferralQueueScreen.tsx
 *
 * Frontline ASHA Referral Tracking Screen:
 * Read-only view of patient referral statuses managed by facility staff.
 * created -> in_transit -> received_at_facility -> closed
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, ReferralRecord, ReferralStatus } from "../types";
import { TouchButton } from "../components/TouchButton";
import { StorageService } from "../services/storageService";

interface ReferralQueueScreenProps {
  language: Language;
  onBack: () => void;
}

export const ReferralQueueScreen: React.FC<ReferralQueueScreenProps> = ({
  language,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [filter, setFilter] = useState<"all" | ReferralStatus>("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadReferrals = async () => {
    try {
      const all = await StorageService.getAllReferrals();
      setReferrals(all);
    } catch (e) {
      console.error("Failed to load referrals:", e);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferrals();
    setRefreshing(false);
  };

  const filteredList = referrals.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const getStatusBadge = (status: ReferralStatus) => {
    switch (status) {
      case "in_transit":
        return { bg: "#FEF08A", text: "#854D0E", label: t.status_in_transit };
      case "received_at_facility":
        return { bg: "#BAE6FD", text: "#0369A1", label: t.status_received };
      case "closed":
        return { bg: "#BBF7D0", text: "#166534", label: t.status_closed };
      case "created":
      default:
        return { bg: "#FED7AA", text: "#9A3412", label: t.status_created };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {(
            [
              { id: "all", label: t.filter_all },
              { id: "created", label: t.status_created },
              { id: "in_transit", label: t.status_in_transit },
              { id: "received_at_facility", label: t.status_received },
              { id: "closed", label: t.status_closed },
            ] as const
          ).map((tab) => {
            const isActive = filter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setFilter(tab.id as any)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Referral List */}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t.ref_empty}</Text>
          </View>
        ) : (
          filteredList.map((item) => {
            const badge = getStatusBadge(item.status);
            return (
              <View key={item.referral_id} style={styles.card}>
                {/* Header Row */}
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.patientName}>{item.patient_name}</Text>
                    <Text style={styles.patientMeta}>
                      {item.patient_village} · {item.patient_age} {t.age_years_unit} ·{" "}
                      {item.patient_phone}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badge.bg },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Facility & Urgency */}
                <View style={styles.metaRow}>
                  <Text style={styles.targetFacility}>
                    {t.target_facility_label} {item.target_facility.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.urgencyText,
                      item.urgency === "emergency" ? styles.redText : styles.amberText,
                    ]}
                  >
                    {item.urgency.toUpperCase()}
                  </Text>
                </View>

                {/* Action Instructions */}
                <Text style={styles.actionText}>{item.recommended_action}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Back CTA */}
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
  filterBar: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
    marginRight: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterTabActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  targetFacility: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.primary,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: "800",
  },
  redText: {
    color: THEME.colors.emergencyText,
  },
  amberText: {
    color: THEME.colors.highText,
  },
  actionText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 8,
  },
  bottomBar: {
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
});
