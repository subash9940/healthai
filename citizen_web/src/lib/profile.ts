export interface FacilityItem {
  id: string;
  name: string;
  level: string;
  district?: string;
  contact_phone?: string;
  lat?: number;
  lng?: number;
}

export interface JeevanyaProfile {
  name: string;
  phone: string;
  village: string;
  age?: number | null;
  sex?: 'male' | 'female' | 'other' | null;
  subcentre: {
    id: string;
    name: string;
    contact_phone: string;
    lat?: number | null;
    lng?: number | null;
  };
  coords?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  registered_at: string;
}

export interface QueuedSosAlert {
  client_alert_id: string;
  reported_at: string;
  patient_name: string;
  patient_phone: string;
  patient_village: string;
  patient_age: number | null;
  patient_sex: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  facility_id: string | null;
  channel: string;
  facility_name?: string;
  facility_phone?: string;
  queued_at: string;
}

export const PROFILE_STORAGE_KEY = 'jeevanya_profile';
export const SOS_QUEUE_STORAGE_KEY = 'jeevanya_sos_queue';

export function getStoredProfile(): JeevanyaProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProfile(profile: JeevanyaProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save profile', err);
  }
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear profile', err);
  }
}

export function getSosQueue(): QueuedSosAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SOS_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addToSosQueue(alert: QueuedSosAlert): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getSosQueue();
    if (!queue.some((item) => item.client_alert_id === alert.client_alert_id)) {
      queue.push(alert);
      localStorage.setItem(SOS_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('Failed to add to SOS queue', err);
  }
}

export function removeFromSosQueue(client_alert_id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getSosQueue().filter((item) => item.client_alert_id !== client_alert_id);
    localStorage.setItem(SOS_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to remove from SOS queue', err);
  }
}

export async function processSosQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const queue = getSosQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        removeFromSosQueue(item.client_alert_id);
      }
    } catch {
      // Still offline or timeout, will retry next time
    }
  }
}
