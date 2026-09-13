"""
triage_contract.py — v3

Drop this into your FastAPI backend, e.g. app/schemas/triage.py

This defines the ONE shape that Tier 1 (mobile app), Tier 2 (citizen web),
and Tier 3 (IVR backend wrapper) all send/receive. Do not change field
names after Day 1 without updating every caller.

v2 CHANGE (from v1): added `citizen_message: str` to TriageResponse.
recommended_action is written for an ASHA worker or doctor and is fine to
show as-is on the asha_app channel. citizen_web and ivr need plain-language
text that always says where to go, not internal rule-engine strings.
Defaulted to "" so any caller not yet updated to read this field won't
break on the extra key.

v3 CHANGE (from v2) — added `symptom_duration_days: Optional[int]`.
WHY: R-MED-FEVER-001 was firing MEDIUM on the mere presence of a "fever"
symptom key with no temperature threshold and no duration check, which
made the correctly-cited Annexure-4 GREEN carve-out (R-ADULT-LOW-001,
<101°F/38.3°C) permanently unreachable. Verified against ICMR Treatment
Guidelines for Antimicrobial Use in Common Syndromes, 2nd Edition (2019),
Chapter 2 "Management of Acute Fever", Sec 2.1.3 (Case Definition, p.5-6)
and the day-staged workup protocol on p.9 — fetched directly from
icmr.gov.in, not a search-snippet paraphrase.

This field represents days since onset of the PRIMARY presenting
complaint (e.g. fever), matching how the ICMR protocol itself stages by
day-of-illness for the overall presentation, not a separate duration per
individual symptom. None if not asked or unknown — absence of duration
data does NOT get treated as "recent"/mild; see rules_engine v12
changelog for how the fever rule handles an unmeasured/unreported case.
"""

import re
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class Urgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EMERGENCY = "emergency"


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Vitals(BaseModel):
    temperature_celsius: Optional[float] = Field(default=None, ge=25.0, le=45.0)
    pulse_bpm: Optional[int] = Field(default=None, ge=20, le=300)
    systolic_bp: Optional[int] = Field(default=None, ge=40, le=300)
    diastolic_bp: Optional[int] = Field(default=None, ge=20, le=200)
    respiratory_rate: Optional[int] = Field(default=None, ge=4, le=120)
    spo2_percent: Optional[int] = Field(default=None, ge=30, le=100)
    hemoglobin_g_dl: Optional[float] = Field(default=None, ge=2.0, le=23.0)


class TriageRequest(BaseModel):
    patient_id: Optional[str] = Field(default=None, max_length=64)          # ULID if already registered, else None (new patient)
    patient_display_name: Optional[str] = Field(default=None, max_length=128) # Patient full name
    patient_phone: Optional[str] = Field(default=None, max_length=20)         # for follow-up tracking; used for phone-based dedup
    patient_village: Optional[str] = Field(default=None, max_length=128)       # Patient village / town
    patient_abha_id: Optional[str] = Field(default=None, max_length=64)       # ABHA health ID; stored but dedup not yet implemented
    symptoms: list[str] = Field(default_factory=list, max_length=50)          # normalized symptom codes, e.g. ["fever", "cough", "breathlessness"]
    patient_age_years: float = Field(ge=0.0, le=130.0)
    patient_sex: Sex
    is_pregnant: Optional[bool] = None          # None if not applicable / unknown
    is_postpartum: bool = False                 # birth up to 6 weeks post-delivery; distinct from is_pregnant
    vitals: Optional[Vitals] = None
    symptom_duration_days: Optional[int] = Field(
        default=None, ge=0, le=365,
        description=(
            "Days since onset of the primary presenting complaint (e.g. fever, "
            "cough). Stages per ICMR Treatment Guidelines for Antimicrobial Use "
            "in Common Syndromes 2019, Ch.2 p.9 protocol: 0-2 / 3-4 / 5-7 / >7. "
            "None if not asked or unknown -- do not default this to 0."
        ),
    )
    language: str = Field(default="mr", max_length=10)         # ISO code: "mr" Marathi, "hi" Hindi, etc.
    source_tier: str = Field(description="one of: asha_app | citizen_web | ivr", max_length=32)

    @field_validator("patient_display_name", "patient_village", "patient_abha_id", "patient_id", mode="before")
    @classmethod
    def sanitize_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        # Remove null bytes and escape characters
        cleaned = str(v).replace("\x00", "").strip()
        return cleaned if cleaned else None

    @field_validator("patient_phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = re.sub(r"\D", "", str(v))
        if len(cleaned) == 12 and cleaned.startswith("91"):
            cleaned = cleaned[2:]
        return cleaned if cleaned else None

    @field_validator("symptoms", mode="before")
    @classmethod
    def sanitize_symptoms(cls, v: list) -> list[str]:
        if not isinstance(v, list):
            return []
        sanitized = []
        for item in v:
            if isinstance(item, str):
                cleaned = re.sub(r"[^a-zA-Z0-9_\-]", "", item.strip().lower())
                if cleaned:
                    sanitized.append(cleaned)
        return sanitized


class TriageResponse(BaseModel):
    urgency: Urgency
    recommended_action: str                     # clinical/audit wording — for ASHA/doctor use
    citizen_message: str = ""                    # plain-language, source_tier-aware wording for citizen_web/ivr
    rule_trace: list[str]                        # which ICMR rule id(s) fired — for auditability
    requires_referral: bool
    referral_target_level: Optional[str] = None  # "phc" | "chc" | "district_hospital" | None
    fhir_ready: bool = True                       # signals caller it can now build a FHIR bundle from this
    triage_record_id: Optional[str] = None       # DB-assigned triage_records.id
    patient_id: Optional[str] = None             # DB-assigned patients.id (may differ from request patient_id on dedup)
    referral_id: Optional[str] = None            # DB-assigned referrals.id (if referral created)
