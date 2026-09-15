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

function EyeIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.7, ...style }}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.7, ...style }}
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
  const [signupRole, setSignupRole] = useState('phc_staff');
  const [signupFacilityId, setSignupFacilityId] = useState('');
  const [signupMpin, setSignupMpin] = useState('');
  const [signupConfirmMpin, setSignupConfirmMpin] = useState('');
  const [showSignupMpin, setShowSignupMpin] = useState(false);
  const [showSignupConfirmMpin, setShowSignupConfirmMpin] = useState(false);
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

  // When token is set, fetch queue & facility status
  useEffect(() => {
    if (token) {
      fetchReferrals(token);
      fetchFacilityStatus(token);
    }
  }, [token, fetchReferrals, fetchFacilityStatus]);

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
      setActionMessage({ text: `✓ Facility status updated: ${editStatus} (${editBeds} beds)`, type: 'success' });
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

  // Handle Staff Registration
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

  // Action: Mark Received at Facility (in_transit -> received_at_facility)
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

  // Action: Close Referral (received_at_facility -> closed)
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

  const countEmergency = queue.filter((i) => i.urgency === 'EMERGENCY').length;
  const countHigh = queue.filter((i) => i.urgency === 'HIGH').length;
  const countMedium = queue.filter((i) => i.urgency === 'MEDIUM').length;
  const countLow = queue.filter((i) => i.urgency === 'LOW').length;

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

  const getUrgencyTheme = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY':
        return {
          stripe: '#C7372F',
          bg: '#FEF2F2',
          text: '#991B1B',
          border: '#FECACA',
          label: 'EMERGENCY',
        };
      case 'HIGH':
        return {
          stripe: '#D97706',
          bg: '#FFFBEB',
          text: '#92400E',
          border: '#FDE68A',
          label: 'HIGH PRIORITY',
        };
      case 'MEDIUM':
        return {
          stripe: '#CA8A04',
          bg: '#FEFCE8',
          text: '#854D0E',
          border: '#FEF08A',
          label: 'MEDIUM',
        };
      case 'LOW':
      default:
        return {
          stripe: '#2F7D5D',
          bg: '#F0FDF4',
          text: '#166534',
          border: '#BBF7D0',
          label: 'LOW URGENCY',
        };
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'created':
        return {
          label: 'Awaiting Transit',
          bg: '#F1F5F9',
          text: '#475569',
          border: '#CBD5E1',
        };
      case 'in_transit':
        return {
          label: 'In Transit',
          bg: '#EFF6FF',
          text: '#1D4ED8',
          border: '#BFDBFE',
        };
      case 'received_at_facility':
        return {
          label: 'Arrived at Facility',
          bg: '#ECFDF5',
          text: '#047857',
          border: '#A7F3D0',
        };
      case 'closed':
        return {
          label: 'Closed / Treated',
          bg: '#F8FAFC',
          text: '#64748B',
          border: '#E2E8F0',
        };
      default:
        return {
          label: state,
          bg: '#F1F5F9',
          text: '#475569',
          border: '#CBD5E1',
        };
    }
  };

  // --------------------------------------------------------------------------
  // UNAUTHENTICATED VIEW: SIGN IN & SIGN UP (ORIGINAL WEB DESIGN)
  // --------------------------------------------------------------------------
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
                padding: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                color: '#991b1b',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {loginError}
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {authTab === 'signin' ? (
            <form onSubmit={handleLogin}>
              {/* Quick Preset Selector for Demo/Testing */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Quick Staff Select (Demo Logins)
                </label>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {[
                    { label: 'Dr. Sharma (MO)', phone: '9876543210', pin: '1234' },
                    { label: 'Sister Anita (Staff)', phone: '9876543211', pin: '1234' },
                    { label: 'Admin Patil (Super)', phone: '9876543212', pin: '1234' },
                  ].map((p) => (
                    <button
                      key={p.phone}
                      type="button"
                      onClick={() => {
                        setUsername(p.phone);
                        setMpin(p.pin);
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-dark)',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Phone Number or Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. 9876543210 or dr_sharma"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>4-Digit MPIN</label>
                  <button
                    type="button"
                    onClick={() => setShowMpin(!showMpin)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showMpin ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showMpin ? 'text' : 'password'}
                  maxLength={4}
                  value={mpin}
                  onChange={(e) => setMpin(e.target.value)}
                  placeholder="••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '18px',
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  opacity: loginLoading ? 0.7 : 1,
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {loginLoading ? 'Authenticating...' : 'Sign In to Referral Queue'}
              </button>
            </form>
          ) : (
            /* TAB 2: SIGN UP / REGISTRATION FORM */
            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Full Official Name
                </label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Cadre Role
                </label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                >
                  <option value="phc_staff">PHC Staff / Medical Officer</option>
                  <option value="supervisor">Supervisor / Admin</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Assigned Health Facility
                </label>
                <select
                  value={signupFacilityId}
                  onChange={(e) => setSignupFacilityId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                >
                  {facilitiesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.level}){f.district ? ` - ${f.district}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Create 4-Digit MPIN</label>
                  <button
                    type="button"
                    onClick={() => setShowSignupMpin(!showSignupMpin)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showSignupMpin ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSignupMpin ? 'text' : 'password'}
                  maxLength={4}
                  value={signupMpin}
                  onChange={(e) => setSignupMpin(e.target.value)}
                  placeholder="••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '18px',
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Confirm 4-Digit MPIN</label>
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmMpin(!showSignupConfirmMpin)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showSignupConfirmMpin ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSignupConfirmMpin ? 'text' : 'password'}
                  maxLength={4}
                  value={signupConfirmMpin}
                  onChange={(e) => setSignupConfirmMpin(e.target.value)}
                  placeholder="••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '18px',
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  opacity: signupLoading ? 0.7 : 1,
                  cursor: signupLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {signupLoading ? 'Registering...' : 'Register & Access Queue'}
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

  // --------------------------------------------------------------------------
  // AUTHENTICATED FACILITY DASHBOARD VIEW (STITCH DESIGN SYSTEM)
  // --------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#F8FAFC] font-['IBM_Plex_Sans',sans-serif] text-slate-800 flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="bg-[#0f766e] text-white border-b border-[#0d6560] px-4 py-3 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-[6px] bg-white/15 flex items-center justify-center text-white border border-white/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight">{staff.facility_name || 'Healthcare Facility'}</h1>
                <span className="text-[10px] bg-teal-900/60 text-teal-100 font-mono px-1.5 py-0.5 rounded-[4px] uppercase border border-teal-500/30">
                  {staff.facility_level || 'FRU/DH'}
                </span>
              </div>
              <p className="text-[11px] text-teal-100/90">
                Staff: <span className="font-semibold text-white">{staff.name}</span> ({staff.role.replace(/_/g, ' ')})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end md:self-auto">
            <button
              onClick={() => token && fetchReferrals(token)}
              disabled={loadingQueue}
              className="px-3 py-1.5 bg-teal-800/80 hover:bg-teal-800 text-white text-xs font-semibold rounded-[4px] border border-teal-600/50 flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={loadingQueue ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              <span>{loadingQueue ? 'Refreshing...' : 'Refresh Queue'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-teal-950/60 hover:bg-teal-950 text-teal-100 hover:text-white text-xs font-semibold rounded-[4px] border border-teal-800/60 cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto w-full px-4 py-5 sm:px-6 flex-1 space-y-4">
        {/* Operational Status & Capacity Broadcast Banner */}
        <div className="bg-white border border-slate-200 rounded-[2px] p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  facilityStatus?.operational_status === 'AVAILABLE'
                    ? 'bg-emerald-500'
                    : facilityStatus?.operational_status === 'BUSY'
                    ? 'bg-amber-500'
                    : facilityStatus?.operational_status === 'EMERGENCY_ONLY'
                    ? 'bg-red-500'
                    : 'bg-slate-500'
                }`}
              />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Facility Capacity & Operational Broadcast
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center space-x-2">
                  <span>Status: {facilityStatus?.operational_status || 'AVAILABLE'}</span>
                  <span className="text-slate-300">•</span>
                  <span>Beds Available: {facilityStatus?.available_beds ?? '--'}</span>
                  {facilityStatus?.status_note && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-normal text-slate-600 italic">
                        "{facilityStatus.status_note}"
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditingStatus(!isEditingStatus)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-[2px] border border-slate-300 self-start sm:self-auto cursor-pointer inline-flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>{isEditingStatus ? 'Cancel Edit' : 'Broadcast Capacity'}</span>
            </button>
          </div>

          {/* Edit Capacity Expandable Panel */}
          {isEditingStatus && (
            <form onSubmit={handleUpdateFacilityStatus} className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Operational Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e: any) => setEditStatus(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-[2px] bg-slate-50"
                >
                  <option value="AVAILABLE">AVAILABLE (Normal)</option>
                  <option value="BUSY">BUSY (High Load)</option>
                  <option value="EMERGENCY_ONLY">EMERGENCY ONLY</option>
                  <option value="FULL">FULL (No Capacity)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Available Beds
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={editBeds}
                  onChange={(e) => setEditBeds(Number(e.target.value))}
                  className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-[2px] bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Broadcast Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. O2 beds ready, CT operational"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-[2px] bg-slate-50"
                />
              </div>

              <button
                type="submit"
                disabled={statusUpdating}
                className="py-1.5 px-4 bg-[#12324D] hover:bg-[#0A1E30] text-white text-xs font-bold uppercase rounded-[2px] disabled:opacity-50 cursor-pointer"
              >
                {statusUpdating ? 'Saving...' : 'Publish Update'}
              </button>
            </form>
          )}
        </div>

        {/* Global Action Messages */}
        {actionMessage && (
          <div
            className={`p-3 text-xs font-medium rounded-[2px] border-l-4 flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-500'
                : 'bg-red-50 text-red-800 border-[#C7372F]'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Chip Bar & Summary Counts */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-[2px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Urgency:
            </span>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-[#12324D] text-white border-[#12324D]'
                  : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              ALL ({queue.length})
            </button>
            <button
              onClick={() => setFilter('EMERGENCY')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-colors cursor-pointer ${
                filter === 'EMERGENCY'
                  ? 'bg-[#C7372F] text-white border-[#C7372F]'
                  : 'bg-red-50 text-[#C7372F] border-red-200 hover:bg-red-100'
              }`}
            >
              EMERGENCY ({countEmergency})
            </button>
            <button
              onClick={() => setFilter('HIGH')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-colors cursor-pointer ${
                filter === 'HIGH'
                  ? 'bg-[#D97706] text-white border-[#D97706]'
                  : 'bg-amber-50 text-[#D97706] border-amber-200 hover:bg-amber-100'
              }`}
            >
              HIGH ({countHigh})
            </button>
            <button
              onClick={() => setFilter('MEDIUM')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-colors cursor-pointer ${
                filter === 'MEDIUM'
                  ? 'bg-[#CA8A04] text-white border-[#CA8A04]'
                  : 'bg-yellow-50 text-[#CA8A04] border-yellow-200 hover:bg-yellow-100'
              }`}
            >
              MEDIUM ({countMedium})
            </button>
            <button
              onClick={() => setFilter('LOW')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-colors cursor-pointer ${
                filter === 'LOW'
                  ? 'bg-[#2F7D5D] text-white border-[#2F7D5D]'
                  : 'bg-emerald-50 text-[#2F7D5D] border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              LOW ({countLow})
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing <span className="font-bold text-slate-800">{filteredQueue.length}</span> referral{filteredQueue.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Queue Error */}
        {queueError && (
          <div className="p-4 bg-red-50 border-l-4 border-[#C7372F] text-xs text-red-700 rounded-[2px]">
            {queueError}
          </div>
        )}

        {/* Dense Single-Column Referral Card List */}
        <div className="space-y-3">
          {loadingQueue && queue.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-[2px] p-8 text-center text-slate-400 text-xs">
              Fetching inbound referrals for {staff.facility_name}...
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-[2px] p-8 text-center text-slate-500 text-xs">
              No inbound referrals matching the selected filter.
            </div>
          ) : (
            filteredQueue.map((item) => {
              const uTheme = getUrgencyTheme(item.urgency);
              const sBadge = getStateBadge(item.state);
              const cosmeticAbha = `91-${item.id.replace(/\D/g, '').padEnd(10, '8').slice(0, 4)}-${item.id.replace(/\D/g, '').padEnd(10, '4').slice(4, 8)}-${item.id.replace(/\D/g, '').padEnd(10, '2').slice(8, 10)}`;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-[2px] shadow-sm hover:border-slate-300 transition-shadow overflow-hidden flex flex-col"
                  style={{ borderLeftWidth: '4px', borderLeftColor: uTheme.stripe }}
                >
                  {/* Card Header Row */}
                  <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-[2px] border"
                        style={{
                          backgroundColor: uTheme.bg,
                          color: uTheme.text,
                          borderColor: uTheme.border,
                        }}
                      >
                        {uTheme.label}
                      </span>
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold rounded-[2px] border"
                        style={{
                          backgroundColor: sBadge.bg,
                          color: sBadge.text,
                          borderColor: sBadge.border,
                        }}
                      >
                        {sBadge.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        REF #{item.id.slice(0, 8)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        • ABHA: {cosmeticAbha}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      Received {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                  {/* Card Main Body */}
                  <div className="p-3.5 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Patient & Demographic Info (4 cols) */}
                    <div className="lg:col-span-4 space-y-1.5 border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:pr-4">
                      <div className="flex items-baseline space-x-2">
                        <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                          {item.patient_name || 'Citizen Patient'}
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">
                          ({item.patient_age_years != null ? `${item.patient_age_years}y` : '--'}, {item.patient_sex || '--'})
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-400 text-[11px] inline-flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>Village:</span>
                          </span>
                          <span className="font-medium text-slate-700">{item.patient_village || 'Local Community'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-400 text-[11px] inline-flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            <span>Contact:</span>
                          </span>
                          <span className="font-mono text-slate-700">{item.patient_phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-400 text-[11px] inline-flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>Origin:</span>
                          </span>
                          <span className="text-slate-700 capitalize font-medium">{item.created_by_role ? item.created_by_role.replace(/_/g, ' ') : 'Citizen App'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Triage Rule, Symptoms & Vitals (5 cols) */}
                    <div className="lg:col-span-5 space-y-2 border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:pr-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          NHM Protocol / Triage Rule
                        </div>
                        <div className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                          {item.rule_name || 'Standard Referral Protocol'}
                        </div>
                      </div>

                      {item.symptoms && item.symptoms.length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Presenting Symptoms
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.symptoms.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded-[2px] border border-slate-200"
                              >
                                {s.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vitals Strip */}
                      {item.vitals && Object.keys(item.vitals).length > 0 && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            Recorded Vitals
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded-[2px] border border-slate-200">
                            {item.vitals.spo2_percent != null && (
                              <span>SpO2: <b>{item.vitals.spo2_percent}%</b></span>
                            )}
                            {item.vitals.pulse_bpm != null && (
                              <span>Pulse: <b>{item.vitals.pulse_bpm} bpm</b></span>
                            )}
                            {item.vitals.systolic_bp != null && item.vitals.diastolic_bp != null && (
                              <span>BP: <b>{item.vitals.systolic_bp}/{item.vitals.diastolic_bp}</b></span>
                            )}
                            {item.vitals.temperature_celsius != null && (
                              <span>Temp: <b>{item.vitals.temperature_celsius}°C</b></span>
                            )}
                            {item.vitals.respiratory_rate != null && (
                              <span>RR: <b>{item.vitals.respiratory_rate}/m</b></span>
                            )}
                          </div>
                        </div>
                      )}

                      {item.recommended_action && (
                        <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-100 p-1.5 rounded-[2px]">
                          <span className="font-semibold text-amber-900">Action:</span> {item.recommended_action}
                        </div>
                      )}
                    </div>

                    {/* Deterministic State-Transition & Quick Action Actions (3 cols) */}
                    <div className="lg:col-span-3 flex flex-col justify-between h-full space-y-2">
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          State Transition Action
                        </div>

                        {/* Exact ONE Primary State-Transition Button based on referral.state */}
                        {item.state === 'created' && (
                          <button
                            type="button"
                            disabled={actionLoading === item.id}
                            onClick={() => handleAcceptReferral(item)}
                            className="w-full py-2 px-3 bg-[#12324D] hover:bg-[#0A1E30] text-white text-xs font-bold rounded-[2px] transition-colors disabled:opacity-50 cursor-pointer text-center inline-flex items-center justify-center gap-1.5"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                              <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                            <span>{actionLoading === item.id ? 'Processing...' : 'Accept Referral'}</span>
                          </button>
                        )}

                        {item.state === 'in_transit' && (
                          <button
                            type="button"
                            disabled={actionLoading === item.id}
                            onClick={() => handleMarkReceived(item)}
                            className="w-full py-2 px-3 bg-[#12324D] hover:bg-[#0A1E30] text-white text-xs font-bold rounded-[2px] transition-colors disabled:opacity-50 cursor-pointer text-center inline-flex items-center justify-center gap-1.5"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="9 11 12 14 22 4"></polyline>
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                            </svg>
                            <span>{actionLoading === item.id ? 'Processing...' : 'Mark Received at Facility'}</span>
                          </button>
                        )}

                        {item.state === 'received_at_facility' && (
                          <button
                            type="button"
                            disabled={actionLoading === item.id}
                            onClick={() => handleCloseReferral(item)}
                            className="w-full py-2 px-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-[2px] transition-colors disabled:opacity-50 cursor-pointer text-center inline-flex items-center justify-center gap-1.5"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>{actionLoading === item.id ? 'Processing...' : 'Close Referral'}</span>
                          </button>
                        )}

                        {item.state === 'closed' && (
                          <div className="w-full py-2 px-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-[2px] border border-slate-200 text-center inline-flex items-center justify-center gap-1.5">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Referral Completed</span>
                          </div>
                        )}
                      </div>

                      {/* Auxiliary Non-State Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        {item.patient_phone && (
                          <a
                            href={`tel:${item.patient_phone}`}
                            className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-[2px] border border-slate-300 text-center transition-colors inline-flex items-center justify-center gap-1"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            <span>Call</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-[2px] border border-slate-300 text-center transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                          </svg>
                          <span>FHIR R4</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FHIR Details Drawer / Modal */}
        {selectedItem && (
          <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-[2px] p-4 sm:p-5 shadow-lg space-y-3 mt-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  FHIR R4 Referral Bundle • {selectedItem.id}
                </h3>
                <p className="text-xs text-slate-400">
                  Patient: {selectedItem.patient_name} • Urgency: {selectedItem.urgency}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleCopyFhir(selectedItem)}
                  className="px-3 py-1 bg-[#1E4E75] hover:bg-[#256291] text-white text-xs font-semibold rounded-[2px] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {copied ? (
                      <polyline points="20 6 9 17 4 12"></polyline>
                    ) : (
                      <>
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                      </>
                    )}
                  </svg>
                  <span>{copied ? 'Copied Bundle' : 'Copy FHIR JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-[2px] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <pre className="text-xs font-mono bg-slate-950 p-3 rounded-[2px] overflow-x-auto text-emerald-400 leading-relaxed max-h-72">
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

      {/* Footer Navigation */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <Link href="/" className="font-semibold text-slate-700 hover:underline">
              ← Return to Citizen Self-Triage
            </Link>
          </div>
          <div>Jeevanya • MoHFW NHM Standardized Facility Portal © {new Date().getFullYear()}</div>
        </div>
      </footer>
    </main>
  );
}
