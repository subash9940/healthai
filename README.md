# Jeevanya
### Rural Healthcare Triage & Referral Platform
**Smart India Hackathon 2026 | Problem Statement: SIH26133 | Team: TECHTONIC**
**Velammal Engineering College, Surapet, Chennai**

[Demo Video](#) <!-- TODO: paste demo video link -->

---

## Problem Statement

In rural and semi-urban India, patients and frontline health workers often lack a
structured way to judge how urgent a symptom is before deciding where — and how
fast — to seek care. This leads to two failure modes: patients traveling to the
wrong tier of facility, and genuine emergencies being under-recognized until it's
too late. Jeevanya addresses this by inserting a **deterministic, guideline-backed
triage step** at every point of contact — citizen, ASHA worker, and facility staff
— and connecting facilities into a real referral network instead of a single
fixed path.

---

## Our Approach

Jeevanya is built on one core principle: **LLMs assist, they don't decide.**

- Language models are used only for non-clinical tasks — symptom extraction from
  free text or voice, and translation.
- Every triage severity decision is produced by a **deterministic rule engine**,
  with each rule traceable to a specific page in an official government
  guideline. No rule is coded from memory or assumption.
- The same rule logic is implemented three times — once per platform — and
  cross-checked against each other so that a patient gets the same triage
  outcome whether they're on the citizen web app, the ASHA app, or the backend.
  **50/50 parity tests currently pass** across all engines.

This makes the system auditable: for any triage output, you can point to the
exact clinical guideline and page that justifies it.

### Clinical sources used
- ICMR Treatment Guidelines (Antimicrobial Use, 2nd Ed. 2019)
- NHM IMNCI 2023 Health Worker Module
- NVBDCP Malaria Guidelines (2009, 2013)
- MoHFW/NCVBDC Dengue Guidelines 2023
- Standards for TB Care in India (Central TB Division)
- Anemia Mukt Bharat Operational Guidelines (NHM)
- MoHFW/NHM Common Emergencies / Burns / Trauma Guidelines (Annexure 4)
- ASHA Module 6
- SBA (Skilled Birth Attendant) Guidelines

---

## System Architecture

Jeevanya has three interconnected components:

| Component | Stack | Role |
|---|---|---|
| **Backend** (`app/`) | FastAPI + PostgreSQL | Central rule engine, data store, referral/SOS APIs |
| **Citizen Web App** (`citizen_web/`) | Next.js / React (PWA) | Self-triage, SOS, facility availability lookup |
| **ASHA App** (`asha_app/`) | React Native + Expo (offline-first) | Frontline worker triage, referrals, facility staff mode |

### User tiers
1. **Citizens** — self-check symptoms via the web PWA, see a triage level, and can
   raise an SOS.
2. **ASHA frontline workers** — run triage on a patient, create and track
   referrals, using the mobile app even without connectivity.
3. **Facility staff** (PHC / CHC / FRU) — receive SOS alerts and referrals,
   accept/close them, and keep facility availability up to date, via a
   dedicated staff mode in the same mobile app.

---

## Authentication Model

Access is **delegated, not self-service** — designed to mirror how real
facility hierarchies work:

1. A facility's doctor/supervisor logs in first, using their government ID.
2. That supervisor provisions ASHA worker accounts under their facility.
3. ASHA workers then log in independently, scoped to that facility.

Facility staff have no open self-registration form by design — accounts are
provisioned top-down, not created ad hoc.

---

## Core Workflow

### 1. Triage
- Symptoms are entered via text or voice.
- Any free-text/voice input is passed through an LLM **only** for extraction
  and translation.
- The extracted symptom set is passed to the deterministic rule engine, which
  returns a severity tier (e.g. LOW / MEDIUM / HIGH / EMERGENCY) and the exact
  rule ID that produced it.

### 2. Referral
- Facilities are modeled as a **connected graph**, not a fixed hierarchy —
  referrals can move upward, laterally (PHC ↔ PHC), or backward as a
  counter-referral.
- A referring user can select a specific target facility rather than only the
  nearest default.
- Referral lifecycle: `created → in_transit → received_at_facility → closed`,
  with facility staff — not the referring app — holding authority to receive
  and close.

### 3. Emergency SOS
- One tap on the citizen PWA sends an alert to the patient's local ASHA and
  sub-centre.
- With connectivity, the alert sends immediately; without connectivity, the
  flow falls back to the phone's native SMS app, pre-filled and ready to send.
- Facility staff see incoming SOS alerts in real time and can acknowledge or
  resolve them.

### 4. Offline-first design
- Both the ASHA app and citizen PWA support triage without an internet
  connection.
- Data is queued locally and synced to the backend once connectivity returns,
  rather than assuming constant connectivity — a deliberate design choice for
  low-connectivity rural areas.

---

## Multilingual by Design

Every label, symptom option, and triage result is available in **English,
Hindi, Marathi, and Tamil**, with full coverage rather than partial
translation — switching language switches the entire interface, not just
static text.

---

## Roadmap

- **FHIR-structured records** for interoperability with existing health IT systems
- **IVR via Bhashini** for voice-only, non-smartphone access
- **Video consultation via eSanjeevani** for remote specialist input
- **ABHA linkage** for longitudinal patient history across visits

---

## Screenshots

<!-- TODO: add screenshots -->
| Citizen App | ASHA App | Facility Portal |
|---|---|---|
| ![Citizen](#) | ![ASHA](#) | ![Facility](#) |

---

## Repository

**GitHub:** [github.com/subash9940/healthai](https://github.com/subash9940/healthai)
