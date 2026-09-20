'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface StaffUser {
  id: string;
  name: string;
  phone_or_username: string;
  role: string;
  facility_id: string;
  facility_name?: string;
  facility_level?: string;
}

interface SosAlertItem {
  id: string;
  client_alert_id: string;
  reported_at: string | null;
  received_at: string;
  patient_name: string;
  patient_phone: string;
  patient_village: string;
  patient_age?: number | null;
  patient_sex?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  facility_id?: string | null;
  facility_name?: string | null;
  channel: string;
  status: 'open' | 'acknowledged' | 'resolved' | string;
  repeat_count: number;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
}

interface FacilityStatus {
  facility_id: string;
  facility_name: string;
  facility_level: string;
  operational_status: 'AVAILABLE' | 'BUSY' | 'EMERGENCY_ONLY' | 'FULL';
  available_beds: number;
  status_note?: string | null;
  updated_at?: string | null;
  updated_by_staff_id?: string | null;
  updated_by_staff_name?: string | null;
}

interface ReferralItem {
  id: string;
  triage_record_id: string;
  facility_id?: string;
  facility_name?: string;
  facility_level?: string;
  created_by_role?: string;
  state: 'created' | 'in_transit' | 'received_at_facility' | 'closed' | string;
  created_at: string;
  updated_at: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_age_years?: number;
  patient_sex?: string;
  patient_village?: string;
  urgency: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
  rule_name: string;
  symptoms: string[];
  vitals?: Record<string, any> | null;
  recommended_action?: string;
  citizen_message?: string;
  requires_referral: boolean;
  referral_target_level?: string;
}

// Clean translucent SVG Eye icons
function EyeIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.6, ...style }}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.6, ...style }}
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default function FacilityDashboard() {
  // Auth state
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [username, setUsername] = useState('');
  const [mpin, setMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign Up Form state
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupRole, setSignupRole] = useState('medical_officer');
  const [signupFacilityId, setSignupFacilityId] = useState('');
  const [signupMpin, setSignupMpin] = useState('');
  const [signupConfirmMpin, setSignupConfirmMpin] = useState('');
  const [showSignupMpin, setShowSignupMpin] = useState(false);
  const [facilitiesList, setFacilitiesList] = useState<{ id: string; name: string; level: string; district?: string }[]>([]);
  const [signupLoading, setSignupLoading] = useState(false);

  // Queue state
  const [queue, setQueue] = useState<ReferralItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [selectedItem, setSelectedItem] = useState<ReferralItem | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  // Facility Operational Status & Bed Capacity state
  const [facilityStatus, setFacilityStatus] = useState<FacilityStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [editStatus, setEditStatus] = useState<'AVAILABLE' | 'BUSY' | 'EMERGENCY_ONLY' | 'FULL'>('AVAILABLE');
  const [editBeds, setEditBeds] = useState<number>(10);
  const [editNote, setEditNote] = useState<string>('');
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  // SOS Alerts state
  const [sosAlerts, setSosAlerts] = useState<SosAlertItem[]>([]);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosError, setSosError] = useState('');
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [sosActionLoading, setSosActionLoading] = useState<string | null>(null);

  const openSosCount = sosAlerts.filter((a) => a.status === 'open').length;

  // Check saved session & fetch facility directory on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('swasthya_facility_token');
      const savedStaff = localStorage.getItem('swasthya_facility_staff');
      if (savedToken && savedStaff) {
        setToken(savedToken);
        setStaff(JSON.parse(savedStaff));
      }
    } catch {
      // ignore
    }

    // Fetch facilities for registration dropdown
    fetch('/api/facility/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setFacilitiesList(data);
          if (!signupFacilityId) {
            setSignupFacilityId(data[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch referrals for authenticated facility
  const fetchReferrals = useCallback(async (authToken: string) => {
    setLoadingQueue(true);
    setQueueError('');
    try {
      const res = await fetch('/api/facility/referrals', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        // Token expired or invalid
        handleLogout();
        setLoginError('Session expired. Please sign in again.');
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `Error ${res.status}`);
      }

      const data: ReferralItem[] = await res.json();
      setQueue(data);
    } catch (err: any) {
      setQueueError(err?.message || 'Failed to load referrals');
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Fetch facility operational status
  const fetchFacilityStatus = useCallback(async (authToken: string) => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/facility/status', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data: FacilityStatus = await res.json();
        setFacilityStatus(data);
        setEditStatus(data.operational_status);
        setEditBeds(data.available_beds);
        setEditNote(data.status_note || '');
      }
    } catch {
      // ignore
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Fetch facility SOS alerts
  const fetchSosAlerts = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/facility/sos', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSosAlerts(data);
          setSosError('');
        }
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
        setLoginError('Session expired - please log in again');
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        setSosError(errData?.error || 'Failed to fetch SOS alerts');
      }
    } catch (err: any) {
      setSosError('SOS service unavailable');
    }
  }, []);

  // When token is set, fetch queue, facility status & start SOS polling
  useEffect(() => {
    if (token) {
      fetchReferrals(token);
      fetchFacilityStatus(token);
      fetchSosAlerts(token);

      const interval = setInterval(() => {
        fetchSosAlerts(token);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [token, fetchReferrals, fetchFacilityStatus, fetchSosAlerts]);

  // Handle SOS Alert Acknowledge
  const handleAcknowledgeSos = async (alertId: string) => {
    if (!token) return;
    setSosActionLoading(alertId);
    try {
      const res = await fetch(`/api/facility/sos/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 409) {
        setActionMessage({ text: 'SOS alert already handled by another user', type: 'error' });
        await fetchSosAlerts(token);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to acknowledge alert');
      }

      setActionMessage({ text: '✓ SOS alert acknowledged', type: 'success' });
      await fetchSosAlerts(token);
    } catch (err: any) {
      setActionMessage({ text: `Error acknowledging alert: ${err?.message}`, type: 'error' });
    } finally {
      setSosActionLoading(null);
    }
  };

  // Handle SOS Alert Resolve
  const handleResolveSos = async (alertId: string) => {
    if (!token) return;
    setSosActionLoading(alertId);
    try {
      const res = await fetch(`/api/facility/sos/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: resolveNotes.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        setActionMessage({ text: 'SOS alert already handled by another user', type: 'error' });
        setResolvingAlertId(null);
        setResolveNotes('');
        await fetchSosAlerts(token);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to resolve alert');
      }

      setActionMessage({ text: '✓ SOS alert resolved', type: 'success' });
      setResolvingAlertId(null);
      setResolveNotes('');
      await fetchSosAlerts(token);
    } catch (err: any) {
      setActionMessage({ text: `Error resolving alert: ${err?.message}`, type: 'error' });
    } finally {
      setSosActionLoading(null);
    }
  };

  const handleUpdateFacilityStatus = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) return;
    setStatusUpdating(true);
    try {
      const res = await fetch('/api/facility/status', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operational_status: editStatus,
          available_beds: Number(editBeds),
          status_note: editNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to update facility status');
      }

      setFacilityStatus(data);
      setIsEditingStatus(false);
      setActionMessage({ text: `✓ Facility availability status updated to ${editStatus} (${editBeds} beds)`, type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: `Error updating status: ${err?.message}`, type: 'error' });
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle Staff Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !mpin.trim()) {
      setLoginError('Please enter both username/phone and MPIN.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/facility/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_or_username: username.trim(),
          mpin: mpin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Authentication failed');
      }

      setToken(data.access_token);
      setStaff(data.staff);
      localStorage.setItem('swasthya_facility_token', data.access_token);
      localStorage.setItem('swasthya_facility_staff', JSON.stringify(data.staff));
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Staff Registration (Sign Up)
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setLoginError('Please enter your full name.');
      return;
    }
    if (!signupPhone.trim()) {
      setLoginError('Please enter your mobile number or username.');
      return;
    }
    if (!signupFacilityId) {
      setLoginError('Please select your assigned healthcare facility.');
      return;
    }
    if (signupMpin.trim().length !== 4 || !/^\d+$/.test(signupMpin.trim())) {
      setLoginError('MPIN must be exactly 4 numeric digits.');
      return;
    }
    if (signupMpin !== signupConfirmMpin) {
      setLoginError('PIN confirmation does not match. Please re-enter.');
      return;
    }

    setSignupLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/facility/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName.trim(),
          phone_or_username: signupPhone.trim(),
          mpin: signupMpin.trim(),
          role: signupRole,
          facility_id: signupFacilityId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Registration failed');
      }

      setToken(data.access_token);
      setStaff(data.staff);
      localStorage.setItem('swasthya_facility_token', data.access_token);
      localStorage.setItem('swasthya_facility_staff', JSON.stringify(data.staff));
    } catch (err: any) {
      setLoginError(err?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setSignupLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setToken(null);
    setStaff(null);
    setQueue([]);
    setSelectedItem(null);
    localStorage.removeItem('swasthya_facility_token');
    localStorage.removeItem('swasthya_facility_staff');
  };

  // Action: Accept Referral (created -> in_transit)
  const handleAcceptReferral = async (item: ReferralItem) => {
    if (!token) return;
    setActionLoading(item.id);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/facility/referrals/${item.id}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: `Referral accepted by ${staff?.name || 'Staff'}` }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to accept referral');
      }

      setActionMessage({ text: `✓ Referral ${item.id.slice(0, 8)} accepted (In Transit)`, type: 'success' });
      await fetchReferrals(token);
    } catch (err: any) {
      setActionMessage({ text: `Error: ${err?.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Mark Received at Facility
  const handleMarkReceived = async (item: ReferralItem) => {
    if (!token) return;
    setActionLoading(item.id);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/facility/referrals/${item.id}/receive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: `Received at facility by ${staff?.name || 'Staff'}` }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to mark received');
      }

      setActionMessage({ text: `✓ Referral ${item.id.slice(0, 8)} marked as Received at Facility`, type: 'success' });
      await fetchReferrals(token);
    } catch (err: any) {
      setActionMessage({ text: `Error: ${err?.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Close Referral
  const handleCloseReferral = async (item: ReferralItem) => {
    if (!token) return;
    setActionLoading(item.id);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/facility/referrals/${item.id}/close`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: `Referral treated and closed by ${staff?.name || 'Doctor'}` }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to close referral');
      }

      setActionMessage({ text: `✓ Referral ${item.id.slice(0, 8)} successfully closed`, type: 'success' });
      await fetchReferrals(token);
    } catch (err: any) {
      setActionMessage({ text: `Error: ${err?.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredQueue = queue.filter((item) => (filter === 'ALL' ? true : item.urgency === filter));

  const formatTimeAgo = (isoDateString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoDateString);
      const diffMs = Math.max(0, now.getTime() - past.getTime());
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins === 1) return '1 min ago';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      const diffDays = Math.floor(diffHours / 24);
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } catch {
      return isoDateString;
    }
  };

  const getReportedEarlierDiffMins = (reportedAt: string | null | undefined, receivedAt: string) => {
    if (!reportedAt || !reportedAt.trim()) return 0;
    try {
      const rep = new Date(reportedAt).getTime();
      const rec = new Date(receivedAt).getTime();
      if (isNaN(rep) || isNaN(rec)) return 0;
      const diffMs = rec - rep;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins > 1 && diffMins <= 24 * 60) {
        return diffMins;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  const handleCopyFhir = (item: ReferralItem) => {
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: item.id,
      timestamp: item.created_at,
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: item.patient_id || 'pat-1',
            name: [{ text: item.patient_name || 'Citizen Patient' }],
            telecom: [{ system: 'phone', value: item.patient_phone || 'N/A' }],
          },
        },
        {
          resource: {
            resourceType: 'ServiceRequest',
            id: `sr-${item.id.slice(0, 8)}`,
            status: item.state === 'closed' ? 'completed' : item.state === 'received_at_facility' ? 'in-progress' : 'active',
            intent: 'order',
            priority: item.urgency.toLowerCase(),
            code: {
              coding: [{ system: 'http://nhm.gov.in/protocols', code: item.rule_name }],
            },
            performer: [{ display: item.facility_name || staff?.facility_name || 'Facility' }],
          },
        },
      ],
    };

    navigator.clipboard.writeText(JSON.stringify(fhirBundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentYear = new Date().getFullYear();

  // If not logged in, render the Facility Staff Auth Gate (Sign In / Sign Up)
  if (!token || !staff) {
    return (
      <main className="page-container" style={{ maxWidth: '520px', marginTop: '30px', marginBottom: '40px' }}>
        <div className="form-card" style={{ padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: 'var(--primary-light)',
                color: 'var(--primary-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 12px',
              }}
            >
              🏥
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)' }}>
              Facility Staff Portal
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Authenticated gateway for PHC / CHC Medical Officers & Clinical Staff
            </p>
          </div>

          {/* Sign In vs Sign Up Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-subtle)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              border: '1px solid var(--border-light)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAuthTab('signin');
                setLoginError('');
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background: authTab === 'signin' ? '#ffffff' : 'transparent',
                color: authTab === 'signin' ? 'var(--primary-dark)' : 'var(--text-muted)',
                boxShadow: authTab === 'signin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                setLoginError('');
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background: authTab === 'signup' ? '#ffffff' : 'transparent',
                color: authTab === 'signup' ? 'var(--primary-dark)' : 'var(--text-muted)',
                boxShadow: authTab === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              Register / Sign Up
            </button>
          </div>

          {loginError && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--urgency-emergency-bg)',
                border: '1px solid var(--urgency-emergency-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--urgency-emergency)',
                fontSize: '13px',
                marginBottom: '20px',
                fontWeight: 500,
              }}
            >
              ⚠️ {loginError}
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {authTab === 'signin' ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    marginBottom: '6px',
                  }}
                >
                  Staff Phone / Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543201 or doc_shirur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-body)',
                    }}
                  >
                    4-Digit Security MPIN
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showMpin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={mpin}
                    onChange={(e) => setMpin(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 42px 10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '16px',
                      letterSpacing: showMpin ? '2px' : '4px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMpin(!showMpin)}
                    aria-label={showMpin ? 'Hide PIN' : 'Show PIN'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showMpin ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  opacity: loginLoading ? 0.7 : 1,
                }}
              >
                {loginLoading ? 'Authenticating...' : 'Sign In to Facility Dashboard'}
              </button>

              {/* Demo Quick Logins */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
                  Demo Authorized Accounts (One-Click Test):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('9876543201');
                      setMpin('1234');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: '#ffffff',
                      border: '1px solid var(--border-light)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    🏥 <strong>PHC Shirur:</strong> Dr. Amit (<code>9876543201</code> / PIN: <code>1234</code>)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('9876543202');
                      setMpin('1234');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: '#ffffff',
                      border: '1px solid var(--border-light)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    🏥 <strong>CHC Haveli:</strong> Dr. Priya (<code>9876543202</code> / PIN: <code>1234</code>)
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* TAB 2: SIGN UP / REGISTRATION FORM */
            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    marginBottom: '6px',
                  }}
                >
                  Full Name & Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sneha Kulkarni"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    marginBottom: '6px',
                  }}
                >
                  Mobile Number / Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9823001122"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    marginBottom: '6px',
                  }}
                >
                  Staff Role
                </label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  <option value="medical_officer">Medical Officer (MO / Doctor)</option>
                  <option value="phc_staff">Staff Nurse / Clinical Staff</option>
                  <option value="admin">Facility Administrator</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-body)',
                    marginBottom: '6px',
                  }}
                >
                  Assigned Healthcare Facility
                </label>
                <select
                  value={signupFacilityId}
                  onChange={(e) => setSignupFacilityId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  {facilitiesList.length > 0 ? (
                    facilitiesList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.level.toUpperCase()})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="e0a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4">PHC Shirur (प्राथमिक आरोग्य केंद्र)</option>
                      <option value="f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d">CHC Haveli (सामुदायिक आरोग्य केंद्र)</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-body)',
                      marginBottom: '6px',
                    }}
                  >
                    4-Digit MPIN
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSignupMpin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="••••"
                      value={signupMpin}
                      onChange={(e) => setSignupMpin(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        fontSize: '15px',
                        letterSpacing: showSignupMpin ? '2px' : '3px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupMpin(!showSignupMpin)}
                      aria-label={showSignupMpin ? 'Hide PIN' : 'Show PIN'}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {showSignupMpin ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-body)',
                      marginBottom: '6px',
                    }}
                  >
                    Confirm MPIN
                  </label>
                  <input
                    type={showSignupMpin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={signupConfirmMpin}
                    onChange={(e) => setSignupConfirmMpin(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '15px',
                      letterSpacing: showSignupMpin ? '2px' : '3px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: signupLoading ? 'not-allowed' : 'pointer',
                  opacity: signupLoading ? 0.7 : 1,
                }}
              >
                {signupLoading ? 'Registering Account...' : 'Create Staff Account & Enter Portal'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
            <Link href="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              ← Return to Citizen Triage (No Login Required)
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Logged-in Facility Dashboard View
  return (
    <main className="page-container" style={{ maxWidth: '1100px' }}>
      {/* Facility Header Card */}
      <div className="form-card" style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏥</span>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                {staff.facility_name || 'Assigned Facility'}
              </h1>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: 'var(--primary-light)',
                  color: 'var(--primary-dark)',
                }}
              >
                {staff.facility_level || 'PHC'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Logged in as: <strong>{staff.name}</strong> ({staff.role}) • Scoped to Facility ID:{' '}
              <code style={{ fontSize: '11px' }}>{staff.facility_id.slice(0, 8)}...</code>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => fetchReferrals(token)}
              disabled={loadingQueue}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '13px' }}
            >
              {loadingQueue ? '⏳ Refreshing...' : '🔄 Refresh Queue'}
            </button>
            <Link href="/" className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
              + Citizen Triage
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-secondary"
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                color: 'var(--urgency-emergency)',
                borderColor: 'var(--urgency-emergency-border)',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Action toast feedback */}
        {actionMessage && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
              background:
                actionMessage.type === 'success' ? 'var(--urgency-low-bg)' : 'var(--urgency-emergency-bg)',
              color:
                actionMessage.type === 'success' ? 'var(--urgency-low)' : 'var(--urgency-emergency)',
              border: `1px solid ${
                actionMessage.type === 'success'
                  ? 'var(--urgency-low-border)'
                  : 'var(--urgency-emergency-border)'
              }`,
            }}
          >
            {actionMessage.text}
          </div>
        )}

        {/* SOS Emergency Alerts Section */}
        <div
          style={{
            background: openSosCount > 0 ? '#fef2f2' : '#ffffff',
            borderRadius: 'var(--radius-sm)',
            border: openSosCount > 0 ? '2px solid #ef4444' : '1px solid var(--border-medium)',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🚨</span>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  margin: 0,
                  color: openSosCount > 0 ? '#b91c1c' : 'var(--text-dark)',
                }}
              >
                Emergency SOS Alerts
              </h2>
              {openSosCount > 0 && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {openSosCount} OPEN
                </span>
              )}
            </div>
            {sosError && (
              <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                {sosError}
              </span>
            )}
          </div>

          {openSosCount > 0 && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #f87171',
                borderRadius: 'var(--radius-xs)',
                padding: '10px 14px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#991b1b',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              <span>⚠️</span>
              <span>
                Active emergency distress alerts require immediate triage and attention ({openSosCount} open).
              </span>
            </div>
          )}

          {sosAlerts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--text-muted)',
                fontSize: '13px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              No active or past SOS alerts for this facility.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sosAlerts.map((alert) => {
                const isAlertOpen = alert.status === 'open';
                const isAlertAck = alert.status === 'acknowledged';
                const isAlertResolved = alert.status === 'resolved';
                const earlierDiff = getReportedEarlierDiffMins(alert.reported_at, alert.received_at);
                const isActioning = sosActionLoading === alert.id;

                return (
                  <div
                    key={alert.id}
                    style={{
                      border: isAlertOpen
                        ? '1.5px solid #ef4444'
                        : isAlertAck
                        ? '1.5px solid #f59e0b'
                        : '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-xs)',
                      background: isAlertOpen ? '#fff5f5' : '#ffffff',
                      padding: '14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-dark)' }}>
                            {alert.patient_name || 'Anonymous Citizen'}
                          </span>
                          {/* Unrouted badge */}
                          {!alert.facility_id && (
                            <span
                              style={{
                                background: '#374151',
                                color: '#ffffff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 800,
                              }}
                            >
                              UNROUTED
                            </span>
                          )}
                          {/* Repeat distress count badge */}
                          {alert.repeat_count > 1 && (
                            <span
                              style={{
                                background: '#dc2626',
                                color: '#ffffff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 800,
                              }}
                            >
                              Tapped {alert.repeat_count} times
                            </span>
                          )}
                          {/* Status badge */}
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              background: isAlertOpen
                                ? '#fee2e2'
                                : isAlertAck
                                ? '#fef3c7'
                                : '#dcfce7',
                              color: isAlertOpen
                                ? '#b91c1c'
                                : isAlertAck
                                ? '#92400e'
                                : '#166534',
                            }}
                          >
                            {alert.status}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '3px',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {alert.patient_village && <span>Village: <strong>{alert.patient_village}</strong></span>}
                          {(alert.patient_age !== undefined && alert.patient_age !== null) && (
                            <span>Age: <strong>{alert.patient_age}</strong></span>
                          )}
                          {alert.patient_sex && <span>Sex: <strong>{alert.patient_sex}</strong></span>}
                          {alert.patient_phone && (
                            <span>
                              Phone:{' '}
                              <a
                                href={`tel:${alert.patient_phone}`}
                                style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}
                              >
                                {alert.patient_phone}
                              </a>
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div>Received: <strong>{formatTimeAgo(alert.received_at)}</strong></div>
                        {earlierDiff > 0 && (
                          <div style={{ color: '#d97706', fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>
                            (reported {earlierDiff} min earlier)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location link if lat/lng */}
                    {alert.lat !== undefined && alert.lat !== null && alert.lng !== undefined && alert.lng !== null && (
                      <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                        📍{' '}
                        <a
                          href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}
                        >
                          View Patient Coordinates on Google Maps ({alert.lat.toFixed(4)}, {alert.lng.toFixed(4)})
                        </a>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      {isAlertOpen && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeSos(alert.id)}
                          disabled={isActioning}
                          style={{
                            padding: '6px 14px',
                            background: '#f59e0b',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: isActioning ? 'not-allowed' : 'pointer',
                            opacity: isActioning ? 0.7 : 1,
                          }}
                        >
                          {isActioning ? 'Acknowledging...' : 'Acknowledge SOS'}
                        </button>
                      )}

                      {(isAlertOpen || isAlertAck) && (
                        <>
                          {resolvingAlertId === alert.id ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', marginTop: '6px' }}>
                              <input
                                type="text"
                                placeholder="Resolution notes (optional)..."
                                value={resolveNotes}
                                onChange={(e) => setResolveNotes(e.target.value)}
                                style={{
                                  flex: 1,
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: 'var(--radius-xs)',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleResolveSos(alert.id)}
                                disabled={isActioning}
                                style={{
                                  padding: '6px 14px',
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 'var(--radius-xs)',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: isActioning ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {isActioning ? 'Saving...' : 'Confirm Resolve'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResolvingAlertId(null);
                                  setResolveNotes('');
                                }}
                                style={{
                                  padding: '6px 10px',
                                  background: 'var(--bg-subtle)',
                                  color: 'var(--text-dark)',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: 'var(--radius-xs)',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingAlertId(alert.id);
                                setResolveNotes('');
                              }}
                              disabled={isActioning}
                              style={{
                                padding: '6px 14px',
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: isActioning ? 'not-allowed' : 'pointer',
                                opacity: isActioning ? 0.7 : 1,
                              }}
                            >
                              Resolve
                            </button>
                          )}
                        </>
                      )}

                      {isAlertResolved && (
                        <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                          ✓ Resolved {alert.resolved_at ? formatTimeAgo(alert.resolved_at) : ''}
                          {alert.resolution_notes ? ` (${alert.resolution_notes})` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Facility Operational Availability & Bed Capacity Panel */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-medium)',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: isEditingStatus ? '16px' : '0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Operational Status
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 800,
                      background:
                        facilityStatus?.operational_status === 'AVAILABLE'
                          ? 'var(--urgency-low-bg)'
                          : facilityStatus?.operational_status === 'BUSY'
                          ? 'var(--urgency-high-bg)'
                          : facilityStatus?.operational_status === 'EMERGENCY_ONLY'
                          ? 'var(--urgency-medium-bg)'
                          : 'var(--urgency-emergency-bg)',
                      color:
                        facilityStatus?.operational_status === 'AVAILABLE'
                          ? 'var(--urgency-low)'
                          : facilityStatus?.operational_status === 'BUSY'
                          ? 'var(--urgency-high)'
                          : facilityStatus?.operational_status === 'EMERGENCY_ONLY'
                          ? 'var(--urgency-medium)'
                          : 'var(--urgency-emergency)',
                      border: `1px solid ${
                        facilityStatus?.operational_status === 'AVAILABLE'
                          ? 'var(--urgency-low-border)'
                          : facilityStatus?.operational_status === 'BUSY'
                          ? 'var(--urgency-high-border)'
                          : facilityStatus?.operational_status === 'EMERGENCY_ONLY'
                          ? 'var(--urgency-medium-border)'
                          : 'var(--urgency-emergency-border)'
                      }`,
                    }}
                  >
                    <span>
                      {facilityStatus?.operational_status === 'AVAILABLE'
                        ? '🟢'
                        : facilityStatus?.operational_status === 'BUSY'
                        ? '🟡'
                        : facilityStatus?.operational_status === 'EMERGENCY_ONLY'
                        ? '🟠'
                        : '🔴'}
                    </span>
                    {facilityStatus?.operational_status || 'AVAILABLE'}
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    🛏️ {facilityStatus?.available_beds ?? 10} Available Beds
                  </span>
                </div>
              </div>

              {facilityStatus?.status_note && (
                <div style={{ marginLeft: '8px', borderLeft: '2px solid var(--border-medium)', paddingLeft: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    Facility Broadcast Note
                  </span>
                  <p style={{ fontSize: '13px', color: 'var(--text-dark)', margin: '4px 0 0', fontWeight: 500 }}>
                    "{facilityStatus.status_note}"
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {facilityStatus?.updated_at && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Updated: {new Date(facilityStatus.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                  {facilityStatus.updated_by_staff_name ? `by ${facilityStatus.updated_by_staff_name}` : ''}
                </span>
              )}
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', minHeight: 'auto' }}
                onClick={() => setIsEditingStatus(!isEditingStatus)}
              >
                {isEditingStatus ? 'Cancel Edit' : '✏️ Update Availability'}
              </button>
            </div>
          </div>

          {/* Quick Edit Drawer */}
          {isEditingStatus && (
            <form
              onSubmit={handleUpdateFacilityStatus}
              style={{
                marginTop: '12px',
                paddingTop: '16px',
                borderTop: '1px dashed var(--border-medium)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                {/* Status Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
                    Operational Availability Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: '#ffffff',
                    }}
                  >
                    <option value="AVAILABLE">🟢 AVAILABLE — Normal Operations</option>
                    <option value="BUSY">🟡 BUSY — High Load / Minor Delays</option>
                    <option value="EMERGENCY_ONLY">🟠 EMERGENCY ONLY — Critical Cases Only</option>
                    <option value="FULL">🔴 FULL — Divert Routine Admissions</option>
                  </select>
                </div>

                {/* Beds input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
                    Available Inpatient Beds
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setEditBeds(Math.max(0, editBeds - 1))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        background: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={editBeds}
                      onChange={(e) => setEditBeds(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setEditBeds(editBeds + 1)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-medium)',
                        background: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Broadcast Note */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-body)', marginBottom: '6px' }}>
                    Public Broadcast Note for ASHA &amp; Field Workers (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oxygen beds ready, ultrasound on duty until 5 PM, MO in OT"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    maxLength={200}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '13px',
                      background: '#ffffff',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditingStatus(false)}
                  style={{ padding: '6px 14px', fontSize: '12px', minHeight: 'auto' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusUpdating}
                  className="btn-primary"
                  style={{ padding: '6px 16px', fontSize: '12px', minHeight: 'auto' }}
                >
                  {statusUpdating ? 'Saving...' : '💾 Save Availability Status'}
                </button>
              </div>
            </form>
          )}
        </div>

        {queueError && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              marginBottom: '16px',
              background: 'var(--urgency-emergency-bg)',
              color: 'var(--urgency-emergency)',
            }}
          >
            ⚠️ {queueError}
          </div>
        )}

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
          {(['ALL', 'EMERGENCY', 'HIGH', 'MEDIUM', 'LOW'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`cat-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f} ({f === 'ALL' ? queue.length : queue.filter((q) => q.urgency === f).length})
            </button>
          ))}
        </div>

        {/* Referrals Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Time &amp; Referral ID</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Patient Details</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Urgency</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Protocol / Symptoms</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingQueue ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading incoming referrals for this facility...
                  </td>
                </tr>
              ) : filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No triage referrals found for {filter !== 'ALL' ? `urgency [${filter}]` : 'this facility'}.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: selectedItem?.id === item.id ? 'var(--primary-light)' : 'transparent',
                    }}
                  >
                    {/* Time & ID */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '12px' }}>
                        {item.id.slice(0, 8)}...
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      {item.created_by_role && (
                        <div style={{ fontSize: '10px', color: 'var(--primary-dark)', fontWeight: 600 }}>
                          By: {item.created_by_role.toUpperCase()}
                        </div>
                      )}
                    </td>

                    {/* Patient */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700 }}>{item.patient_name || 'Citizen Patient'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.patient_age_years ? `${item.patient_age_years}y` : ''}
                        {item.patient_sex ? ` • ${item.patient_sex.toUpperCase()}` : ''}
                        {item.patient_village ? ` • ${item.patient_village}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>
                        {item.patient_phone && item.patient_phone !== 'N/A' ? (
                          <a href={`tel:${item.patient_phone}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            📞 {item.patient_phone}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>No phone</span>
                        )}
                      </div>
                    </td>

                    {/* Urgency */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background:
                            item.urgency === 'EMERGENCY'
                              ? 'var(--urgency-emergency-bg)'
                              : item.urgency === 'HIGH'
                              ? 'var(--urgency-high-bg)'
                              : item.urgency === 'MEDIUM'
                              ? 'var(--urgency-medium-bg)'
                              : 'var(--urgency-low-bg)',
                          color:
                            item.urgency === 'EMERGENCY'
                              ? 'var(--urgency-emergency)'
                              : item.urgency === 'HIGH'
                              ? 'var(--urgency-high)'
                              : item.urgency === 'MEDIUM'
                              ? 'var(--urgency-medium)'
                              : 'var(--urgency-low)',
                        }}
                      >
                        {item.urgency}
                      </span>
                    </td>

                    {/* Rule / Symptoms */}
                    <td style={{ padding: '12px 14px', maxWidth: '240px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}>
                        {item.rule_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.symptoms.slice(0, 3).join(', ')}
                        {item.symptoms.length > 3 ? ` +${item.symptoms.length - 3}` : ''}
                      </div>
                    </td>

                    {/* State */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          background:
                            item.state === 'closed'
                              ? '#e2e8f0'
                              : item.state === 'received_at_facility'
                              ? 'var(--primary-light)'
                              : item.state === 'in_transit'
                              ? '#fef08a'
                              : '#fed7aa',
                          color:
                            item.state === 'closed'
                              ? '#475569'
                              : item.state === 'received_at_facility'
                              ? 'var(--primary-darker)'
                              : item.state === 'in_transit'
                              ? '#854d0e'
                              : '#9a3412',
                        }}
                      >
                        {item.state.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Transition Action 1: Mark Received */}
                        {item.state === 'in_transit' && (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={actionLoading === item.id}
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              minHeight: 'auto',
                              background: 'var(--primary)',
                            }}
                            onClick={() => handleMarkReceived(item)}
                          >
                            {actionLoading === item.id ? 'Updating...' : '📥 Mark Received'}
                          </button>
                        )}

                        {/* Transition Action 2: Close Referral */}
                        {item.state === 'received_at_facility' && (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={actionLoading === item.id}
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              minHeight: 'auto',
                              background: '#16a34a',
                              borderColor: '#16a34a',
                            }}
                            onClick={() => handleCloseReferral(item)}
                          >
                            {actionLoading === item.id ? 'Updating...' : '✅ Close Referral'}
                          </button>
                        )}

                        {item.state === 'created' && (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={actionLoading === item.id}
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              minHeight: 'auto',
                              background: 'var(--primary)',
                            }}
                            onClick={() => handleAcceptReferral(item)}
                          >
                            {actionLoading === item.id ? 'Updating...' : '📥 Accept Referral'}
                          </button>
                        )}

                        {item.state === 'closed' && (
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                            ✓ Closed
                          </span>
                        )}

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '11px', minHeight: 'auto' }}
                          onClick={() => setSelectedItem(item)}
                        >
                          FHIR
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FHIR Details Drawer / Modal */}
        {selectedItem && (
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700 }}>
                FHIR R4 Referral Bundle: {selectedItem.id} ({selectedItem.patient_name})
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px', minHeight: 'auto' }}
                  onClick={() => handleCopyFhir(selectedItem)}
                >
                  {copied ? '✓ Copied JSON' : '📋 Copy FHIR JSON'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px', minHeight: 'auto' }}
                  onClick={() => setSelectedItem(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <pre
              style={{
                fontSize: '12px',
                background: '#0f172a',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(
                {
                  resourceType: 'Bundle',
                  type: 'transaction',
                  id: selectedItem.id,
                  timestamp: selectedItem.created_at,
                  patient: {
                    id: selectedItem.patient_id,
                    name: selectedItem.patient_name,
                    phone: selectedItem.patient_phone,
                    village: selectedItem.patient_village,
                    age: selectedItem.patient_age_years,
                    sex: selectedItem.patient_sex,
                  },
                  referral: {
                    status: selectedItem.state,
                    urgency: selectedItem.urgency,
                    rule: selectedItem.rule_name,
                    facility: selectedItem.facility_name || staff.facility_name,
                    facility_level: selectedItem.facility_level || staff.facility_level,
                    created_by_role: selectedItem.created_by_role,
                    symptoms: selectedItem.symptoms,
                    vitals: selectedItem.vitals,
                    action: selectedItem.recommended_action,
                  },
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ fontWeight: 600 }}>← Back to Citizen Triage</Link> • Swasthya Setu © {currentYear}
      </div>
    </main>
  );
}
