/**
 * src/services/facilityService.ts
 *
 * Live & Offline-Resilient Facility Availability Client for ASHA App.
 * Fetches real-time bed capacity, operational triage status, and broadcast notes.
 * Automatically caches for zero-network field scenarios with pull-to-refresh.
 */

import { FacilityAvailabilityItem } from "../types";
import { StorageService } from "./storageService";

// Standard Android emulator loopback & localhost endpoints
const ENDPOINTS = [
  "http://10.0.2.2:8001/facility/availability",
  "http://127.0.0.1:8001/facility/availability",
  "http://localhost:8001/facility/availability",
];

const NEARBY_ENDPOINTS = [
  "http://10.0.2.2:8001/facility/nearby",
  "http://127.0.0.1:8001/facility/nearby",
  "http://localhost:8001/facility/nearby",
];

export const FALLBACK_FACILITIES: FacilityAvailabilityItem[] = [
  {
    id: "1847ee81-9e03-468e-9af3-a9650d12dbeb",
    name: "PHC Shirur (प्राथमिक आरोग्य केंद्र शिरूर)",
    level: "phc",
    operational_status: "AVAILABLE",
    available_beds: 12,
    status_note: "Normal OPD operating. Medical officer and maternity staff on duty.",
    district: "Pune",
    updated_at: new Date().toISOString(),
  },
  {
    id: "3141e5f7-5633-47b0-a66e-364d65049c8a",
    name: "CHC Haveli (सामुदायिक आरोग्य केंद्र हवेली)",
    level: "chc",
    operational_status: "AVAILABLE",
    available_beds: 24,
    status_note: "Emergency triage, X-ray, and pediatric ward fully operational.",
    district: "Pune",
    updated_at: new Date().toISOString(),
  },
  {
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    name: "Sub-District Hospital Baramati",
    level: "sdh",
    operational_status: "BUSY",
    available_beds: 8,
    status_note: "High patient volume in medicine OPD; maternity beds open.",
    district: "Pune",
    updated_at: new Date().toISOString(),
  },
  {
    id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    name: "District Hospital Aundh (पुणे जिल्हा रुग्णालय)",
    level: "district_hospital",
    operational_status: "AVAILABLE",
    available_beds: 45,
    status_note: "24x7 ICU, Blood Bank, and Emergency surgical teams active.",
    district: "Pune",
    updated_at: new Date().toISOString(),
  },
];

export interface FacilityFetchResult {
  facilities: FacilityAvailabilityItem[];
  isOfflineCached: boolean;
  cachedAt?: string | null;
  error?: string;
}

export const FacilityService = {
  async getNearbyFacilities(
    level?: string,
    district?: string,
    lat?: number,
    lng?: number
  ): Promise<FacilityFetchResult> {
    const queryParams = new URLSearchParams();
    if (level) queryParams.append("level", level);
    if (district) queryParams.append("district", district);
    if (lat !== undefined) queryParams.append("lat", lat.toString());
    if (lng !== undefined) queryParams.append("lng", lng.toString());
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

    for (const baseUrl of NEARBY_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${baseUrl}${queryString}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data: FacilityAvailabilityItem[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            return {
              facilities: data,
              isOfflineCached: false,
              cachedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    // If nearby endpoint fails, fall back to general availability
    const generalResult = await this.getFacilityAvailability();
    if (level && generalResult.facilities) {
      const filtered = generalResult.facilities.filter(
        (f) => f.level.toLowerCase() === level.toLowerCase()
      );
      return {
        ...generalResult,
        facilities: filtered.length > 0 ? filtered : generalResult.facilities,
      };
    }
    return generalResult;
  },

  async getFacilityAvailability(): Promise<FacilityFetchResult> {
    for (const url of ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data: FacilityAvailabilityItem[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            await StorageService.setCachedFacilityAvailability(data);
            return {
              facilities: data,
              isOfflineCached: false,
              cachedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Continue to next endpoint or fallback
      }
    }

    // Try reading from offline cache
    const { facilities, cachedAt } = await StorageService.getCachedFacilityAvailability();
    if (facilities && facilities.length > 0) {
      return {
        facilities,
        isOfflineCached: true,
        cachedAt,
      };
    }

    // Fallback seed list if first time offline
    await StorageService.setCachedFacilityAvailability(FALLBACK_FACILITIES);
    return {
      facilities: FALLBACK_FACILITIES,
      isOfflineCached: true,
      cachedAt: new Date().toISOString(),
    };
  },
};
