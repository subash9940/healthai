/**
 * analytics.ts
 * 
 * Privacy-preserving, anonymous event logger (Checklist #19).
 * Does not collect PII, IP addresses, or device fingerprints.
 */

export type TriageEvent =
  | "triage_started"
  | "step_demographics_completed"
  | "step_symptoms_completed"
  | "step_vitals_completed"
  | "triage_result_generated"
  | "audio_playback_triggered"
  | "language_changed"
  | "emergency_call_clicked"
  | "nlp_extract_complete"
  | "nlp_symptoms_confirmed";

export function trackEvent(eventName: TriageEvent, details?: Record<string, any>) {
  if (typeof window === "undefined") return;

  try {
    const timestamp = new Date().toISOString();
    const eventPayload = {
      event: eventName,
      timestamp,
      ...details,
    };

    // Store in ephemeral local log for operational monitoring (last 20 events)
    const stored = localStorage.getItem("swasthya_analytics_log");
    const logs = stored ? JSON.parse(stored) : [];
    logs.unshift(eventPayload);
    if (logs.length > 20) logs.pop();
    localStorage.setItem("swasthya_analytics_log", JSON.stringify(logs));

    // Optional console trace in development
    if (process.env.NODE_ENV !== "production") {
      console.log("[Analytics]", eventName, details);
    }
  } catch (err) {
    // Fail silently to never disrupt patient triage
  }
}
