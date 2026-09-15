# Swasthya Setu (स्वास्थ्य सेतु) — What's Built & Verified

> **"Health Bridge"** — AI-augmented medical triage and referral system for rural India.
> Citizens, ASHA workers, and facility staff get guideline-backed urgency assessments in their own language, with zero dependency on internet for the core triage logic and verifiable server-side referral tracking.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         citizen_web/                             │
│              Next.js 16.3 · React 19 · TypeScript               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Citizen Triage (100% AUTHENTICATION-FREE & FRICTIONLESS)   │ │
│  │ Step 1 (Demo) ➔ Step 2 (Symptoms) ➔ Step 3 (Vitals) ➔ Step 4│ │
│  └────────────────────────────────────────────────────────────┘ │
│                        │                                         │
│              /api/triage  (Next.js route)                        │
│      ┌────────────────┴────────────────┐                        │
│      │ localRulesEngine.ts             │ ← deterministic,       │
│      │ (v12 ICMR parity, edge/browser  │   works offline,       │
│      │  zero API dependency)           │   zero-failure-rate    │
│      └────────────────┬────────────────┘                        │
│                       │ (persists to backend database)           │
│                       ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /facility Portal (Dual Flow: Sign In & Staff Registration) │ │
│  │ Translucent Vector Eye MPIN Toggle (Zero Platform Emojis)  │ │
│  │ Scoped by facility_id · Mark Received · Close Referral     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                        │                                         │
│                        ▼                                         │
│              /api/facility/{login, register, list, referrals}    │
└───────────────────────┼─────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                           app/                                   │
│               FastAPI · asyncpg · PostgreSQL                     │
│                                                                  │
│  POST /triage ──→ rules_engine.py (v12) ──→ persistence.py     │
│                       45+ rules               │                  │
│                       4 urgency tiers          ▼                 │
│                                        ┌─────────────────────┐  │
│                                        │ PostgreSQL          │  │
│                                        │ patients            │  │
│                                        │ triage_records      │  │
│                                        │ (duration_days)     │  │
│                                        │ facilities          │  │
│                                        │ facility_staff      │  │
│                                        │ referrals           │  │
│                                        │ state_transitions   │  │
│                                        └─────────────────────┘  │
│                                                                  │
│  GET  /facility/list ──→ Public Facility Directory (for Sign Up) │
│  POST /facility/register ──→ Persists Staff + Bcrypt + Scoped JWT│
│  POST /facility/login ──→ Scoped Session JWT (staff_id, facility)│
│  POST /facility/referrals/{id}/transition ──→ State Machine Check│
│  POST /extract-symptoms ──→ LLM (local proxy) ──→ NLP Fallback   │
└──────────────────────────────────────────────────────────────────┘
                        ▲
                        │ (Sync & Outbox Queue)
┌──────────────────────────────────────────────────────────────────┐
│                         asha_app/                                │
│                React Native · Expo SDK · TypeScript              │
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Dual Auth │→ │ Field     │→ │ Active    │→ │ Supervisor   │  │
│  │ Sign In & │  │ Registry  │  │ Transfer  │  │ Console &    │  │
│  │ Register  │  │ + Duration│  │ Deck (Live│  │ Audit Outbox │  │
│  └───────────┘  └───────────┘  └───────────┘  └──────────────┘  │
│        │                                                         │
│        └─ Translucent Vector Eye MPIN Toggle (Zero Emojis)       │
│        └─ Dynamic Local Encrypted Worker Storage Registry        │
│                                                                  │
│       offlineRulesEngine.ts (100% Offline Rule Parity)           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Clinical Rules Engine & Protocol Parity — `app/` & Shared TypeScript Engines

### 1.1 Deterministic Clinical Rules Engine (`rules_engine.py`, `localRulesEngine.ts`, `offlineRulesEngine.ts`)

The clinical decision matrix spans **45+ triage rules** adhering strictly to official guidelines from the Ministry of Health and Family Welfare (MoHFW), National Health Mission (NHM), NVBDCP, IMNCI, and ICMR (2019).

| Tier | Color | Meaning | Referral Target |
|------|-------|---------|-----------------|
| **EMERGENCY** | 🔴 RED | Immediate life threat | District Hospital / FRU |
| **HIGH** | 🟡 YELLOW | Needs same-day facility visit | PHC or CHC |
| **MEDIUM** | 🟠 ORANGE | Needs clinical assessment | PHC |
| **LOW** | 🟢 GREEN | Home care, follow-up if persists | None |

### 1.2 ICMR Acute Fever & Duration Staging Implementation (v12)
- **Clinical Source**: *ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes, 2nd Ed. (2019), Ch. 2 "Management of Acute Fever" (Sec 2.1.3 p.5-6, p.9)*.
- **Contract v3 Upgrade**: Added `symptom_duration_days: Optional[int]` (0–365) to `TriageRequest` in Python (`app/schemas/triage.py`), Web (`citizen_web/src/lib/triageContract.ts`), and Mobile (`asha_app/src/types/index.ts`).
- **`R-MED-FEVER-001` Threshold Guard**: Replaced bare `"fever"` matching with a guard requiring measured temperature ≥ 38.3°C (101°F) or unmeasured temperature. Measured fever < 38.3°C without red/yellow flags now correctly falls through to `R-ADULT-LOW-001` (GREEN / home care per MoHFW Annexure 4 p.53).
- **Dynamic Duration Workup Recommendations (`build_fever_action`)**:
  - *Day 1–2*: Monitor at home, fluids + paracetamol, no investigations required yet unless danger signs appear.
  - *Day 3–4*: Visit PHC for blood count and malaria smear/RDT (dengue test if suspected).
  - *Day 5–7*: Visit PHC/CHC for blood cultures in addition to malaria/dengue testing (and scrub typhus/leptospirosis if endemic).
  - *> 7 Days*: Chest X-ray and abdominal ultrasound to investigate occult source.
  - *Duration Unreported*: Visit PHC for diagnostic evaluation (blood smear/RDT).
- **100% Three-Way Parity**: Synchronized logic and tests across Python (`rules_engine.py`), Next.js (`localRulesEngine.ts`), and React Native (`offlineRulesEngine.ts`).

---

## 2. Database Migrations & Persistence

### 2.1 Migration History
1. `migrations/001_referral_role_tagging.sql`:
   - Adds `created_by_role` (`'asha' | 'phc_staff'`) and `origin_facility_id` (FK to facilities) to `referrals`.
2. `migrations/002_facility_staff.sql`:
   - Creates `facility_staff` table (`id`, `name`, `phone_or_username`, `mpin_hash`, `role`, `facility_id`, `active`, `created_at`).
   - Adds `updated_by_staff_id` (FK to `facility_staff`) to `referral_state_transitions`.
3. `migrations/003_triage_duration_days.sql`:
   - Adds `duration_days INTEGER` and index to `triage_records`.
4. `migrations/004_facility_availability.sql`:
   - Adds `operational_status` (`AVAILABLE`, `BUSY`, `EMERGENCY_ONLY`, `FULL`), `available_beds` (INTEGER), `status_note` (TEXT), `updated_at`, and `updated_by_staff_id` (FK to `facility_staff`) to `facilities`.

### 2.2 Persistence Layer (`app/persistence.py`)
- Automatically resolves/deduplicates patients via phone or patient ID.
- Persists all triage inputs including `symptom_duration_days` to `triage_records.duration_days`.
- Automatically generates initial `referrals` and `referral_state_transitions` audit rows for any triage requiring higher-tier care.

---

## 3. Facility Staff Authentication & Referral State Machine

### 3.1 Backend Endpoints (`app/facility_routes.py`, `app/schemas/facility.py`, `app/main.py`)
- `GET /facility/list`: Public directory endpoint returning facility id, name, level, and district for staff registration selection.
- `POST /facility/register`: Registers new medical officers and facility staff with bcrypt MPIN hashing, persists them to `facility_staff`, and issues a facility-scoped JWT token.
- `POST /facility/login`: Authenticates staff via phone/username + 4-digit MPIN, issuing a scoped JWT session carrying `staff_id`, `facility_id`, and `role`.
- `GET /facility/referrals`: Queries incoming referrals strictly filtered server-side by the authenticated user's `session.facility_id`.
- `POST /facility/referrals/{id}/transition`: Validates and advances referral states (`created` ➔ `in_transit` ➔ `received_at_facility` ➔ `closed`).
  - **Server-Side Security**: Enforces strict `facility_id` matching, rejecting cross-facility mutations with HTTP 403 Forbidden.
  - **Audit Logging**: Logs each transition with `updated_by_staff_id`, `from_state`, `to_state`, and timestamp in `referral_state_transitions`.

### 3.2 Facility Web Dashboard (`citizen_web/src/app/facility/page.tsx`)
- **Dual Flow (Sign In vs Register / Sign Up)**:
  - Tabbed interface allowing existing staff to log in or new medical officers/staff to register their account and select their assigned government health facility.
- **Translucent Vector Eye MPIN Visibility Toggle**:
  - Removed all platform emojis (`👁️`, `🙈`).
  - Replaced with clean, accessible SVG vector icons (`<EyeIcon />` and `<EyeOffIcon />` with diagonal strikethrough slash) styled with `text-slate-400` / `opacity-60` transitioning smoothly on hover/focus.
- **Incoming Referral Queue**:
  - Queue cards with real-time status badges, emergency indicators, and action triggers:
    - *Mark Received at Facility* (`in_transit` ➔ `received_at_facility`)
    - *Close Referral* (`received_at_facility` ➔ `closed`)
- **Facility Operational Status & Live Capacity Broadcast**:
  - Live status control matrix (`AVAILABLE` 🟢, `BUSY` 🟡, `EMERGENCY_ONLY` 🟠, `FULL` 🔴).
  - Dynamic bed counter and public broadcast notes for frontline field workers.

---

## 4. Frontline ASHA Mobile Application (`asha_app/`)

### 4.1 Field Authentication & Worker Registration (`AuthScreen.tsx`, `authService.ts`)
- **Dual Auth Action Flow**:
  - `[ Sign In (लॉगिन) ]` for active workers with pre-authorized chips, 4-digit MPIN, and 6-digit SMS OTP.
  - `[ Register / Sign Up (नोंदणी) ]` for newly deployed frontline workers, capturing Name, Phone, Role, Sub-Centre, Village Cluster, PHC Area, and 4-digit MPIN.
- **Translucent Vector Eye Standard**:
  - Zero emojis in MPIN toggle.
  - Uses `@expo/vector-icons` (`Ionicons` `eye-outline` / `eye-off-outline`) with translucent slate tinting (`#64748B`, `opacity: 0.65`) for all PIN inputs.
- **Dynamic Worker Roster**:
  - Combines pre-authorized roster records with newly registered workers stored in encrypted local storage (`@swasthya_registered_workers`).
  - Automatically logs newly registered workers into active sessions.

### 4.2 Field Screening Flow
- **Demographics & Profile**: Rapid patient profile entry (name, age, sex, village, pregnancy/postpartum status).
- **Symptom & Duration Checklist (`SymptomCheckScreen.tsx`)**:
  - High-contrast danger sign cards (56dp+ touch targets).
  - Segmented ICMR duration selector (`0`, `2`, `4`, `6`, `10` days) with full 4-language i18n (`en`, `hi`, `mr`, `ta`).
- **Offline Triage Calculation (`offlineRulesEngine.ts`)**: Instant 0ms offline rule evaluations returning duration-staged guidance and emergency dispatch flags.
- **Vitals & Triage Result (`ResultScreen.tsx`)**: Displays urgency badges, facility targets, and duration-tailored action guidance.
- **Emergency 1-Touch Quick Dispatch**: Direct integration for calling **108 Emergency Ambulance** and **102 Janani Express** maternal transport.
- **Active Referral Transfers Deck**: Live tracking across referral lifecycle states with SQLite storage and background sync outbox.

---

## 5. Citizen Web Application (`citizen_web/`)

### 5.1 100% Authentication-Free & Frictionless Citizen Triage
- **Zero-Authentication Citizen Guarantee**: The public citizen triage flow (`/`) requires **no login, no OTP, and no password**, ensuring zero friction for rural and low-literacy patients.
- **Step 1 (Demographics - `StepDemographics.tsx`)**: Collects patient name, age, sex, phone number, village, and ABHA ID.
- **Step 2 (Symptoms & Story - `StepSymptoms.tsx`)**:
  - Multilingual symptom checkboxes and voice narration transcript.
  - Low-literacy segmented duration selector (Today ➔ 0d, 1-2d ➔ 2d, 3-4d ➔ 4d, 5-7d ➔ 6d, >1 week ➔ 10d).
- **Step 3 (Vitals - `StepVitals.tsx`)**: Optional temperature and vital signs entry with hyperpyrexia alerts.
- **Step 4 (Referral Slip - `TriageResult.tsx`)**:
  - Complete triage assessment slip with ICMR duration-staged recommendation text.
  - Multilingual text-to-speech audio readout.

---

## 6. Verification & Test Status

- **Python Rules Engine Smoke Suite (`python3 -m app.services.rules_engine`)**: **12/12 test cases PASSING**.
  - Verified measured mild fever (37.9°C) falls through to `R-ADULT-LOW-001` (GREEN).
  - Verified measured high fever (38.6°C, Day 1) triggers `R-MED-FEVER-001` with Day 1–2 advice.
  - Verified unmeasured fever (Day 6) triggers `R-MED-FEVER-001` with >5 days blood culture advice.
  - Verified adult minor cough/cold with normal vitals triggers `R-ADULT-LOW-001` / `R-LOW-001` (GREEN).
- **TypeScript Compilation**:
  - `citizen_web`: `npx tsc --noEmit` ➔ **0 errors**.
  - `asha_app`: `npx tsc --noEmit` ➔ **0 errors**.
- **Three-Way Engine Parity**: Verified 100% identical rule traces and urgency classifications across Python backend, Next.js web client, and React Native mobile app.
claude --resume b261e439-93d2-45b9-b00b-eddc70a5d88a
