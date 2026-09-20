/**
 * src/services/syncService.ts
 *
 * Background & On-Demand Synchronization Service.
 * Transmits local Outbox records to Swasthya Setu FastAPI backend.
 * Gracefully handles offline / airplane mode with zero crash rate.
 */

import { StorageService } from "./storageService";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://10.0.2.2:8001";
const SYNC_KEY = process.env.EXPO_PUBLIC_SYNC_KEY ?? "";

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
      const totalPending = pendingPatients.length + pendingReferrals.length;

      if (totalPending === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: "All records are already synced.",
        };
      }

      // Check server connectivity with short timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          // Send sync payload
          const syncPayload = {
            patients: pendingPatients,
            referrals: pendingReferrals,
            synced_at: new Date().toISOString(),
          };

          const pushRes = await fetch(`${BACKEND_URL}/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(SYNC_KEY ? { "X-Sync-Key": SYNC_KEY } : {}),
            },
            body: JSON.stringify(syncPayload),
          });

          if (pushRes.ok) {
            const data = await pushRes.json();
            const records: Array<{ id: string; status: string; type: string }> = data.records || [];

            // Mark synced ONLY the IDs returned accepted or duplicate (D10)
            const acceptedPatientIds = records
              .filter((r) => r.type === "patient" && (r.status === "accepted" || r.status === "duplicate"))
              .map((r) => r.id);

            const acceptedReferralIds = records
              .filter((r) => r.type === "referral" && (r.status === "accepted" || r.status === "duplicate"))
              .map((r) => r.id);

            await StorageService.markRecordsAsSynced(acceptedPatientIds, acceptedReferralIds);

            const syncedCount = acceptedPatientIds.length + acceptedReferralIds.length;

            return {
              success: data.success,
              syncedCount: syncedCount,
              message: data.message || `Successfully synchronized ${syncedCount} records.`,
            };
          } else {
            return {
              success: false,
              syncedCount: 0,
              message: `${totalPending} records waiting to sync`,
              error: `Server responded with status ${pushRes.status}`,
            };
          }
        }
      } catch (e: any) {
        // Backend offline / network unreachable
        return {
          success: false,
          syncedCount: 0,
          message: `${totalPending} records waiting to sync`,
          error: e?.message || "Server unreachable",
        };
      }

      return {
        success: false,
        syncedCount: 0,
        message: `${totalPending} records waiting to sync`,
        error: "Server unreachable",
      };
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
