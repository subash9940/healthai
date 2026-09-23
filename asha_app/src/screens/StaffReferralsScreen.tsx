/**
 * src/screens/StaffReferralsScreen.tsx
 *
 * Facility Referral Queue & Patient Intake Management (Jeevanya).
 * Real-time 5s polling referral queue for clinical facility staff.
 * Server-Driven Authority: State transitions are strictly server-authorized.
 * Strict Zero Native Alert Policy: Non-blocking inline banners for all feedback.
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
import {
  StaffService,
  FacilityReferral,
  StaffApiError,
} from "../services/staffService";

interface StaffReferralsScreenProps {
  language: Language;
  onBack: () => void;
}

type FilterTab = "ALL" | "UNASSIGNED" | "IN_TRANSIT" | "RECEIVED" | "CLOSED";

/**
 * Format relative creation age from UTC timestamp.
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

export const StaffReferralsScreen: React.FC<StaffReferralsScreenProps> = ({
  language,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [referrals, setReferrals] = useState<FacilityReferral[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Selected item for note entry / action
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<string>("");

  const [banner, setBanner] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const isFetchingRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReferrals = async (silent: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setLoading(true);

    try {
      const [assignedData, unassignedData] = await Promise.all([
        StaffService.getReferrals(),
        StaffService.getUnassignedReferrals(),
      ]);

      // Merge and deduplicate by referral ID
      const map = new Map<string, FacilityReferral>();
      assignedData.forEach((item) => map.set(item.id, item));
      unassignedData.forEach((item) => map.set(item.id, item));

      const merged = Array.from(map.values()).sort((a, b) => {
        const timeA = Date.parse(a.created_at || "") || 0;
        const timeB = Date.parse(b.created_at || "") || 0;
        return timeB - timeA; // Newest first
      });

      setReferrals(merged);
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
          message: err.message || "Failed to load referrals",
          type: "error",
        });
      }
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals(false);

    pollTimerRef.current = setInterval(() => {
      fetchReferrals(true);
    }, 5000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const handleCallPatient = (phone?: string | null) => {
    if (!phone || phone === "N/A") return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      setBanner({
        message: "Unable to open phone dialer.",
        type: "error",
      });
    });
  };

  const handleAccept = async (referralId: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(referralId);
    setBanner(null);

    try {
      await StaffService.acceptReferral(referralId, actionNotes.trim() || undefined);
      setBanner({
        message: t.staff_ref_accept_success || "Referral accepted and assigned to facility.",
        type: "success",
      });
      setActiveActionId(null);
      setActionNotes("");
      await fetchReferrals(true);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReceive = async (referralId: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(referralId);
    setBanner(null);

    try {
      await StaffService.receiveReferral(referralId, actionNotes.trim() || undefined);
      setBanner({
        message: t.staff_ref_receive_success || "Patient marked as received at facility.",
        type: "success",
      });
      setActiveActionId(null);
      setActionNotes("");
      await fetchReferrals(true);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClose = async (referralId: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(referralId);
    setBanner(null);

    try {
      await StaffService.closeReferral(referralId, actionNotes.trim() || undefined);
      setBanner({
        message: t.staff_ref_close_success || "Referral case completed and closed.",
        type: "success",
      });
      setActiveActionId(null);
      setActionNotes("");
      await fetchReferrals(true);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApiError = (err: any) => {
    if (err instanceof StaffApiError) {
      if (err.code === "ALREADY_HANDLED") {
        setBanner({
          message:
            t.staff_ref_already_handled ||
            "This referral was already updated by another staff member.",
          type: "info",
        });
        fetchReferrals(true);
      } else if (err.code === "NOT_PERMITTED") {
        setBanner({
          message:
            t.staff_ref_not_permitted ||
            "You do not have permission to update referrals for another facility.",
          type: "error",
        });
      } else if (err.code === "SESSION_EXPIRED") {
        setBanner({
          message: t.staff_session_expired || "Session expired. Please log in again.",
          type: "error",
        });
      } else {
        setBanner({
          message: (t.staff_ref_action_failed || "Action failed: {error}").replace(
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
  };

  const isUnassigned = (ref: FacilityReferral) =>
    ref.state === "created" || !ref.facility_id;

  const isInTransit = (ref: FacilityReferral) =>
    ref.state === "in_transit";

  const isReceived = (ref: FacilityReferral) =>
    ref.state === "received_at_facility";

  const isClosed = (ref: FacilityReferral) =>
    ref.state === "closed";

  const unassignedCount = referrals.filter(isUnassigned).length;
  const inTransitCount = referrals.filter(isInTransit).length;
  const receivedCount = referrals.filter(isReceived).length;
  const closedCount = referrals.filter(isClosed).length;

  const filteredReferrals = referrals.filter((item) => {
    if (activeFilter === "UNASSIGNED") return isUnassigned(item);
    if (activeFilter === "IN_TRANSIT") return isInTransit(item);
    if (activeFilter === "RECEIVED") return isReceived(item);
    if (activeFilter === "CLOSED") return isClosed(item);
    return true;
  });

  const getUrgencyBadgeStyle = (urgency?: string) => {
    const u = (urgency || "").toUpperCase();
    if (u.includes("EMERGENCY") || u.includes("RED")) {
      return {
        bg: THEME.colors.emergencyBg,
        text: THEME.colors.emergencyText,
        border: THEME.colors.emergencyBorder,
      };
    }
    if (u.includes("HIGH")) {
      return {
        bg: THEME.colors.highBg,
        text: THEME.colors.highText,
        border: THEME.colors.highBorder,
      };
    }
    if (u.includes("MEDIUM")) {
      return {
        bg: THEME.colors.mediumBg,
        text: THEME.colors.mediumText,
        border: THEME.colors.mediumBorder,
      };
    }
    return {
      bg: THEME.colors.lowBg,
      text: THEME.colors.lowText,
      border: THEME.colors.lowBorder,
    };
  };

  const getStatusLabel = (item: FacilityReferral) => {
    if (!item.facility_id) {
      return t.staff_ref_unassigned_badge || "UNASSIGNED";
    }
    if (item.state === "in_transit") {
      return t.staff_ref_status_in_transit || "In Transit";
    }
    if (item.state === "received_at_facility") {
      return t.staff_ref_status_received || "Received";
    }
    if (item.state === "closed") {
      return t.staff_ref_status_closed || "Closed";
    }
    return t.staff_ref_status_created || "Created";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.surface} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t.staff_ref_title || "Facility Referral Queue"}</Text>
          <Text style={styles.headerSubtitle}>
            {t.staff_ref_subtitle || "Live queue of incoming and assigned patient referrals"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => fetchReferrals(false)}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Ionicons
            name="refresh"
            size={22}
            color={loading ? THEME.colors.textMuted : THEME.colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Inline Feedback Banner */}
      {banner && (
        <View
          style={[
            styles.banner,
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
            size={20}
            color={
              banner.type === "success"
                ? THEME.colors.lowText
                : banner.type === "error"
                ? THEME.colors.emergencyText
                : THEME.colors.primary
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
            <Ionicons name="close" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === "ALL" && styles.filterTabActive]}
            onPress={() => setActiveFilter("ALL")}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === "ALL" && styles.filterTabTextActive,
              ]}
            >
              {(t.staff_ref_filter_all || "All ({count})").replace(
                "{count}",
                String(referrals.length)
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === "UNASSIGNED" && styles.filterTabActive]}
            onPress={() => setActiveFilter("UNASSIGNED")}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === "UNASSIGNED" && styles.filterTabTextActive,
              ]}
            >
              {(t.staff_ref_filter_unassigned || "Unassigned ({count})").replace(
                "{count}",
                String(unassignedCount)
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === "IN_TRANSIT" && styles.filterTabActive]}
            onPress={() => setActiveFilter("IN_TRANSIT")}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === "IN_TRANSIT" && styles.filterTabTextActive,
              ]}
            >
              {(t.staff_ref_filter_in_transit || "In Transit ({count})").replace(
                "{count}",
                String(inTransitCount)
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === "RECEIVED" && styles.filterTabActive]}
            onPress={() => setActiveFilter("RECEIVED")}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === "RECEIVED" && styles.filterTabTextActive,
              ]}
            >
              {(t.staff_ref_filter_received || "Received ({count})").replace(
                "{count}",
                String(receivedCount)
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeFilter === "CLOSED" && styles.filterTabActive]}
            onPress={() => setActiveFilter("CLOSED")}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === "CLOSED" && styles.filterTabTextActive,
              ]}
            >
              {(t.staff_ref_filter_closed || "Closed ({count})").replace(
                "{count}",
                String(closedCount)
              )}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Referral Items List */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {loading && referrals.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
          </View>
        ) : filteredReferrals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={THEME.colors.textMuted} />
            <Text style={styles.emptyText}>
              {t.staff_ref_empty || "No patient referrals found."}
            </Text>
          </View>
        ) : (
          filteredReferrals.map((item) => {
            const urgencyColors = getUrgencyBadgeStyle(item.urgency);
            const arrivalAge = getArrivalAgeString(item.created_at, t);
            const isActing = activeActionId === item.id;
            const isThisLoading = actionLoadingId === item.id;

            return (
              <View key={item.id} style={styles.card}>
                {/* Header Row: Patient Name & Urgency Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.patientInfoCol}>
                    <Text style={styles.patientName}>
                      {item.patient_name || "Citizen Patient"}
                    </Text>
                    <Text style={styles.patientMeta}>
                      {item.patient_age_years != null
                        ? `${item.patient_age_years} ${t.staff_ref_age_years || "yrs"}`
                        : ""}
                      {item.patient_sex ? ` • ${item.patient_sex}` : ""}
                      {item.patient_village ? ` • ${item.patient_village}` : ""}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.urgencyBadge,
                      {
                        backgroundColor: urgencyColors.bg,
                        borderColor: urgencyColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.urgencyBadgeText, { color: urgencyColors.text }]}>
                      {item.urgency || "ROUTINE"}
                    </Text>
                  </View>
                </View>

                {/* Sub-Header: Timing & Status Badge */}
                <View style={styles.metaRow}>
                  <View style={styles.metaBadge}>
                    <Ionicons name="time-outline" size={14} color={THEME.colors.textSecondary} />
                    <Text style={styles.metaText}>
                      {(t.staff_ref_time_ago || "Created {time}").replace("{time}", arrivalAge)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isUnassigned(item)
                        ? styles.statusUnassigned
                        : item.state === "received_at_facility"
                        ? styles.statusReceived
                        : item.state === "closed"
                        ? styles.statusClosed
                        : styles.statusInTransit,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isUnassigned(item)
                          ? styles.statusTextUnassigned
                          : item.state === "received_at_facility"
                          ? styles.statusTextReceived
                          : item.state === "closed"
                          ? styles.statusTextClosed
                          : styles.statusTextInTransit,
                      ]}
                    >
                      {getStatusLabel(item)}
                    </Text>
                  </View>
                </View>

                {/* Patient Phone Call Action */}
                {item.patient_phone && item.patient_phone !== "N/A" && (
                  <TouchableOpacity
                    style={styles.phoneRow}
                    onPress={() => handleCallPatient(item.patient_phone)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call" size={16} color={THEME.colors.primary} />
                    <Text style={styles.phoneText}>{item.patient_phone}</Text>
                  </TouchableOpacity>
                )}

                {/* Clinical Details: Rule, Symptoms, Vitals */}
                <View style={styles.detailsContainer}>
                  {item.rule_name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t.staff_ref_rule_label || "Rule:"}</Text>
                      <Text style={styles.detailValue}>{item.rule_name}</Text>
                    </View>
                  )}

                  {item.facility_name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        {t.staff_ref_target_facility || "Facility:"}
                      </Text>
                      <Text style={styles.detailValue}>
                        {item.facility_name}
                        {item.facility_level ? ` (${item.facility_level})` : ""}
                      </Text>
                    </View>
                  )}

                  {item.symptoms && item.symptoms.length > 0 && (
                    <View style={styles.symptomsContainer}>
                      <Text style={styles.detailLabel}>
                        {t.staff_ref_symptoms_label || "Symptoms:"}
                      </Text>
                      <View style={styles.symptomsChips}>
                        {item.symptoms.map((sym, idx) => (
                          <View key={idx} style={styles.symptomChip}>
                            <Text style={styles.symptomChipText}>{sym}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {item.recommended_action && (
                    <View style={styles.recommendationBox}>
                      <Text style={styles.recommendationHeader}>
                        {t.staff_ref_action_label || "Clinical Recommendation:"}
                      </Text>
                      <Text style={styles.recommendationText}>{item.recommended_action}</Text>
                    </View>
                  )}

                  {item.citizen_message && (
                    <View style={styles.citizenMsgBox}>
                      <Text style={styles.citizenMsgHeader}>
                        {t.staff_ref_citizen_msg || "Citizen Note:"}
                      </Text>
                      <Text style={styles.citizenMsgText}>{item.citizen_message}</Text>
                    </View>
                  )}
                </View>

                {/* State Transition Actions (Server Authority) */}
                {item.state !== "closed" && (
                  <View style={styles.actionsContainer}>
                    {isActing ? (
                      <View style={styles.notesSection}>
                        <TextInput
                          style={styles.notesInput}
                          placeholder={
                            t.staff_ref_notes_placeholder ||
                            "Clinical / intake notes (optional)..."
                          }
                          placeholderTextColor={THEME.colors.textMuted}
                          value={actionNotes}
                          onChangeText={setActionNotes}
                          multiline
                          numberOfLines={2}
                          editable={!isThisLoading}
                        />
                        <View style={styles.notesButtonRow}>
                          <TouchableOpacity
                            style={styles.notesCancelBtn}
                            onPress={() => {
                              setActiveActionId(null);
                              setActionNotes("");
                            }}
                            disabled={isThisLoading}
                          >
                            <Text style={styles.notesCancelText}>
                              {t.btn_cancel || "Cancel"}
                            </Text>
                          </TouchableOpacity>

                          {isUnassigned(item) && (
                            <TouchButton
                              title={t.staff_ref_btn_accept || "Accept Referral"}
                              onPress={() => handleAccept(item.id)}
                              loading={isThisLoading}
                              disabled={isThisLoading}
                              variant="primary"
                              style={styles.actionTouchBtn}
                            />
                          )}

                          {isInTransit(item) && (
                            <TouchButton
                              title={t.staff_ref_btn_receive || "Mark Received"}
                              onPress={() => handleReceive(item.id)}
                              loading={isThisLoading}
                              disabled={isThisLoading}
                              variant="primary"
                              style={styles.actionTouchBtn}
                            />
                          )}

                          {isReceived(item) && (
                            <TouchButton
                              title={t.staff_ref_btn_close || "Close Referral"}
                              onPress={() => handleClose(item.id)}
                              loading={isThisLoading}
                              disabled={isThisLoading}
                              variant="success"
                              style={styles.actionTouchBtn}
                            />
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.actionRow}>
                        {isUnassigned(item) && (
                          <TouchButton
                            title={t.staff_ref_btn_accept || "Accept Referral"}
                            onPress={() => {
                              setActiveActionId(item.id);
                              setActionNotes("");
                            }}
                            disabled={actionLoadingId != null}
                            variant="primary"
                            icon={
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={18}
                                color={THEME.colors.textInverse}
                              />
                            }
                            style={styles.fullWidthBtn}
                          />
                        )}

                        {isInTransit(item) && (
                          <TouchButton
                            title={t.staff_ref_btn_receive || "Mark Received"}
                            onPress={() => {
                              setActiveActionId(item.id);
                              setActionNotes("");
                            }}
                            disabled={actionLoadingId != null}
                            variant="primary"
                            icon={
                              <Ionicons
                                name="business-outline"
                                size={18}
                                color={THEME.colors.textInverse}
                              />
                            }
                            style={styles.fullWidthBtn}
                          />
                        )}

                        {isReceived(item) && (
                          <TouchButton
                            title={t.staff_ref_btn_close || "Close Referral"}
                            onPress={() => {
                              setActiveActionId(item.id);
                              setActionNotes("");
                            }}
                            disabled={actionLoadingId != null}
                            variant="success"
                            icon={
                              <Ionicons
                                name="checkbox-outline"
                                size={18}
                                color={THEME.colors.textInverse}
                              />
                            }
                            style={styles.fullWidthBtn}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: THEME.spacing.xs,
    marginRight: THEME.spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  refreshButton: {
    padding: THEME.spacing.xs,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    gap: 8,
  },
  bannerSuccess: {
    backgroundColor: THEME.colors.lowBg,
    borderColor: THEME.colors.lowBorder,
  },
  bannerError: {
    backgroundColor: THEME.colors.emergencyBg,
    borderColor: THEME.colors.emergencyBorder,
  },
  bannerInfo: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderColor: THEME.colors.primary,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  bannerTextSuccess: {
    color: THEME.colors.lowText,
  },
  bannerTextError: {
    color: THEME.colors.emergencyText,
  },
  bannerTextInfo: {
    color: THEME.colors.primary,
  },
  filterScrollContainer: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterTabActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.textSecondary,
  },
  filterTabTextActive: {
    color: THEME.colors.textInverse,
  },
  listContainer: {
    padding: THEME.spacing.md,
    gap: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  patientInfoCol: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  patientMeta: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
  },
  urgencyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
  },
  statusUnassigned: {
    backgroundColor: THEME.colors.highBg,
    borderColor: THEME.colors.highBorder,
  },
  statusInTransit: {
    backgroundColor: THEME.colors.mediumBg,
    borderColor: THEME.colors.mediumBorder,
  },
  statusReceived: {
    backgroundColor: THEME.colors.lowBg,
    borderColor: THEME.colors.lowBorder,
  },
  statusClosed: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderColor: THEME.colors.borderStrong,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusTextUnassigned: {
    color: THEME.colors.highText,
  },
  statusTextInTransit: {
    color: THEME.colors.mediumText,
  },
  statusTextReceived: {
    color: THEME.colors.lowText,
  },
  statusTextClosed: {
    color: THEME.colors.textSecondary,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.sm,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.colors.primary,
  },
  detailsContainer: {
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.sm,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  symptomsContainer: {
    gap: 4,
  },
  symptomsChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  symptomChip: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  symptomChipText: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
  },
  recommendationBox: {
    backgroundColor: THEME.colors.surface,
    padding: 6,
    borderRadius: THEME.borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
    gap: 2,
  },
  recommendationHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.primary,
  },
  recommendationText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  citizenMsgBox: {
    backgroundColor: THEME.colors.surface,
    padding: 6,
    borderRadius: THEME.borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.mediumBorder,
    gap: 2,
  },
  citizenMsgHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.mediumText,
  },
  citizenMsgText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
  },
  actionsContainer: {
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
  },
  fullWidthBtn: {
    flex: 1,
  },
  notesSection: {
    gap: 8,
  },
  notesInput: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 6,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    minHeight: 48,
  },
  notesButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  notesCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesCancelText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: "600",
  },
  actionTouchBtn: {
    minWidth: 140,
  },
});
