/**
 * src/services/storageService.ts
 *
 * Local Offline Storage Engine using AsyncStorage & SecureStore.
 * Manages Session Tokens, Patient Records, Referrals, and Security Audit Logs.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  PatientRecord,
  ReferralRecord,
  AshaWorkerSession,
  Language,
  ReferralStatus,
  SecurityAuditLog,
  FacilityAvailabilityItem,
} from "../types";

const KEYS = {
  LANGUAGE: "@swasthya_asha_lang",
  PATIENT_RECORDS: "@swasthya_asha_patients",
  REFERRALS: "@swasthya_asha_referrals",
  SESSION_AUTH: "swasthya_asha_auth_session",
  SESSION_TOKEN: "@swasthya_session_token",
  AUDIT_LOGS: "@swasthya_security_audit_logs",
  CACHED_FACILITIES: "@swasthya_cached_facilities",
  CACHED_FACILITIES_TS: "@swasthya_cached_facilities_ts",
};

export const StorageService = {
  // --- Language ---
  async getLanguage(): Promise<Language> {
    try {
      const lang = await AsyncStorage.getItem(KEYS.LANGUAGE);
      return (lang as Language) || "en"; // Default English
    } catch {
      return "en";
    }
  },

  async setLanguage(lang: Language): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.LANGUAGE, lang);
    } catch (e) {
      console.error("Failed to save language:", e);
    }
  },

  // --- Auth Session & Session Token ---
  async getSession(): Promise<AshaWorkerSession | null> {
    try {
      let raw = null;
      try {
        raw = await SecureStore.getItemAsync(KEYS.SESSION_AUTH);
      } catch {
        raw = await AsyncStorage.getItem(KEYS.SESSION_AUTH);
      }

      if (raw) {
        const session: AshaWorkerSession = JSON.parse(raw);
        // Verify session token expiry
        if (session.token_expires_at) {
          const expiresAt = new Date(session.token_expires_at).getTime();
          if (Date.now() > expiresAt) {
            await this.clearSession();
            return null;
          }
        }
        return session;
      }
    } catch {
      // Fallback
    }
    return null;
  },

  async saveSession(session: AshaWorkerSession): Promise<void> {
    try {
      const sessionStr = JSON.stringify(session);
      try {
        await SecureStore.setItemAsync(KEYS.SESSION_AUTH, sessionStr);
      } catch {
        // Fallback for environments where SecureStore isn't available
        await AsyncStorage.setItem(KEYS.SESSION_AUTH, sessionStr);
      }
      if (session.session_token) {
        await AsyncStorage.setItem(KEYS.SESSION_TOKEN, session.session_token);
      }
    } catch (e) {
      console.error("Failed to save secure session:", e);
    }
  },

  async clearSession(): Promise<void> {
    try {
      try {
        await SecureStore.deleteItemAsync(KEYS.SESSION_AUTH);
      } catch {
        // Ignore
      }
      await AsyncStorage.removeItem(KEYS.SESSION_AUTH);
      await AsyncStorage.removeItem(KEYS.SESSION_TOKEN);
    } catch (e) {
      console.error("Failed to clear session:", e);
    }
  },

  async getSessionToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.SESSION_TOKEN);
    } catch {
      return null;
    }
  },

  // --- Security Audit Logs ---
  async getAuditLogs(): Promise<SecurityAuditLog[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.AUDIT_LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async logSecurityEvent(
    eventType: SecurityAuditLog["event_type"],
    workerId: string,
    details: string
  ): Promise<void> {
    try {
      const existing = await this.getAuditLogs();
      const newLog: SecurityAuditLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        worker_id: workerId,
        event_type: eventType,
        details,
        ip_device: "Field Mobile Device (Local Encrypted Storage)",
      };
      const updated = [newLog, ...existing.slice(0, 49)];
      await AsyncStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to write security log:", e);
    }
  },

  // --- Patient Records (Outbox) ---
  async getAllPatientRecords(): Promise<PatientRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PATIENT_RECORDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async savePatientRecord(record: PatientRecord): Promise<void> {
    try {
      const existing = await this.getAllPatientRecords();
      const updated = [
        record,
        ...existing.filter((r) =>
          record.record_id
            ? r.record_id !== record.record_id
            : r.patient.patient_id !== record.patient.patient_id
        ),
      ];
      await AsyncStorage.setItem(KEYS.PATIENT_RECORDS, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save patient record locally:", e);
    }
  },

  // --- Referral Records ---
  async getAllReferrals(): Promise<ReferralRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.REFERRALS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async saveReferral(referral: ReferralRecord): Promise<void> {
    try {
      const existing = await this.getAllReferrals();
      const updated = [referral, ...existing.filter((r) => r.referral_id !== referral.referral_id)];
      await AsyncStorage.setItem(KEYS.REFERRALS, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save referral locally:", e);
    }
  },

  async updateReferralStatus(
    referralId: string,
    newStatus: ReferralStatus,
    note?: string
  ): Promise<ReferralRecord | null> {
    try {
      const referrals = await this.getAllReferrals();
      const target = referrals.find((r) => r.referral_id === referralId);
      if (!target) return null;

      target.status = newStatus;
      // local-only, not authoritative, never synced
      target.status_history.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: note || `Updated status to ${newStatus}`,
      });

      await AsyncStorage.setItem(KEYS.REFERRALS, JSON.stringify(referrals));
      return target;
    } catch (e) {
      console.error("Failed to update referral status:", e);
      return null;
    }
  },

  // --- Outbox Sync Count ---
  async getPendingSyncCount(): Promise<number> {
    try {
      const patients = await this.getAllPatientRecords();
      const unSyncedPatients = patients.filter(
        (p) => !p.synced && Boolean(p.record_id && p.record_id.trim())
      ).length;
      return unSyncedPatients;
    } catch {
      return 0;
    }
  },

  // --- Mark Records Synced ---
  async markRecordsAsSynced(patientOrRecordIds: string[], referralIds: string[]): Promise<void> {
    try {
      const [patients, referrals] = await Promise.all([
        this.getAllPatientRecords(),
        this.getAllReferrals(),
      ]);

      const updatedPatients = patients.map((p) =>
        patientOrRecordIds.includes(p.record_id) || patientOrRecordIds.includes(p.patient.patient_id)
          ? { ...p, synced: true, synced_at: new Date().toISOString() }
          : p
      );

      const updatedReferrals = referrals.map((r) =>
        referralIds.includes(r.referral_id) ? { ...r, synced: true } : r
      );

      await Promise.all([
        AsyncStorage.setItem(KEYS.PATIENT_RECORDS, JSON.stringify(updatedPatients)),
        AsyncStorage.setItem(KEYS.REFERRALS, JSON.stringify(updatedReferrals)),
      ]);
    } catch (e) {
      console.error("Failed to mark records as synced:", e);
    }
  },

  // --- Facility Availability Caching ---
  async getCachedFacilityAvailability(): Promise<{ facilities: FacilityAvailabilityItem[]; cachedAt: string | null }> {
    try {
      const [rawList, rawTs] = await Promise.all([
        AsyncStorage.getItem(KEYS.CACHED_FACILITIES),
        AsyncStorage.getItem(KEYS.CACHED_FACILITIES_TS),
      ]);
      const facilities = rawList ? JSON.parse(rawList) : [];
      return { facilities, cachedAt: rawTs };
    } catch (e) {
      console.error("Failed to read cached facilities:", e);
      return { facilities: [], cachedAt: null };
    }
  },

  async setCachedFacilityAvailability(facilities: FacilityAvailabilityItem[]): Promise<void> {
    try {
      const now = new Date().toISOString();
      await Promise.all([
        AsyncStorage.setItem(KEYS.CACHED_FACILITIES, JSON.stringify(facilities)),
        AsyncStorage.setItem(KEYS.CACHED_FACILITIES_TS, now),
      ]);
    } catch (e) {
      console.error("Failed to cache facilities:", e);
    }
  },
};
