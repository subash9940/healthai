/**
 * src/components/SyncBanner.tsx
 *
 * Reassuring Top Status Banner for ASHA Field Workers.
 * Shows 🟢 Online/Synced or 🟡 Offline (N records safely stored locally).
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language } from "../types";

interface SyncBannerProps {
  language: Language;
  pendingCount: number;
  isSyncing: boolean;
  onSyncPress: () => void;
}

export const SyncBanner: React.FC<SyncBannerProps> = ({
  language,
  pendingCount,
  isSyncing,
  onSyncPress,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.mr;
  const isClean = pendingCount === 0;

  return (
    <View style={[styles.container, isClean ? styles.cleanBg : styles.pendingBg]}>
      <View style={styles.leftRow}>
        <View style={[styles.dot, isClean ? styles.dotGreen : styles.dotAmber]} />
        <Text style={styles.statusText} numberOfLines={1}>
          {isClean
            ? t.status_online
            : t.status_outbox.replace("{count}", String(pendingCount))}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.syncBtn}
        onPress={onSyncPress}
        disabled={isSyncing}
        activeOpacity={0.7}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={THEME.colors.textPrimary} />
        ) : (
          <Text style={styles.syncBtnText}>{t.btn_sync_now}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  cleanBg: {
    backgroundColor: THEME.colors.lowBg,
  },
  pendingBg: {
    backgroundColor: THEME.colors.highBg,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotGreen: {
    backgroundColor: THEME.colors.online,
  },
  dotAmber: {
    backgroundColor: THEME.colors.offline,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    flexShrink: 1,
  },
  syncBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.md,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
});
