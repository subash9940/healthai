/**
 * src/services/staffService.ts
 *
 * Unified API client and session manager for Facility Staff role.
 * Handles Bearer token injection, request timeouts, and error mapping:
 * - 401 -> Clears jeevanya_staff_session, signals session expiration.
 * - 403 -> Signals action not permitted (session maintained).
 * - 409 -> Signals concurrency conflict / already handled.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const STAFF_SESSION_KEY = "jeevanya_staff_session";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.0.2.2:8001";

export interface FacilityStaff {
  id: string;
  name: string;
  phone_or_username: string;
  role: string;
  facility_id: string;
  facility_name?: string;
  facility_level?: string;
}

export interface StaffSessionData {
  token: string;
  staff: FacilityStaff;
}

export interface SosAlert {
  id: string;
  name: string;
  phone: string;
  village?: string;
  age?: number;
  sex?: string;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
  reported_earlier_at?: string | null;
  repeat_count?: number;
  facility_id?: string | null;
  facility_name?: string | null;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  resolved_notes?: string | null;
}

export interface FacilityReferral {
  id: string;
  patient_id?: string;
  patient_name: string;
  age_years?: number;
  gender?: string;
  symptoms?: string[];
  urgency: string;
  status: "created" | "in_transit" | "received" | "closed";
  from_facility_id?: string;
  to_facility_id?: string;
  referral_reason?: string;
  created_at: string;
}

export class StaffApiError extends Error {
  status: number;
  code: "SESSION_EXPIRED" | "NOT_PERMITTED" | "ALREADY_HANDLED" | "NETWORK_ERROR" | "UNKNOWN";

  constructor(
    message: string,
    status: number,
    code: "SESSION_EXPIRED" | "NOT_PERMITTED" | "ALREADY_HANDLED" | "NETWORK_ERROR" | "UNKNOWN"
  ) {
    super(message);
    this.name = "StaffApiError";
    this.status = status;
    this.code = code;
  }
}

export const StaffService = {
  // --- Session Management ---
  async getSession(): Promise<StaffSessionData | null> {
    try {
      const raw = await AsyncStorage.getItem(STAFF_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StaffSessionData;
    } catch {
      return null;
    }
  },

  async saveSession(session: StaffSessionData): Promise<void> {
    await AsyncStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
  },

  async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(STAFF_SESSION_KEY);
  },

  // --- Base HTTP Requester ---
  async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const session = await this.getSession();
    const token = session?.token;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        let errDetail = "";
        try {
          const errJson = await res.json();
          errDetail = errJson.detail || JSON.stringify(errJson);
        } catch {
          errDetail = res.statusText;
        }

        if (res.status === 401) {
          await this.clearSession();
          throw new StaffApiError(errDetail || "Session expired", 401, "SESSION_EXPIRED");
        } else if (res.status === 403) {
          throw new StaffApiError(errDetail || "Action not permitted", 403, "NOT_PERMITTED");
        } else if (res.status === 409) {
          throw new StaffApiError(errDetail || "Resource already modified", 409, "ALREADY_HANDLED");
        } else {
          throw new StaffApiError(errDetail || `Request failed with status ${res.status}`, res.status, "UNKNOWN");
        }
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (err instanceof StaffApiError) {
        throw err;
      }
      if (err.name === "AbortError") {
        throw new StaffApiError("Request timed out", 0, "NETWORK_ERROR");
      }
      throw new StaffApiError(err.message || "Network error", 0, "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  },

  // --- Authentication ---
  async login(phone_or_username: string, mpin: string): Promise<StaffSessionData> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${BACKEND_URL}/facility/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_or_username, mpin }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errDetail = "";
        try {
          const errJson = await res.json();
          errDetail = errJson.detail || JSON.stringify(errJson);
        } catch {
          errDetail = res.statusText;
        }
        throw new StaffApiError(errDetail || "Login failed", res.status, "UNKNOWN");
      }

      const data = await res.json();
      const sessionData: StaffSessionData = {
        token: data.access_token,
        staff: data.staff,
      };

      await this.saveSession(sessionData);
      return sessionData;
    } catch (err: any) {
      if (err instanceof StaffApiError) throw err;
      if (err.name === "AbortError") {
        throw new StaffApiError("Request timed out", 0, "NETWORK_ERROR");
      }
      throw new StaffApiError(err.message || "Network error", 0, "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  },

  // --- Emergency SOS Alerts ---
  async getSosAlerts(): Promise<SosAlert[]> {
    return this.request<SosAlert[]>("/facility/sos");
  },

  async acknowledgeSos(id: string): Promise<{ status: string; alert: SosAlert }> {
    return this.request<{ status: string; alert: SosAlert }>(`/facility/sos/${id}/acknowledge`, {
      method: "POST",
    });
  },

  async resolveSos(id: string, notes?: string): Promise<{ status: string; alert: SosAlert }> {
    return this.request<{ status: string; alert: SosAlert }>(`/facility/sos/${id}/resolve`, {
      method: "POST",
      body: notes ? { notes } : {},
    });
  },

  // --- Facility Referrals ---
  async getReferrals(): Promise<FacilityReferral[]> {
    return this.request<FacilityReferral[]>("/facility/referrals");
  },

  async getUnassignedReferrals(): Promise<FacilityReferral[]> {
    return this.request<FacilityReferral[]>("/facility/referrals/unassigned");
  },

  async acceptReferral(id: string): Promise<{ status: string; referral: FacilityReferral }> {
    return this.request<{ status: string; referral: FacilityReferral }>(`/facility/referrals/${id}/accept`, {
      method: "POST",
    });
  },

  async receiveReferral(id: string): Promise<{ status: string; referral: FacilityReferral }> {
    return this.request<{ status: string; referral: FacilityReferral }>(`/facility/referrals/${id}/receive`, {
      method: "POST",
    });
  },

  async closeReferral(id: string): Promise<{ status: string; referral: FacilityReferral }> {
    return this.request<{ status: string; referral: FacilityReferral }>(`/facility/referrals/${id}/close`, {
      method: "POST",
    });
  },
};
