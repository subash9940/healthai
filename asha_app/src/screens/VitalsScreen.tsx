/**
 * src/screens/VitalsScreen.tsx
 *
 * Frontline ASHA Screening — Step 3: Physical Vitals.
 * Optional objective metrics with clinical range indicators.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, Vitals } from "../types";
import { TouchButton } from "../components/TouchButton";

interface VitalsScreenProps {
  language: Language;
  onEvaluate: (vitals: Vitals) => void;
  onBack: () => void;
}

export const VitalsScreen: React.FC<VitalsScreenProps> = ({
  language,
  onEvaluate,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [temp, setTemp] = useState("");
  const [pulse, setPulse] = useState("");
  const [sysBp, setSysBp] = useState("");
  const [diaBp, setDiaBp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [rr, setRr] = useState("");

  const handleQuickNormal = () => {
    setTemp("37.0");
    setPulse("76");
    setSysBp("120");
    setDiaBp("80");
    setSpo2("98");
    setRr("18");
  };

  const handleNext = () => {
    let parsedTemp = parseFloat(temp);
    // Auto-convert Fahrenheit to Celsius if > 50
    if (!isNaN(parsedTemp) && parsedTemp > 50) {
      parsedTemp = (parsedTemp - 32) * (5 / 9);
    }

    const vitalsObj: Vitals = {
      temperature_celsius: !isNaN(parsedTemp) ? parsedTemp : null,
      pulse_bpm: pulse ? parseInt(pulse, 10) : null,
      systolic_bp: sysBp ? parseInt(sysBp, 10) : null,
      diastolic_bp: diaBp ? parseInt(diaBp, 10) : null,
      spo2_percent: spo2 ? parseInt(spo2, 10) : null,
      respiratory_rate: rr ? parseInt(rr, 10) : null,
    };

    onEvaluate(vitalsObj);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.vitals_title}</Text>
          <Text style={styles.subtitle}>{t.vitals_subtitle}</Text>
        </View>

        {/* Pre-fill normal values shortcut for speed */}
        <TouchableOpacity
          style={styles.shortcutBtn}
          onPress={handleQuickNormal}
          activeOpacity={0.7}
        >
          <Text style={styles.shortcutText}>{t.vitals_quick_normal}</Text>
        </TouchableOpacity>

        {/* Temperature */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.vital_temp}</Text>
          <TextInput
            style={styles.input}
            value={temp}
            onChangeText={setTemp}
            placeholder="37.5 / 99.5"
            keyboardType="numeric"
            placeholderTextColor={THEME.colors.textMuted}
          />
          <Text style={styles.rangeHint}>{t.vital_temp_hint}</Text>
        </View>

        {/* SpO2 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.vital_spo2}</Text>
          <TextInput
            style={styles.input}
            value={spo2}
            onChangeText={setSpo2}
            placeholder="98"
            keyboardType="numeric"
            maxLength={3}
            placeholderTextColor={THEME.colors.textMuted}
          />
          <Text style={styles.rangeHint}>{t.vital_spo2_hint}</Text>
        </View>

        {/* Pulse */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.vital_pulse}</Text>
          <TextInput
            style={styles.input}
            value={pulse}
            onChangeText={setPulse}
            placeholder="78"
            keyboardType="numeric"
            maxLength={3}
            placeholderTextColor={THEME.colors.textMuted}
          />
          <Text style={styles.rangeHint}>{t.vital_pulse_hint}</Text>
        </View>

        {/* Blood Pressure (Sys / Dia) */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.vital_bp}</Text>
          <View style={styles.bpRow}>
            <TextInput
              style={[styles.input, styles.bpInput]}
              value={sysBp}
              onChangeText={setSysBp}
              placeholder="120"
              keyboardType="numeric"
              maxLength={3}
              placeholderTextColor={THEME.colors.textMuted}
            />
            <Text style={styles.bpSlash}>/</Text>
            <TextInput
              style={[styles.input, styles.bpInput]}
              value={diaBp}
              onChangeText={setDiaBp}
              placeholder="80"
              keyboardType="numeric"
              maxLength={3}
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
          <Text style={styles.rangeHint}>{t.vital_bp_hint}</Text>
        </View>

        {/* Respiratory Rate */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t.vital_rr}</Text>
          <TextInput
            style={styles.input}
            value={rr}
            onChangeText={setRr}
            placeholder="20"
            keyboardType="numeric"
            maxLength={2}
            placeholderTextColor={THEME.colors.textMuted}
          />
          <Text style={styles.rangeHint}>{t.vital_rr_hint}</Text>
        </View>
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
          title={t.btn_evaluate_triage}
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
  shortcutBtn: {
    backgroundColor: THEME.colors.primaryLight,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    marginBottom: THEME.spacing.md,
    alignItems: "center",
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.primaryDark,
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
  rangeHint: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  bpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bpInput: {
    flex: 1,
  },
  bpSlash: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.colors.textMuted,
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
