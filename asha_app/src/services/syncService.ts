/**
 * src/services/syncService.ts
 *
 * Background & On-Demand Synchronization Service.
 * Transmits local Outbox records to Jeevanya FastAPI backend.
 * Gracefully handles offline / airplane mode with zero crash rate.
 */

import { StorageService } from "./storageService";

const BACKEND_URL = "http://10.0.2.2:8001"; // Default Android emulator host loopback or localhost

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  message: string;
  error?: string;
}

export const SyncService = {
  async performSync(): Promise<SyncResult> {
    try {
      const [patients, referrals] = await Promise.all([
        StorageService.getAllPatientRecords(),
        StorageService.getAllReferrals(),
      ]);

      const pendingPatients = patients.filter((p) => !p.synced);
      const pendingReferrals = referrals.filter((r) => !r.synced);

      if (pendingPatients.length === 0 && pendingReferrals.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: "All records are already synced.",
        };
      }

      // Check server connectivity with short 2s timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          return {
            success: false,
            syncedCount: 0,
            message: `Health check failed with status ${response.status}. Records remain in outbox.`,
          };
        }

        // Send sync payload
        const syncPayload = {
          patients: pendingPatients,
          referrals: pendingReferrals,
          synced_at: new Date().toISOString(),
        };

        const pushRes = await fetch(`${BACKEND_URL}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncPayload),
        });

        if (!pushRes.ok) {
          return {
            success: false,
            syncedCount: 0,
            message: `Sync failed with status ${pushRes.status}. Records remain in outbox.`,
          };
        }

        const syncedPatientIds = pendingPatients.map((p) => p.patient.patient_id);
        const syncedReferralIds = pendingReferrals.map((r) => r.referral_id);
        await StorageService.markRecordsAsSynced(syncedPatientIds, syncedReferralIds);

        return {
          success: true,
          syncedCount: pendingPatients.length + pendingReferrals.length,
          message: `Successfully synchronized ${pendingPatients.length + pendingReferrals.length} records.`,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        return {
          success: false,
          syncedCount: 0,
          message: "Unable to reach backend server. Records remain in outbox.",
          error: err?.message || "Network unreachable",
        };
      }
    } catch (e: any) {
      return {
        success: false,
        syncedCount: 0,
        message: "Sync failed. Records remain safely stored in local outbox.",
        error: e?.message || "Unknown error",
      };
    }
  },
};
