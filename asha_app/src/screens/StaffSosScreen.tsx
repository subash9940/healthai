/**
 * src/screens/StaffSosScreen.tsx
 *
 * Emergency SOS Triage & Response Center (Jeevanya).
 * Real-time 5s polling distress beacon queue for facility clinicians and staff.
 * Strict Zero Native Alert Policy: In-app status banners for all feedbacks.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language } from "../types";
import { TouchButton } from "../components/TouchButton";
import { StaffService, SosAlert, StaffApiError } from "../services/staffService";

interface StaffSosScreenProps {
  language: Language;
  onBack: () => void;
}

type FilterTab = "ALL" | "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

/**
 * Format relative arrival age from UTC timestamp.
 * If timestamp lacks timezone offset, appends 'Z' for UTC parsing.
 * Clamps negative differences to 'Just now'.
 */
function getArrivalAgeString(
  timestampStr: string | null | undefined,
  t: Record<string, string>
): string {
  if (!timestampStr) return t.staff_sos_just_now || "Just now";
  let normalized = timestampStr.trim();
  if (!normalized.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized = normalized + "Z";
  }
  const parsedMs = Date.parse(normalized);
  if (isNaN(parsedMs)) return t.staff_sos_just_now || "Just now";

  const diffMs = Date.now() - parsedMs;
  if (diffMs < 60000) {
    return t.staff_sos_just_now || "Just now";
  }

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {
    return (t.staff_sos_min_ago || "{min} min ago").replace("{min}", String(diffMin));
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return (t.staff_sos_hr_ago || "{hr} hr ago").replace("{hr}", String(diffHours));
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Checks if reported_earlier note is valid and within 24h of arrival.
 */
function getReportedEarlierNote(
  reportedAt: string | null | undefined,
  receivedAt: string | null | undefined,
  t: Record<string, string>
): string | null {
  if (!reportedAt) return null;

  let normReported = reportedAt.trim();
  if (!normReported.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normReported)) {
    normReported = normReported + "Z";
  }
  const reportedMs = Date.parse(normReported);
  if (isNaN(reportedMs)) return null;

  let baseMs = Date.now();
  if (receivedAt) {
    let normReceived = receivedAt.trim();
    if (!normReceived.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normReceived)) {
      normReceived = normReceived + "Z";
    }
    const recMs = Date.parse(normReceived);
    if (!isNaN(recMs)) {
      baseMs = recMs;
    }
  }

  const diffMs = Math.abs(baseMs - reportedMs);
  const diffHours = diffMs / (1000 * 60 * 60);

  // Hidden if difference is over 24h
  if (diffHours > 24) return null;

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return null; // Negligible difference

  const timeDesc =
    diffMin < 60
      ? (t.staff_sos_min_ago || "{min} min ago").replace("{min}", String(diffMin))
      : (t.staff_sos_hr_ago || "{hr} hr ago").replace("{hr}", String(Math.floor(diffMin / 60)));

  return (t.staff_sos_reported_earlier || "Reported earlier: {time}").replace(
    "{time}",
    timeDesc
  );
}

export const StaffSosScreen: React.FC<StaffSosScreenProps> = ({
  language,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState<string>("");

  const [banner, setBanner] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const isFetchingRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = async (silent: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setLoading(true);

    try {
      const data = await StaffService.getSosAlerts();
      setAlerts(data);
    } catch (err: any) {
      if (err instanceof StaffApiError && err.code === "SESSION_EXPIRED") {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setBanner({
          message: t.staff_session_expired || "Session expired. Please log in again.",
          type: "error",
        });
        return;
      }
      if (!silent) {
        setBanner({
          message: err.message || "Failed to load SOS alerts",
          type: "error",
        });
      }
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts(false);

    pollTimerRef.current = setInterval(() => {
      fetchAlerts(true);
    }, 5000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(alertId);
    setBanner(null);

    try {
      await StaffService.acknowledgeSos(alertId);
      setBanner({
        message: t.staff_sos_ack_success || "Alert acknowledged successfully.",
        type: "success",
      });
      await fetchAlerts(true);
    } catch (err: any) {
      if (err instanceof StaffApiError) {
        if (err.code === "ALREADY_HANDLED") {
          setBanner({
            message:
              t.staff_sos_already_handled ||
              "This alert was already updated by another staff member.",
            type: "info",
          });
          await fetchAlerts(true);
        } else if (err.code === "NOT_PERMITTED") {
          setBanner({
            message:
              t.staff_sos_not_permitted ||
              "You do not have permission to perform this action.",
            type: "error",
          });
        } else if (err.code === "SESSION_EXPIRED") {
          setBanner({
            message: t.staff_session_expired || "Session expired. Please log in again.",
            type: "error",
          });
        } else {
          setBanner({
            message: (t.staff_sos_action_failed || "Action failed: {error}").replace(
              "{error}",
              err.message
            ),
            type: "error",
          });
        }
      } else {
        setBanner({
          message: err.message || "Network error",
          type: "error",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartResolve = (alertId: string) => {
    setResolvingAlertId(alertId);
    setResolveNotes("");
    setBanner(null);
  };

  const handleCancelResolve = () => {
    setResolvingAlertId(null);
    setResolveNotes("");
  };

  const handleSubmitResolve = async (alertId: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(alertId);
    setBanner(null);

    try {
      await StaffService.resolveSos(alertId, resolveNotes.trim() || undefined);
      setBanner({
        message: t.staff_sos_resolve_success || "Alert resolved successfully.",
        type: "success",
      });
      setResolvingAlertId(null);
      setResolveNotes("");
      await fetchAlerts(true);
    } catch (err: any) {
      if (err instanceof StaffApiError) {
        if (err.code === "ALREADY_HANDLED") {
          setBanner({
            message:
              t.staff_sos_already_handled ||
              "This alert was already updated by another staff member.",
            type: "info",
          });
          await fetchAlerts(true);
        } else if (err.code === "NOT_PERMITTED") {
          setBanner({
            message:
              t.staff_sos_not_permitted ||
              "You do not have permission to perform this action.",
            type: "error",
          });
        } else if (err.code === "SESSION_EXPIRED") {
          setBanner({
            message: t.staff_session_expired || "Session expired. Please log in again.",
            type: "error",
          });
        } else {
          setBanner({
            message: (t.staff_sos_action_failed || "Action failed: {error}").replace(
              "{error}",
              err.message
            ),
            type: "error",
          });
        }
      } else {
        setBanner({
          message: err.message || "Network error",
          type: "error",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCallCitizen = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      setBanner({
        message: "Unable to open phone dialer.",
        type: "error",
      });
    });
  };

  const handleOpenMaps = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return;
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      setBanner({
        message: "Unable to open map application.",
        type: "error",
      });
    });
  };

  const normalizeStatus = (statusStr: string): "OPEN" | "ACKNOWLEDGED" | "RESOLVED" => {
    const s = (statusStr || "").toUpperCase();
    if (s === "ACKNOWLEDGED") return "ACKNOWLEDGED";
    if (s === "RESOLVED") return "RESOLVED";
    return "OPEN";
  };

  const openCount = alerts.filter((a) => normalizeStatus(a.status) === "OPEN").length;
  const ackCount = alerts.filter(
    (a) => normalizeStatus(a.status) === "ACKNOWLEDGED"
  ).length;
  const resCount = alerts.filter((a) => normalizeStatus(a.status) === "RESOLVED").length;

  const filteredAlerts = alerts.filter((alert) => {
    const status = normalizeStatus(alert.status);
    if (activeFilter === "OPEN") return status === "OPEN";
    if (activeFilter === "ACKNOWLEDGED") return status === "ACKNOWLEDGED";
    if (activeFilter === "RESOLVED") return status === "RESOLVED";
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.surface} />

      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back to Dashboard"
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {t.staff_sos_title || "Emergency SOS Alerts"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t.staff_sos_subtitle || "Live triage of distress beacons"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchAlerts(false)}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color={THEME.colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Inline Feedback Banner */}
      {banner && (
        <View
          style={[
            styles.bannerContainer,
            banner.type === "success" && styles.bannerSuccess,
            banner.type === "error" && styles.bannerError,
            banner.type === "info" && styles.bannerInfo,
          ]}
        >
          <Ionicons
            name={
              banner.type === "success"
                ? "checkmark-circle"
                : banner.type === "error"
                ? "alert-circle"
                : "information-circle"
            }
            size={18}
            color={
              banner.type === "success"
                ? THEME.colors.lowText
                : banner.type === "error"
                ? THEME.colors.emergencyText
                : THEME.colors.primaryDark
            }
          />
          <Text
            style={[
              styles.bannerText,
              banner.type === "success" && styles.bannerTextSuccess,
              banner.type === "error" && styles.bannerTextError,
              banner.type === "info" && styles.bannerTextInfo,
            ]}
          >
            {banner.message}
          </Text>
          <TouchableOpacity onPress={() => setBanner(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeFilter === "ALL" && styles.tabActive]}
          onPress={() => setActiveFilter("ALL")}
        >
          <Text style={[styles.tabText, activeFilter === "ALL" && styles.tabTextActive]}>
            {(t.staff_sos_filter_all || "All ({count})").replace(
              "{count}",
              String(alerts.length)
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeFilter === "OPEN" && styles.tabActiveEmergency,
          ]}
          onPress={() => setActiveFilter("OPEN")}
        >
          <Text
            style={[
              styles.tabText,
              activeFilter === "OPEN" && styles.tabTextActiveEmergency,
            ]}
          >
            {(t.staff_sos_filter_open || "Open ({count})").replace(
              "{count}",
              String(openCount)
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeFilter === "ACKNOWLEDGED" && styles.tabActiveAmber,
          ]}
          onPress={() => setActiveFilter("ACKNOWLEDGED")}
        >
          <Text
            style={[
              styles.tabText,
              activeFilter === "ACKNOWLEDGED" && styles.tabTextActiveAmber,
            ]}
          >
            {(t.staff_sos_filter_ack || "Ack ({count})").replace(
              "{count}",
              String(ackCount)
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeFilter === "RESOLVED" && styles.tabActiveSuccess,
          ]}
          onPress={() => setActiveFilter("RESOLVED")}
        >
          <Text
            style={[
              styles.tabText,
              activeFilter === "RESOLVED" && styles.tabTextActiveSuccess,
            ]}
          >
            {(t.staff_sos_filter_resolved || "Done ({count})").replace(
              "{count}",
              String(resCount)
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Stream */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Fetching SOS distress alerts...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="shield-checkmark"
                size={56}
                color={THEME.colors.primary}
              />
              <Text style={styles.emptyTitle}>
                {t.staff_sos_empty || "No emergency SOS alerts found."}
              </Text>
            </View>
          ) : (
            filteredAlerts.map((alert) => {
              const status = normalizeStatus(alert.status);
              const patientName =
                alert.patient_name || alert.name || "Citizen Distress Beacon";
              const patientPhone = alert.patient_phone || alert.phone || "";
              const patientVillage =
                alert.patient_village || alert.village || "Unknown Village";
              const patientAge = alert.patient_age ?? alert.age;
              const patientSex = alert.patient_sex ?? alert.sex;
              const repeatCount = alert.repeat_count || 1;
              const isUnrouted = !alert.facility_id || alert.unrouted === true;
              const arrivalAge = getArrivalAgeString(
                alert.received_at || alert.created_at,
                t
              );
              const reportedEarlierNote = getReportedEarlierNote(
                alert.reported_at || alert.reported_earlier_at,
                alert.received_at || alert.created_at,
                t
              );
              const isActionLoading = actionLoadingId === alert.id;
              const isResolvingThis = resolvingAlertId === alert.id;

              return (
                <View
                  key={alert.id}
                  style={[
                    styles.alertCard,
                    status === "OPEN" && styles.alertCardOpen,
                    status === "ACKNOWLEDGED" && styles.alertCardAck,
                    status === "RESOLVED" && styles.alertCardResolved,
                  ]}
                >
                  {/* Card Top Row: Badges & Status */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.badgeCluster}>
                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          status === "OPEN" && styles.statusBadgeOpen,
                          status === "ACKNOWLEDGED" && styles.statusBadgeAck,
                          status === "RESOLVED" && styles.statusBadgeResolved,
                        ]}
                      >
                        <Ionicons
                          name={
                            status === "OPEN"
                              ? "alert-circle"
                              : status === "ACKNOWLEDGED"
                              ? "time"
                              : "checkmark-circle"
                          }
                          size={13}
                          color={
                            status === "OPEN"
                              ? THEME.colors.emergencyText
                              : status === "ACKNOWLEDGED"
                              ? THEME.colors.highText
                              : THEME.colors.lowText
                          }
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            status === "OPEN" && styles.statusBadgeTextOpen,
                            status === "ACKNOWLEDGED" && styles.statusBadgeTextAck,
                            status === "RESOLVED" && styles.statusBadgeTextResolved,
                          ]}
                        >
                          {status}
                        </Text>
                      </View>

                      {/* Repeat Count Badge */}
                      {repeatCount > 1 && (
                        <View style={styles.repeatBadge}>
                          <Ionicons
                            name="radio"
                            size={12}
                            color={THEME.colors.emergencyText}
                          />
                          <Text style={styles.repeatBadgeText}>
                            {(t.staff_sos_tapped_times || "Tapped {count}x").replace(
                              "{count}",
                              String(repeatCount)
                            )}
                          </Text>
                        </View>
                      )}

                      {/* UNROUTED Badge */}
                      {isUnrouted && (
                        <View style={styles.unroutedBadge}>
                          <Text style={styles.unroutedBadgeText}>
                            {t.staff_sos_unrouted || "UNROUTED"}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Arrival Age */}
                    <View style={styles.arrivalAgeContainer}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={THEME.colors.textSecondary}
                      />
                      <Text style={styles.arrivalAgeText}>
                        {(t.staff_sos_received_age || "Received {age}").replace(
                          "{age}",
                          arrivalAge
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Patient Name & Demographics */}
                  <Text style={styles.patientName}>{patientName}</Text>
                  <View style={styles.patientMetaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="location"
                        size={14}
                        color={THEME.colors.textSecondary}
                      />
                      <Text style={styles.metaText}>{patientVillage}</Text>
                    </View>
                    {(patientAge != null || patientSex != null) && (
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="person"
                          size={14}
                          color={THEME.colors.textSecondary}
                        />
                        <Text style={styles.metaText}>
                          {[
                            patientAge != null ? `${patientAge}y` : null,
                            patientSex != null ? patientSex : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Reported Earlier Note (null-safe, hidden if >24h or invalid) */}
                  {reportedEarlierNote && (
                    <View style={styles.reportedEarlierBanner}>
                      <Ionicons
                        name="hourglass-outline"
                        size={14}
                        color={THEME.colors.highText}
                      />
                      <Text style={styles.reportedEarlierText}>
                        {reportedEarlierNote}
                      </Text>
                    </View>
                  )}

                  {/* Interactive Quick Links: Call & Map */}
                  <View style={styles.quickActionsRow}>
                    {patientPhone ? (
                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => handleCallCitizen(patientPhone)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="call"
                          size={16}
                          color={THEME.colors.primaryDark}
                        />
                        <Text style={styles.quickActionBtnText}>
                          {patientPhone}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {alert.lat != null && alert.lng != null ? (
                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => handleOpenMaps(alert.lat, alert.lng)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="navigate"
                          size={16}
                          color={THEME.colors.accentBlue}
                        />
                        <Text style={styles.quickActionBtnTextBlue}>
                          {t.staff_sos_open_maps || "View on Map"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Resolution Notes Display (if resolved) */}
                  {(alert.resolution_notes || alert.resolved_notes) && (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesBoxTitle}>Resolution Notes:</Text>
                      <Text style={styles.notesBoxText}>
                        {alert.resolution_notes || alert.resolved_notes}
                      </Text>
                    </View>
                  )}

                  {/* Inline Resolve Note Editor */}
                  {isResolvingThis && (
                    <View style={styles.resolveEditorContainer}>
                      <Text style={styles.resolveEditorTitle}>
                        Enter Resolution Notes:
                      </Text>
                      <TextInput
                        style={styles.resolveInput}
                        placeholder={
                          t.staff_sos_notes_placeholder ||
                          "e.g. Ambulance dispatched, Patient stabilized..."
                        }
                        placeholderTextColor={THEME.colors.textMuted}
                        value={resolveNotes}
                        onChangeText={setResolveNotes}
                        multiline
                        numberOfLines={3}
                      />
                      <View style={styles.resolveEditorButtons}>
                        <TouchableOpacity
                          style={styles.resolveCancelBtn}
                          onPress={handleCancelResolve}
                          disabled={isActionLoading}
                        >
                          <Text style={styles.resolveCancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.resolveConfirmBtn,
                            isActionLoading && styles.disabledBtn,
                          ]}
                          onPress={() => handleSubmitResolve(alert.id)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={styles.resolveConfirmBtnText}>
                              {t.staff_sos_btn_submit_resolve || "Confirm Resolution"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Action Buttons (Disabled while action loading) */}
                  {!isResolvingThis && (
                    <View style={styles.actionButtonsContainer}>
                      {status === "OPEN" && (
                        <>
                          <TouchButton
                            title={t.staff_sos_btn_ack || "Acknowledge"}
                            onPress={() => handleAcknowledge(alert.id)}
                            variant="primary"
                            loading={isActionLoading}
                            disabled={!!actionLoadingId}
                            style={styles.cardActionBtn}
                          />
                          <TouchButton
                            title={t.staff_sos_btn_resolve || "Resolve Alert"}
                            onPress={() => handleStartResolve(alert.id)}
                            variant="outline"
                            disabled={!!actionLoadingId}
                            style={styles.cardActionBtn}
                          />
                        </>
                      )}

                      {status === "ACKNOWLEDGED" && (
                        <TouchButton
                          title={t.staff_sos_btn_resolve || "Resolve Alert"}
                          onPress={() => handleStartResolve(alert.id)}
                          variant="success"
                          disabled={!!actionLoadingId}
                          style={styles.cardActionBtnFull}
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: THEME.borderRadius.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: THEME.borderRadius.sm,
  },
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  bannerSuccess: {
    backgroundColor: THEME.colors.lowBg,
    borderBottomColor: THEME.colors.lowBorder,
  },
  bannerError: {
    backgroundColor: THEME.colors.emergencyBg,
    borderBottomColor: THEME.colors.emergencyBorder,
  },
  bannerInfo: {
    backgroundColor: THEME.colors.primaryLight,
    borderBottomColor: THEME.colors.primary,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  bannerTextSuccess: {
    color: THEME.colors.lowText,
  },
  bannerTextError: {
    color: THEME.colors.emergencyText,
  },
  bannerTextInfo: {
    color: THEME.colors.primaryDark,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  tabActiveEmergency: {
    backgroundColor: THEME.colors.emergencyBorder,
    borderColor: THEME.colors.emergencyText,
  },
  tabActiveAmber: {
    backgroundColor: THEME.colors.highBorder,
    borderColor: THEME.colors.highText,
  },
  tabActiveSuccess: {
    backgroundColor: THEME.colors.lowBorder,
    borderColor: THEME.colors.lowText,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.textInverse,
  },
  tabTextActiveEmergency: {
    color: "#FFFFFF",
  },
  tabTextActiveAmber: {
    color: THEME.colors.highText,
  },
  tabTextActiveSuccess: {
    color: THEME.colors.lowText,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: THEME.spacing.xl,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: "600",
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxxl,
    gap: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
    textAlign: "center",
  },
  alertCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  alertCardOpen: {
    borderColor: THEME.colors.emergencyBorder,
    backgroundColor: "#FFFDFD",
  },
  alertCardAck: {
    borderColor: THEME.colors.highBorder,
    backgroundColor: "#FFFEFA",
  },
  alertCardResolved: {
    borderColor: THEME.colors.lowBorder,
    backgroundColor: "#FAFFFA",
    opacity: 0.9,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.xs,
    borderWidth: 1,
  },
  statusBadgeOpen: {
    backgroundColor: THEME.colors.emergencyBg,
    borderColor: THEME.colors.emergencyBorder,
  },
  statusBadgeAck: {
    backgroundColor: THEME.colors.highBg,
    borderColor: THEME.colors.highBorder,
  },
  statusBadgeResolved: {
    backgroundColor: THEME.colors.lowBg,
    borderColor: THEME.colors.lowBorder,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusBadgeTextOpen: {
    color: THEME.colors.emergencyText,
  },
  statusBadgeTextAck: {
    color: THEME.colors.highText,
  },
  statusBadgeTextResolved: {
    color: THEME.colors.lowText,
  },
  repeatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.emergencyBg,
    borderWidth: 1,
    borderColor: THEME.colors.emergencyBorder,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.xs,
  },
  repeatBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.emergencyText,
  },
  unroutedBadge: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.xs,
  },
  unroutedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.textSecondary,
  },
  arrivalAgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  arrivalAgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  patientMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: "600",
  },
  reportedEarlierBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.highBg,
    borderWidth: 1,
    borderColor: THEME.colors.highBorder,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  reportedEarlierText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.highText,
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  quickActionBtn: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.primaryDark,
  },
  quickActionBtnTextBlue: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.accentBlue,
  },
  notesBox: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 8,
  },
  notesBoxTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  notesBoxText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  resolveEditorContainer: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    marginTop: 6,
    gap: 8,
  },
  resolveEditorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  resolveInput: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.sm,
    padding: 8,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    minHeight: 60,
    textAlignVertical: "top",
  },
  resolveEditorButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  resolveCancelBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
  },
  resolveCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  resolveConfirmBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.lowBorder,
    borderWidth: 1,
    borderColor: THEME.colors.lowText,
  },
  resolveConfirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.lowText,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cardActionBtn: {
    flex: 1,
    minHeight: 52,
  },
  cardActionBtnFull: {
    flex: 1,
    minHeight: 52,
  },
});
