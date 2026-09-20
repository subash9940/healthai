/**
 * src/screens/PatientDemographicsScreen.tsx
 *
 * Frontline ASHA Screening — Step 1: Patient Demographics Form.
 * Aligned with locked Track A & Track B schema.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, PatientDemographics, Sex } from "../types";
import { TouchButton } from "../components/TouchButton";

interface DemographicsScreenProps {
  language: Language;
  onContinue: (demographics: PatientDemographics) => void;
  onCancel: () => void;
}

export const PatientDemographicsScreen: React.FC<DemographicsScreenProps> = ({
  language,
  onContinue,
  onCancel,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [phone, setPhone] = useState("");
  const [abhaId, setAbhaId] = useState("");
  const [ageStr, setAgeStr] = useState("");
  const [sex, setSex] = useState<Sex>("female");
  const [isPregnant, setIsPregnant] = useState(false);
  const [isPostpartum, setIsPostpartum] = useState(false);

  // Real-time phone checks
  const cleanPhone = phone.replace(/\D/g, "");
  const isPhoneStartingValid = cleanPhone.length === 0 || /^[6-9]/.test(cleanPhone);
  const isPhoneValid = /^[6-9]\d{9}$/.test(cleanPhone);

  const getPhoneStatus = () => {
    if (cleanPhone.length === 0) return null;
    if (!isPhoneStartingValid) return { type: "error", msg: "Mobile number must start with 6, 7, 8, or 9" };
    if (cleanPhone.length < 10) return { type: "warning", msg: `10 digits required (${10 - cleanPhone.length} digits left)` };
    if (isPhoneValid) return { type: "valid", msg: "✓ Valid 10-digit mobile number" };
    return { type: "error", msg: "Invalid mobile number" };
  };
  const phoneStatus = getPhoneStatus();

  // Real-time name & village checks
  const isNameFormatValid = name.length === 0 || /^[a-zA-Z\sऀ-ॿ஀-௿.'-]+$/.test(name.trim());
  const isNameValid = name.trim().length >= 2 && isNameFormatValid;

  const handleAgePill = (val: number) => {
    setAgeStr(String(val));
  };

  const handleNext = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter patient full name");
      return;
    }
    if (!village.trim()) {
      Alert.alert("Error", "Please enter patient village / town");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      Alert.alert("Error", "Please enter a valid 10-digit Indian mobile number");
      return;
    }
    const ageNum = parseFloat(ageStr);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      Alert.alert("Error", "Please enter a valid age between 0 and 120");
      return;
    }

    const demographics: PatientDemographics = {
      patient_id: "p_" + Date.now().toString(36),
      patient_display_name: name.trim(),
      patient_village: village.trim(),
      mobile: cleanPhone,
      abha_id: abhaId.trim() || null,
      patient_age_years: ageNum,
      patient_sex: sex,
      is_pregnant: sex === "female" ? isPregnant : false,
      is_postpartum: sex === "female" ? isPostpartum : false,
    };

    onContinue(demographics);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t.demo_title}</Text>
        <Text style={styles.subtitle}>{t.demo_subtitle}</Text>
      </View>

      {/* Name */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t.field_patient_name} *</Text>
        <TextInput
          style={[
            styles.input,
            name.length > 0 && !isNameValid ? styles.inputWarning : null,
          ]}
          value={name}
          onChangeText={setName}
          placeholder={t.field_patient_name_placeholder}
          placeholderTextColor={THEME.colors.textMuted}
        />
        {name.length > 0 && !isNameFormatValid ? (
          <Text style={styles.warningText}>⚠️ Name should contain letters only</Text>
        ) : name.length > 0 && name.trim().length < 2 ? (
          <Text style={styles.warningText}>⚠️ Name must be at least 2 characters</Text>
        ) : null}
      </View>

      {/* Village */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t.field_village} *</Text>
        <TextInput
          style={[
            styles.input,
            village.length > 0 && village.trim().length < 2 ? styles.inputWarning : null,
          ]}
          value={village}
          onChangeText={setVillage}
          placeholder={t.field_village_placeholder}
          placeholderTextColor={THEME.colors.textMuted}
        />
        {village.length > 0 && village.trim().length < 2 ? (
          <Text style={styles.warningText}>⚠️ Village name must be at least 2 characters</Text>
        ) : null}
      </View>

      {/* Mobile */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t.field_phone} *</Text>
        <View style={styles.phoneRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              styles.phoneInput,
              phoneStatus?.type === "error"
                ? styles.inputError
                : phoneStatus?.type === "warning"
                ? styles.inputWarning
                : phoneStatus?.type === "valid"
                ? styles.inputValid
                : null,
            ]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t.field_phone_placeholder}
            keyboardType="phone-pad"
            maxLength={10}
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>
        {phoneStatus && (
          <Text
            style={[
              styles.helperText,
              phoneStatus.type === "error"
                ? styles.errorText
                : phoneStatus.type === "warning"
                ? styles.warningText
                : phoneStatus.type === "valid"
                ? styles.validText
                : null,
            ]}
          >
            {phoneStatus.type !== "valid" && "⚠️ "}{phoneStatus.msg}
          </Text>
        )}
      </View>

      {/* ABHA ID */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t.field_abha}</Text>
        <TextInput
          style={styles.input}
          value={abhaId}
          onChangeText={setAbhaId}
          placeholder={t.field_abha_placeholder}
          placeholderTextColor={THEME.colors.textMuted}
        />
      </View>

      {/* Age */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t.field_age}</Text>
        <TextInput
          style={styles.input}
          value={ageStr}
          onChangeText={setAgeStr}
          placeholder={t.field_age_placeholder}
          keyboardType="numeric"
          placeholderTextColor={THEME.colors.textMuted}
        />
        <Text style={styles.helperText}>{t.field_age_hint}</Text>

        {/* Quick Age Selectors */}
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.pillBtn, ageStr === "0.1" && styles.pillBtnActive]}
            onPress={() => handleAgePill(0.1)}
          >
            <Text style={[styles.pillText, ageStr === "0.1" && styles.pillTextActive]}>
              {t.age_infant}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillBtn, ageStr === "3" && styles.pillBtnActive]}
            onPress={() => handleAgePill(3)}
          >
            <Text style={[styles.pillText, ageStr === "3" && styles.pillTextActive]}>
              {t.age_child}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillBtn, ageStr === "28" && styles.pillBtnActive]}
            onPress={() => handleAgePill(28)}
          >
            <Text style={[styles.pillText, ageStr === "28" && styles.pillTextActive]}>
              {t.age_adult}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillBtn, ageStr === "65" && styles.pillBtnActive]}
            onPress={() => handleAgePill(65)}
          >
            <Text style={[styles.pillText, ageStr === "65" && styles.pillTextActive]}>
              {t.age_elderly}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sex */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t.field_sex}</Text>
        <View style={styles.optionRow}>
          {(["female", "male", "other"] as Sex[]).map((s) => {
            const isSelected = sex === s;
            const labelKey = `sex_${s}` as keyof typeof t;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.optionBtn, isSelected && styles.optionBtnActive]}
                onPress={() => setSex(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.optionBtnText, isSelected && styles.optionBtnTextActive]}
                >
                  {t[labelKey] || s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Maternal Flags (if Female) */}
      {sex === "female" && (
        <View style={styles.maternalBox}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t.field_pregnant}</Text>
            <View style={styles.yesNoGroup}>
              <TouchableOpacity
                style={[styles.yesNoBtn, isPregnant && styles.yesNoBtnActive]}
                onPress={() => setIsPregnant(true)}
              >
                <Text style={[styles.yesNoText, isPregnant && styles.yesNoTextActive]}>
                  {t.yes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.yesNoBtn, !isPregnant && styles.yesNoBtnActive]}
                onPress={() => setIsPregnant(false)}
              >
                <Text style={[styles.yesNoText, !isPregnant && styles.yesNoTextActive]}>
                  {t.no}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.toggleRow, { marginTop: 12 }]}>
            <Text style={styles.toggleLabel}>{t.field_postpartum}</Text>
            <View style={styles.yesNoGroup}>
              <TouchableOpacity
                style={[styles.yesNoBtn, isPostpartum && styles.yesNoBtnActive]}
                onPress={() => setIsPostpartum(true)}
              >
                <Text style={[styles.yesNoText, isPostpartum && styles.yesNoTextActive]}>
                  {t.yes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.yesNoBtn, !isPostpartum && styles.yesNoBtnActive]}
                onPress={() => setIsPostpartum(false)}
              >
                <Text style={[styles.yesNoText, !isPostpartum && styles.yesNoTextActive]}>
                  {t.no}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchButton
          title={t.btn_cancel}
          variant="secondary"
          onPress={onCancel}
          style={{ flex: 1 }}
        />
        <TouchButton
          title={t.btn_continue_symptoms}
          onPress={handleNext}
          style={{ flex: 2 }}
        />
      </View>
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
  header: {
    marginBottom: THEME.spacing.md,
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
  formGroup: {
    marginBottom: THEME.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    minHeight: THEME.touchTarget.minHeight,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    fontSize: 16,
    color: THEME.colors.textPrimary,
    fontWeight: "600",
  },
  inputWarning: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  inputError: {
    borderColor: THEME.colors.emergencyBorder,
    backgroundColor: THEME.colors.emergencyBg,
  },
  inputValid: {
    borderColor: "#16A34A",
  },
  warningText: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "700",
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: THEME.colors.emergencyText,
    fontWeight: "700",
    marginTop: 4,
  },
  validText: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "700",
    marginTop: 4,
  },
  phoneRow: {
    flexDirection: "row",
    gap: 8,
  },
  prefixBox: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  prefixText: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  pillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.sm,
  },
  pillBtnActive: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  pillTextActive: {
    color: THEME.colors.primaryDark,
    fontWeight: "800",
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  optionBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  optionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  optionBtnTextActive: {
    color: THEME.colors.textInverse,
  },
  maternalBox: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  yesNoGroup: {
    flexDirection: "row",
    gap: 6,
  },
  yesNoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.sm,
  },
  yesNoBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  yesNoText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  yesNoTextActive: {
    color: "#FFFFFF",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: THEME.spacing.lg,
  },
});
