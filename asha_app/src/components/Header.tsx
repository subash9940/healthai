/**
 * src/components/Header.tsx
 *
 * Gov Header with 4-Language Switcher (MR -> HI -> EN -> TA)
 * and ASHA Worker Profile Badge.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, AshaWorkerSession } from "../types";

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  session?: AshaWorkerSession | null;
  onLogout?: () => void;
}

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिंदी" },
  { code: "ta", label: "தமிழ்" },
  { code: "mr", label: "मराठी" },
];

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  session,
  onLogout,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <View style={styles.container}>
      {/* Top Gov Branding Strip */}
      <View style={styles.topGovStrip}>
        <Text style={styles.topGovText}>{t.app_subtitle}</Text>
        {session && (
          <TouchableOpacity onPress={onLogout} activeOpacity={0.7}>
            <Text style={styles.workerBadgeText}>{session.worker_id}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Bar */}
      <View style={styles.mainBar}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>{t.app_title}</Text>
          <Text style={styles.brandSubtitle}>
            {session ? `${session.worker_name} · ${session.sub_centre}` : t.app_subtitle}
          </Text>
        </View>

        {/* 4-Language Pill Switcher */}
        <View style={styles.langSelector}>
          {LANGUAGES.map((l) => {
            const isActive = language === l.code;
            return (
              <TouchableOpacity
                key={l.code}
                style={[styles.langBtn, isActive && styles.langBtnActive]}
                onPress={() => onLanguageChange(l.code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langBtnText, isActive && styles.langBtnTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  topGovStrip: {
    backgroundColor: THEME.colors.primaryDark,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topGovText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E0F2FE",
  },
  workerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#BAE6FD",
    textDecorationLine: "underline",
  },
  mainBar: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandContainer: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.colors.primary,
  },
  brandSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  langSelector: {
    flexDirection: "row",
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
  },
  langBtnActive: {
    backgroundColor: THEME.colors.primary,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  langBtnTextActive: {
    color: THEME.colors.textInverse,
  },
});
