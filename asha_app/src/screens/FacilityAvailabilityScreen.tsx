/**
 * src/screens/FacilityAvailabilityScreen.tsx
 *
 * Frontline ASHA Facility Availability & Bed Capacity Monitor.
 * Displays real-time operational status (AVAILABLE, BUSY, EMERGENCY_ONLY, FULL),
 * live bed counts, level badges, and broadcast advisory notes.
 * Offline-first: Caches data locally and displays explicit cached-at indicators.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, FacilityAvailabilityItem, FacilityOperationalStatus } from "../types";
import { FacilityService } from "../services/facilityService";

interface FacilityAvailabilityScreenProps {
  language: Language;
  onBack: () => void;
}

export const FacilityAvailabilityScreen: React.FC<FacilityAvailabilityScreenProps> = ({
  language,
  onBack,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [facilities, setFacilities] = useState<FacilityAvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await FacilityService.getFacilityAvailability();
      setFacilities(res.facilities);
      setIsOfflineCached(res.isOfflineCached);
      setCachedAt(res.cachedAt || null);
    } catch (err) {
      console.error("Failed to load facility availability:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  };

  const getStatusBadge = (status: FacilityOperationalStatus) => {
    switch (status) {
      case "AVAILABLE":
        return {
          bg: "#ECFDF5",
          border: "#10B981",
          text: "#065F46",
          dot: "#10B981",
          label: t.facility_status_available || "AVAILABLE",
        };
      case "BUSY":
        return {
          bg: "#FFFBEB",
          border: "#F59E0B",
          text: "#92400E",
          dot: "#F59E0B",
          label: t.facility_status_busy || "BUSY",
        };
      case "EMERGENCY_ONLY":
        return {
          bg: "#FFF7ED",
          border: "#F97316",
          text: "#9A3412",
          dot: "#F97316",
          label: t.facility_status_emergency_only || "EMERGENCY ONLY",
        };
      case "FULL":
        return {
          bg: "#FEF2F2",
          border: "#EF4444",
          text: "#991B1B",
          dot: "#EF4444",
          label: t.facility_status_full || "FULL",
        };
      default:
        return {
          bg: "#F3F4F6",
          border: "#9CA3AF",
          text: "#374151",
          dot: "#9CA3AF",
          label: status,
        };
    }
  };

  const getLevelBadge = (level: string) => {
    const norm = level.toLowerCase();
    if (norm === "phc") return { label: "PHC", color: "#2563EB", bg: "#EFF6FF" };
    if (norm === "chc") return { label: "CHC", color: "#7C3AED", bg: "#F5F3FF" };
    if (norm === "sdh") return { label: "SDH", color: "#D97706", bg: "#FFFBEB" };
    if (norm === "dh" || norm === "district_hospital")
      return { label: "District Hospital", color: "#DC2626", bg: "#FEF2F2" };
    return { label: level.toUpperCase(), color: "#4B5563", bg: "#F3F4F6" };
  };

  const filteredFacilities = facilities.filter((f) => {
    if (filterLevel === "all") return true;
    const l = f.level.toLowerCase();
    if (filterLevel === "phc") return l === "phc";
    if (filterLevel === "chc") return l === "chc";
    if (filterLevel === "sdh") return l === "sdh";
    if (filterLevel === "dh") return l === "dh" || l === "district_hospital";
    return true;
  });

  const formatCachedTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← {t.btn_back}</Text>
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{t.facilities_title}</Text>
          <Text style={styles.headerSubtitle}>{t.facilities_subtitle}</Text>
        </View>
      </View>

      {/* Offline Cached Banner */}
      {isOfflineCached && (
        <View style={styles.cachedBanner}>
          <View style={styles.cachedDot} />
          <Text style={styles.cachedText}>
            {t.facility_cached_notice}{" "}
            {cachedAt ? `• ${t.facility_cached_at?.replace("{time}", formatCachedTime(cachedAt)) || formatCachedTime(cachedAt)}` : ""}
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: "all", label: t.facility_filter_all || "All" },
            { id: "phc", label: "PHC" },
            { id: "chc", label: "CHC" },
            { id: "sdh", label: "SDH" },
            { id: "dh", label: "District Hospital" },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.filterChip,
                filterLevel === item.id && styles.filterChipActive,
              ]}
              onPress={() => setFilterLevel(item.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterLevel === item.id && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Fetching live facility status...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[THEME.colors.primary]}
            />
          }
        >
          {filteredFacilities.map((facility) => {
            const statusStyle = getStatusBadge(facility.operational_status);
            const levelStyle = getLevelBadge(facility.level);

            return (
              <View key={facility.id} style={styles.card}>
                {/* Top Row: Level & Operational Status */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg }]}>
                    <Text style={[styles.levelBadgeText, { color: levelStyle.color }]}>
                      {levelStyle.label}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>

                {/* Facility Name */}
                <Text style={styles.facilityName}>{facility.name}</Text>
                {facility.district && (
                  <Text style={styles.districtText}>District: {facility.district}</Text>
                )}

                {/* Bed Counter Bar */}
                <View style={styles.bedCounterContainer}>
                  <View style={styles.bedIconWrapper}>
                    <MaterialCommunityIcons name="bed" size={20} color={THEME.colors.primary} />
                  </View>
                  <View style={styles.bedTextWrapper}>
                    <Text style={styles.bedCount}>{facility.available_beds}</Text>
                    <Text style={styles.bedLabel}>{t.facility_beds_count || "Available Beds"}</Text>
                  </View>
                </View>

                {/* Broadcast Advisory Note */}
                {facility.status_note && (
                  <View style={styles.noteBox}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                      <MaterialCommunityIcons name="bullhorn-outline" size={15} color="#D97706" style={{ marginRight: 4 }} />
                      <Text style={styles.noteTitle}>{t.facility_broadcast_note || "Advisory"}:</Text>
                    </View>
                    <Text style={styles.noteText}>{facility.status_note}</Text>
                  </View>
                )}

                {/* Footer Timestamp */}
                {facility.updated_at && (
                  <Text style={styles.timestampText}>
                    Last updated: {formatCachedTime(facility.updated_at)}
                  </Text>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.colors.primary,
  },
  headerTextContainer: {},
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
  },
  cachedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },
  cachedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D97706",
    marginRight: 8,
  },
  cachedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  filterContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  facilityName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  districtText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
  },
  bedCounterContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  bedIconWrapper: {
    marginRight: 12,
  },
  bedIcon: {
    fontSize: 24,
  },
  bedTextWrapper: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  bedCount: {
    fontSize: 24,
    fontWeight: "900",
    color: THEME.colors.primary,
  },
  bedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  noteBox: {
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  noteText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  timestampText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "right",
    marginTop: 4,
  },
});
