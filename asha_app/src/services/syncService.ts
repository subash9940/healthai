/**
 * src/services/syncService.ts
 *
 * Background & On-Demand Synchronization Service.
 * Transmits local Outbox records to Swasthya Setu FastAPI backend (/sync).
 * Gracefully handles offline / airplane mode with zero crash rate and zero fake syncs.
 */

import { StorageService } from "./storageService";
import { API_BASE_URL } from "../config";

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  pendingCount?: number;
  rejectedCount?: number;
  legacyCount?: number;
  unconfirmedCount?: number;
  message: string;
  mismatchesCount?: number;
  errorsCount?: number;
  error?: string;
}

export const SyncService = {
  async performSync(): Promise<SyncResult> {
    try {
      const [patients, referrals] = await Promise.all([
        StorageService.getAllPatientRecords(),
        StorageService.getAllReferrals(),
      ]);

      const validPendingPatients = patients.filter(
        (p) => !p.synced && Boolean(p.record_id && p.record_id.trim())
      );
      const legacyPatients = patients.filter(
        (p) => !p.synced && (!p.record_id || !p.record_id.trim())
      );
      const legacyCount = legacyPatients.length;

      const validPendingReferrals = referrals.filter(
        (r) => !r.synced && !r.is_demo && !r.referral_id.startsWith("REF-DEMO")
      );

      const totalPending = validPendingPatients.length + validPendingReferrals.length;

      if (totalPending === 0) {
        return {
          success: true,
          syncedCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          legacyCount,
          message: legacyCount > 0
            ? `All valid records synced. ${legacyCount} legacy record(s) skipped.`
            : "All records are already synced.",
        };
      }

      // Check server health with 3s timeout
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 3000);

      let isHealthy = false;
      try {
        const healthRes = await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          signal: healthController.signal,
        });
        clearTimeout(healthTimeout);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          if (healthData.status === "ok") {
            isHealthy = true;
          }
        }
      } catch (err: any) {
        clearTimeout(healthTimeout);
        return {
          success: false,
          syncedCount: 0,
          pendingCount: totalPending,
          rejectedCount: 0,
          legacyCount,
          message: "Backend server unreachable. Records remain saved in local outbox.",
          error: err?.message || "Health check failed",
        };
      }

      if (!isHealthy) {
        return {
          success: false,
          syncedCount: 0,
          pendingCount: totalPending,
          rejectedCount: 0,
          legacyCount,
          message: "Server health check failed. Records remain safely stored locally.",
        };
      }

      // Format payload for /sync endpoint
      const syncPayload = {
        patients: validPendingPatients.map((p) => ({
          record_id: p.record_id,
          patient: p.patient,
          symptoms: p.symptoms,
          vitals: p.vitals,
          triage: p.triage,
          created_at: p.created_at,
          asha_worker_id: p.asha_worker_id,
        })),
        referrals: validPendingReferrals.map((r) => ({
          referral_id: r.referral_id,
          patient_id: r.patient_id,
          patient_name: r.patient_name,
          patient_village: r.patient_village,
          patient_phone: r.patient_phone,
          patient_age: r.patient_age,
          patient_sex: r.patient_sex,
          urgency: r.urgency,
          target_facility: r.target_facility,
          status: r.status,
          status_history: r.status_history,
          symptoms: r.symptoms,
          recommended_action: r.recommended_action,
          created_at: r.created_at,
          asha_worker_id: r.asha_worker_id,
        })),
        synced_at: new Date().toISOString(),
      };

      const syncController = new AbortController();
      const syncTimeout = setTimeout(() => syncController.abort(), 10000);

      const syncRes = await fetch(`${API_BASE_URL}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncPayload),
        signal: syncController.signal,
      });
      clearTimeout(syncTimeout);

      if (!syncRes.ok) {
        const errText = await syncRes.text();
        return {
          success: false,
          syncedCount: 0,
          pendingCount: totalPending,
          rejectedCount: 0,
          legacyCount,
          message: `Server returned error (${syncRes.status}). Records preserved locally.`,
          error: errText,
        };
      }

      const data = await syncRes.json();
      const unconfirmedCount = (data.unconfirmed_referrals || []).length;
      const syncedPatientIds: string[] = (data.synced_patients || []).map(
        (sp: any) => sp.client_record_id || sp.client_patient_id
      );
      const syncedReferralIds: string[] = (data.synced_referrals || []).map(
        (sr: any) => sr.client_ref_id
      );

      // Only mark records that the server confirmed as synced
      if (syncedPatientIds.length > 0 || syncedReferralIds.length > 0) {
        await StorageService.markRecordsAsSynced(syncedPatientIds, syncedReferralIds);
      }

      const totalSynced = (data.synced_patients?.length || 0) + (data.synced_referrals?.length || 0);
      const totalErrors = data.total_errors || 0;
      const mismatchesCount = data.mismatches_count || 0;
      const remainingPending = totalPending - totalSynced;

      let message = data.success
        ? `Successfully synchronized ${totalSynced} record${totalSynced === 1 ? "" : "s"}.`
        : `Synchronized ${totalSynced} records with ${totalErrors} error(s).`;

      if (unconfirmedCount > 0) {
        message = `Synchronized ${totalSynced} record(s). ${unconfirmedCount} referral(s) could not be confirmed by the server and remain pending.`;
      }

      return {
        success: data.success && unconfirmedCount === 0,
        syncedCount: totalSynced,
        pendingCount: remainingPending > 0 ? remainingPending : 0,
        rejectedCount: totalErrors,
        legacyCount,
        unconfirmedCount,
        errorsCount: totalErrors,
        mismatchesCount: mismatchesCount,
        message,
      };
    } catch (e: any) {
      return {
        success: false,
        syncedCount: 0,
        message: "Sync error occurred. Records remain safely stored in local outbox.",
        error: e?.message || "Unknown error",
      };
    }
  },
};
