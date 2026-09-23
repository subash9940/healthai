/**
 * src/screens/TriageResultScreen.tsx
 *
 * Frontline ASHA Screening — Step 4: Clinical Triage Output.
 * Displays urgency classification, ASHA instructions, citizen counseling message,
 * and high-priority "Mark In-Transit" ambulance trigger.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import {
  Language,
  PatientDemographics,
  TriageEvaluationResponse,
  Vitals,
  ReferralRecord,
  PatientRecord,
  FacilityAvailabilityItem,
} from "../types";
import { TouchButton } from "../components/TouchButton";
import { StorageService } from "../services/storageService";
import { FacilityService } from "../services/facilityService";

interface TriageResultScreenProps {
  language: Language;
  demographics: PatientDemographics;
  symptoms: string[];
  vitals: Vitals;
  triageResult: TriageEvaluationResponse;
  workerId: string;
  onFinish: () => void;
  onViewReferrals: () => void;
}

export const TriageResultScreen: React.FC<TriageResultScreenProps> = ({
  language,
  demographics,
  symptoms,
  vitals,
  triageResult,
  workerId,
  onFinish,
  onViewReferrals,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [isInTransit, setIsInTransit] = useState(false);
  const [saved, setSaved] = useState(false);
  const [facilities, setFacilities] = useState<FacilityAvailabilityItem[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (triageResult.requires_referral) {
      setIsLoadingFacilities(true);
      FacilityService.getNearbyFacilities(
        triageResult.referral_target_level || undefined,
        demographics.patient_village || undefined
      )
        .then((result) => {
          if (isMounted) {
            setFacilities(result.facilities);
            if (result.facilities.length > 0) {
              // Pre-select the nearest / highest recommended facility by default
              setSelectedFacilityId(result.facilities[0].id);
            }
          }
        })
        .catch((err) => {
          console.warn("Failed to load nearby facilities for referral:", err);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingFacilities(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [triageResult.requires_referral, triageResult.referral_target_level, demographics.patient_village]);

  const urgencyKey = `result_urgency_${triageResult.urgency}` as keyof typeof t;
  const urgencyLabel = t[urgencyKey] || triageResult.urgency.toUpperCase();

  const getUrgencyCardStyle = () => {
    switch (triageResult.urgency) {
      case "emergency":
        return {
          bg: THEME.colors.emergencyBg,
          border: THEME.colors.emergencyBorder,
          text: THEME.colors.emergencyText,
        };
      case "high":
        return {
          bg: THEME.colors.highBg,
          border: THEME.colors.highBorder,
          text: THEME.colors.highText,
        };
      case "medium":
        return {
          bg: THEME.colors.mediumBg,
          border: THEME.colors.mediumBorder,
          text: THEME.colors.mediumText,
        };
      case "low":
      default:
        return {
          bg: THEME.colors.lowBg,
          border: THEME.colors.lowBorder,
          text: THEME.colors.lowText,
        };
    }
  };

  const cardStyle = getUrgencyCardStyle();

  // Save record to local registry
  const saveLocalRecord = async (transitMarked = false) => {
    const record: PatientRecord = {
      patient: demographics,
      symptoms,
      vitals,
      triage: triageResult,
      created_at: new Date().toISOString(),
      synced: false,
      asha_worker_id: workerId,
    };
    await StorageService.savePatientRecord(record);

    // If requires referral, create referral record with single assigned facility
    if (triageResult.requires_referral) {
      const selectedFac = facilities.find((f) => f.id === selectedFacilityId);
      const referral: ReferralRecord = {
        referral_id: "ref_" + Date.now().toString(36),
        patient_id: demographics.patient_id,
        patient_name: demographics.patient_display_name,
        patient_village: demographics.patient_village,
        patient_phone: demographics.mobile,
        patient_age: demographics.patient_age_years,
        patient_sex: demographics.patient_sex,
        urgency: triageResult.urgency,
        target_facility: (selectedFac?.level as any) || triageResult.referral_target_level || "phc",
        facility_id: selectedFac?.id || null,
        facility_name: selectedFac?.name || null,
        status: transitMarked ? "in_transit" : "created",
        status_history: [
          {
            status: "created",
            timestamp: new Date().toISOString(),
            note: `Referral generated via ASHA Field App${selectedFac?.name ? ` -> ${selectedFac.name}` : ""}`,
          },
          ...(transitMarked
            ? [
                {
                  status: "in_transit" as const,
                  timestamp: new Date().toISOString(),
                  note: "Marked In-Transit (Ambulance / Transport Dispatched)",
                },
              ]
            : []),
        ],
        symptoms,
        recommended_action: triageResult.recommended_action,
        created_at: new Date().toISOString(),
        synced: false,
        asha_worker_id: workerId,
      };
      await StorageService.saveReferral(referral);
    }
    setSaved(true);
  };

  const handleMarkInTransit = async () => {
    setIsInTransit(true);
    await saveLocalRecord(true);
    Alert.alert(
      t.in_transit_alert_title,
      t.in_transit_alert_msg,
      [
        {
          text: t.btn_view_referrals,
          onPress: onViewReferrals,
        },
        {
          text: t.btn_done,
          onPress: onFinish,
        },
      ]
    );
  };

  const handleSaveAndDone = async () => {
    if (!saved) {
      await saveLocalRecord(false);
    }
    onFinish();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Patient Summary Header */}
      <View style={styles.patientBadge}>
        <Text style={styles.patientName}>{demographics.patient_display_name}</Text>
        <Text style={styles.patientMeta}>
          {demographics.patient_village} · {demographics.patient_age_years} {t.age_years_unit} ·{" "}
          {demographics.mobile}
        </Text>
      </View>

      {/* Main Urgency Decision Card */}
      <View
        style={[
          styles.urgencyCard,
          { backgroundColor: cardStyle.bg, borderColor: cardStyle.border },
        ]}
      >
        <View style={styles.badgeRow}>
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>{t.result_offline_badge}</Text>
          </View>
          {triageResult.urgency === "emergency" && (
            <View style={styles.dangerBadge}>
              <Text style={styles.dangerBadgeText}>⚠️ {t.symptom_danger_badge || "Danger Sign"}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.urgencyTitle, { color: cardStyle.text }]}>
          {urgencyLabel}
        </Text>
      </View>

      {/* ASHA Action Instructions */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeader}>{t.result_action_header}</Text>
        <Text style={styles.actionText}>{triageResult.recommended_action}</Text>
      </View>

      {/* Citizen Counseling Message */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeader}>{t.result_citizen_header}</Text>
        <Text style={styles.citizenText}>{triageResult.citizen_message}</Text>
      </View>

      {/* Rule Audit Trace */}
      <View style={styles.auditCard}>
        <Text style={styles.auditHeader}>{t.result_rule_trace}</Text>
        <View style={styles.rulePillRow}>
          {triageResult.rule_trace.map((ruleId) => (
            <View key={ruleId} style={styles.rulePill}>
              <Text style={styles.rulePillText}>{ruleId}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Target Facility Selection (Only when referral is required) */}
      {triageResult.requires_referral && (
        <View style={styles.facilitySection}>
          <Text style={styles.facilitySectionTitle}>{t.select_facility_title}</Text>
          <Text style={styles.facilitySectionSubtitle}>{t.select_facility_subtitle}</Text>

          {isLoadingFacilities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={THEME.colors.primary} />
            </View>
          ) : facilities.length === 0 ? (
            <Text style={styles.noFacilitiesText}>{t.facility_no_facilities_found}</Text>
          ) : (
            <View style={styles.facilityList}>
              {facilities.map((fac, idx) => {
                const isSelected = selectedFacilityId === fac.id;
                const isRecommended = idx === 0;
                const statusColor =
                  fac.operational_status === "AVAILABLE"
                    ? "#059669"
                    : fac.operational_status === "BUSY"
                    ? "#D97706"
                    : "#DC2626";

                return (
                  <TouchableOpacity
                    key={fac.id}
                    activeOpacity={0.7}
                    onPress={() => setSelectedFacilityId(fac.id)}
                    style={[
                      styles.facilityCard,
                      isSelected && styles.facilityCardSelected,
                    ]}
                  >
                    <View style={styles.facilityHeaderRow}>
                      <Text style={styles.facilityName}>{fac.name}</Text>
                      <View style={styles.badgeRow}>
                        {isRecommended && (
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedBadgeText}>
                              {t.facility_auto_recommended}
                            </Text>
                          </View>
                        )}
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>
                              ✓ {t.facility_selected_badge}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.facilityMetricsRow}>
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: statusColor + "18", borderColor: statusColor },
                        ]}
                      >
                        <Text style={[styles.statusPillText, { color: statusColor }]}>
                          {fac.operational_status}
                        </Text>
                      </View>

                      <Text style={styles.facilityMetricText}>
                        🛏️ {t.facility_beds_available.replace("{count}", String(fac.available_beds))}
                      </Text>

                      {fac.distance_km !== undefined && fac.distance_km !== null && (
                        <Text style={styles.facilityMetricText}>
                          📍 {t.facility_distance_label.replace("{dist}", String(fac.distance_km))}
                        </Text>
                      )}
                    </View>

                    {fac.status_note ? (
                      <Text style={styles.facilityNoteText} numberOfLines={2}>
                        {fac.status_note}
                      </Text>
                    ) : null}

                    {fac.contact_phone ? (
                      <Text style={styles.facilityPhoneText}>
                        📞 {t.facility_contact_phone.replace("{phone}", fac.contact_phone)}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Referral Action Buttons */}
      {triageResult.requires_referral && !isInTransit && (
        <TouchButton
          title={t.btn_mark_in_transit}
          variant="danger"
          onPress={handleMarkInTransit}
          style={styles.transitCta}
        />
      )}

      <TouchButton
        title={t.btn_save_record}
        variant="primary"
        onPress={handleSaveAndDone}
        style={styles.saveCta}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.md,
    paddingBottom: 40,
  },
  patientBadge: {
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  patientName: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  patientMeta: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  urgencyCard: {
    borderRadius: THEME.borderRadius.md,
    borderWidth: 2,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  offlineBadge: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  dangerBadge: {
    backgroundColor: THEME.colors.emergencyBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dangerBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  urgencyTitle: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.primaryDark,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    lineHeight: 22,
  },
  citizenText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  auditCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
  },
  auditHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  rulePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  rulePill: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rulePillText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    color: THEME.colors.textPrimary,
  },
  facilitySection: {
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  facilitySectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.colors.primaryDark,
    marginBottom: 2,
  },
  facilitySectionSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  noFacilitiesText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  facilityList: {
    gap: 8,
  },
  facilityCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    minHeight: 48,
  },
  facilityCardSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: "#F0FDF4",
  },
  facilityHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  recommendedBadge: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4338CA",
  },
  selectedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  facilityMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  facilityMetricText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  facilityNoteText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  facilityPhoneText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  transitCta: {
    marginBottom: THEME.spacing.sm,
  },
  saveCta: {
    marginTop: THEME.spacing.xs,
  },
});
