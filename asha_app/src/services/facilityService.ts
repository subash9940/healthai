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

export const FALLBACK_FACILITIES: FacilityAvailabilityItem[] = [
  {
    id: "e0a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4",
    name: "PHC Shirur (प्राथमिक आरोग्य केंद्र शिरूर)",
    level: "phc",
    operational_status: "AVAILABLE",
    available_beds: 12,
    status_note: "Normal OPD operating. Medical officer and maternity staff on duty.",
    district: "Pune",
    updated_at: new Date().toISOString(),
  },
  {
    id: "f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
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
