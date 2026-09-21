/**
 * src/screens/StaffHomeScreen.tsx
 *
 * Facility Staff Operational Dashboard (Jeevanya).
 * Displays facility details, live Open-SOS alert badge with 5s polling,
 * and navigation triggers for Emergency SOS and Facility Referral Queues.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language } from "../types";
import { TouchButton } from "../components/TouchButton";
import { StaffService, StaffSessionData, StaffApiError } from "../services/staffService";

interface StaffHomeScreenProps {
  language: Language;
  staffSession: StaffSessionData;
  onOpenSos: () => void;
  onOpenReferrals: () => void;
  onLogout: () => void;
}

export const StaffHomeScreen: React.FC<StaffHomeScreenProps> = ({
  language,
  staffSession,
  onOpenSos,
  onOpenReferrals,
  onLogout,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [openSosCount, setOpenSosCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOpenSosCount = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const alerts = await StaffService.getSosAlerts();
      const openCount = alerts.filter((a) => a.status === "OPEN").length;
      setOpenSosCount(openCount);
      setErrorMessage(null);
    } catch (err: any) {
      if (err instanceof StaffApiError && err.code === "SESSION_EXPIRED") {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setErrorMessage(t.staff_session_expired || "Session expired. Please log in again.");
        return;
      }
      // Non-fatal background polling failure
    } finally {
      isFetchingRef.current = false;
      setLoadingCount(false);
    }
  };

  useEffect(() => {
    fetchOpenSosCount();

    pollTimerRef.current = setInterval(() => {
      fetchOpenSosCount();
    }, 5000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const facilityName =
    staffSession.staff.facility_name || "Primary Health Centre";
  const facilityLevel = (
    staffSession.staff.facility_level || "PHC"
  ).toUpperCase();
  const staffRole = staffSession.staff.role || "Staff";
  const staffName = staffSession.staff.name || staffSession.staff.phone_or_username;

  const facilityBadgeText = (
    t.staff_home_facility_badge || "Facility: {facility} ({level})"
  )
    .replace("{facility}", facilityName)
    .replace("{level}", facilityLevel);

  const roleBadgeText = (t.staff_home_role_badge || "Role: {role}").replace(
    "{role}",
    staffRole
  );

  const openSosBadgeText = (
    t.staff_home_open_sos_badge || "{count} Open Alert(s)"
  ).replace("{count}", String(openSosCount));

  const welcomeText = (t.staff_home_welcome || "Welcome, {name}").replace(
    "{name}",
    staffName
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.surface} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title & National Health Badge */}
        <View style={styles.headerCard}>
          <View style={styles.govRow}>
            <View style={styles.badgeGov}>
              <Text style={styles.govText}>National Health Mission · Facility Portal</Text>
            </View>
          </View>
          <Text style={styles.title}>{t.staff_home_title || "Facility Dashboard"}</Text>
          <Text style={styles.welcomeText}>{welcomeText}</Text>

          {/* Facility & Role Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.facilityBadge}>
              <Ionicons name="business" size={14} color={THEME.colors.primaryDark} />
              <Text style={styles.facilityBadgeText}>{facilityBadgeText}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name="person-circle" size={14} color={THEME.colors.accentBlue} />
              <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
            </View>
          </View>
        </View>

        {/* Error / Session Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={THEME.colors.emergencyText} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* SOS Emergency Alerts Hub Card */}
        <View style={styles.actionCard}>
          <View style={styles.actionCardHeader}>
            <View style={styles.iconCircleEmergency}>
              <Ionicons name="warning" size={24} color={THEME.colors.emergencyText} />
            </View>
            <View style={styles.actionHeaderTexts}>
              <Text style={styles.actionTitle}>
                {t.staff_home_sos_title || "Emergency SOS Alerts"}
              </Text>
              <Text style={styles.actionDesc}>
                {t.staff_home_sos_desc ||
                  "Real-time SOS emergencies from citizens and field workers"}
              </Text>
            </View>
          </View>

          {/* Live Open SOS Count Badge */}
          <View
            style={[
              styles.sosCountContainer,
              openSosCount > 0 ? styles.sosCountActive : styles.sosCountZero,
            ]}
          >
            <Ionicons
              name={openSosCount > 0 ? "notifications-circle" : "checkmark-circle"}
              size={18}
              color={openSosCount > 0 ? THEME.colors.emergencyText : THEME.colors.lowText}
            />
            <Text
              style={[
                styles.sosCountText,
                openSosCount > 0 ? styles.sosCountTextActive : styles.sosCountTextZero,
              ]}
            >
              {loadingCount ? "Checking..." : openSosBadgeText}
            </Text>
          </View>

          <TouchButton
            title={t.staff_home_btn_sos || "Open SOS Alerts →"}
            onPress={onOpenSos}
            variant="danger"
            style={styles.touchBtn}
          />
        </View>

        {/* Facility Referral Queue Card */}
        <View style={styles.actionCard}>
          <View style={styles.actionCardHeader}>
            <View style={styles.iconCircleTeal}>
              <Ionicons name="git-network" size={24} color={THEME.colors.primaryDark} />
            </View>
            <View style={styles.actionHeaderTexts}>
              <Text style={styles.actionTitle}>
                {t.staff_home_referrals_title || "Facility Referral Queue"}
              </Text>
              <Text style={styles.actionDesc}>
                {t.staff_home_referrals_desc ||
                  "Manage incoming, unassigned, and received patient referrals"}
              </Text>
            </View>
          </View>

          <TouchButton
            title={t.staff_home_btn_referrals || "Open Referral Queue →"}
            onPress={onOpenReferrals}
            variant="primary"
            style={styles.touchBtn}
          />
        </View>

        {/* Staff Sign Out */}
        <View style={styles.footerContainer}>
          <TouchButton
            title={t.staff_btn_signout || "Sign Out"}
            onPress={onLogout}
            variant="outline"
            style={styles.signOutBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxxl,
  },
  headerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  govRow: {
    marginBottom: 8,
  },
  badgeGov: {
    alignSelf: "flex-start",
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  govText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  facilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  facilityBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.primaryDark,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.accentBlueLight,
    borderWidth: 1,
    borderColor: THEME.colors.accentBlue,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.accentBlue,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: THEME.colors.emergencyBg,
    borderColor: THEME.colors.emergencyBorder,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: THEME.spacing.md,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.emergencyText,
    flex: 1,
  },
  actionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionCardHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  iconCircleEmergency: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.emergencyBg,
    borderWidth: 1,
    borderColor: THEME.colors.emergencyBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleTeal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionHeaderTexts: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  actionDesc: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  sosCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  sosCountActive: {
    backgroundColor: THEME.colors.emergencyBg,
    borderColor: THEME.colors.emergencyBorder,
  },
  sosCountZero: {
    backgroundColor: THEME.colors.lowBg,
    borderColor: THEME.colors.lowBorder,
  },
  sosCountText: {
    fontSize: 13,
    fontWeight: "800",
  },
  sosCountTextActive: {
    color: THEME.colors.emergencyText,
  },
  sosCountTextZero: {
    color: THEME.colors.lowText,
  },
  touchBtn: {
    minHeight: 52,
    marginTop: 4,
  },
  footerContainer: {
    marginTop: THEME.spacing.sm,
  },
  signOutBtn: {
    minHeight: 52,
  },
});
