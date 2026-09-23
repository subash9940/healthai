/**
 * src/screens/SymptomCheckScreen.tsx
 *
 * Frontline ASHA Screening — Step 2: Symptom Checklist.
 * High-contrast danger sign badges, 56dp+ touch cards.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { ASHA_SYMPTOMS } from "../constants/symptoms";
import { Language, PatientDemographics } from "../types";
import { TouchButton } from "../components/TouchButton";

interface SymptomCheckScreenProps {
  language: Language;
  demographics: PatientDemographics;
  onContinue: (symptoms: string[], durationDays?: number | null) => void;
  onBack: () => void;
}

const DURATION_OPTIONS = [
  { days: 0, key: "duration_bucket_0" },
  { days: 2, key: "duration_bucket_2" },
  { days: 4, key: "duration_bucket_4" },
  { days: 6, key: "duration_bucket_6" },
  { days: 10, key: "duration_bucket_10" },
];

export const SymptomCheckScreen: React.FC<SymptomCheckScreenProps> = ({
  language,
  demographics,
  onContinue,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [durationDays, setDurationDays] = useState<number | null>(null);

  // Filter symptoms applicable to patient
  const filteredSymptoms = ASHA_SYMPTOMS.filter((sym) => {
    if (sym.applicableSex === "female" && demographics.patient_sex !== "female") {
      return false;
    }
    if (
      sym.onlyPregnantOrPostpartum &&
      !demographics.is_pregnant &&
      !demographics.is_postpartum
    ) {
      return false;
    }
    if (
      sym.maxAgeYears !== undefined &&
      demographics.patient_age_years >= sym.maxAgeYears
    ) {
      return false;
    }
    return true;
  });

  const toggleSymptom = (id: string) => {
    if (selectedSymptoms.includes(id)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== id));
    } else {
      setSelectedSymptoms([...selectedSymptoms, id]);
    }
  };

  const handleNext = () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert(t.symptoms_empty_alert_title, t.symptoms_empty_alert_msg);
      return;
    }
    onContinue(selectedSymptoms, durationDays);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t.symptom_title}</Text>
          <Text style={styles.subtitle}>
            {demographics.patient_display_name} ({demographics.patient_age_years} {t.age_years_unit},{" "}
            {demographics.patient_village})
          </Text>
        </View>

        {/* Duration Segmented Selector (ICMR Duration Staging) */}
        <View style={styles.durationContainer}>
          <Text style={styles.durationTitle}>⏱️ {t.duration_title || "How long have symptoms been present?"}</Text>
          <View style={styles.durationSegmentRow}>
            {DURATION_OPTIONS.map((opt) => {
              const isSelected = durationDays === opt.days;
              const label = (t as any)[opt.key] || opt.key;
              return (
                <TouchableOpacity
                  key={opt.days}
                  style={[styles.durationSegment, isSelected && styles.durationSegmentSelected]}
                  onPress={() => setDurationDays(isSelected ? null : opt.days)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.durationSegmentText, isSelected && styles.durationSegmentTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected count pill */}
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {t.symptoms_selected_count.replace("{count}", selectedSymptoms.length.toString())}
          </Text>
        </View>

        {/* Symptom Cards */}
        {filteredSymptoms.map((item) => {
          const isSelected = selectedSymptoms.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
              ]}
              onPress={() => toggleSymptom(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.symptomLabel,
                      isSelected && styles.symptomLabelSelected,
                    ]}
                  >
                    {item.labels[language] || item.labels.en || item.labels.mr}
                  </Text>
                </View>
              </View>

              <Text style={styles.symptomDesc}>
                {item.description[language] || item.description.en || item.description.mr}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pinned Bottom Thumb Zone */}
      <View style={styles.bottomBar}>
        <TouchButton
          title={t.btn_back}
          variant="secondary"
          onPress={onBack}
          style={{ flex: 1 }}
        />
        <TouchButton
          title={t.btn_continue_vitals}
          onPress={handleNext}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.md,
    paddingBottom: 100,
  },
  header: {
    marginBottom: THEME.spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: THEME.colors.primary,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  durationContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  durationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  durationSegmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationSegment: {
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  durationSegmentSelected: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  durationSegmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    textAlign: "center",
  },
  durationSegmentTextSelected: {
    color: THEME.colors.primaryDark,
    fontWeight: "800",
  },
  countBadge: {
    alignSelf: "flex-start",
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.md,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.primaryDark,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    minHeight: 60,
  },
  cardSelected: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: THEME.colors.borderStrong,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
  },
  checkboxActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  symptomLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    flexShrink: 1,
  },
  symptomLabelSelected: {
    color: THEME.colors.primaryDark,
  },
  symptomDesc: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginLeft: 32,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    flexDirection: "row",
    gap: 8,
  },
});
