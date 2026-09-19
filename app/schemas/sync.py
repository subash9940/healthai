"""
app/schemas/sync.py

Pydantic schemas for offline sync payload and response between mobile ASHA client
and Swasthya Setu backend.
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator
from app.schemas.triage import Urgency, Sex, Vitals


class SyncPatientDemographics(BaseModel):
    patient_id: str = Field(description="Client-generated UUID/ULID for patient")
    patient_display_name: Optional[str] = Field(default=None, max_length=128)
    patient_village: Optional[str] = Field(default=None, max_length=128)
    mobile: Optional[str] = Field(default=None, max_length=20)
    abha_id: Optional[str] = Field(default=None, max_length=64)
    patient_age_years: float = Field(ge=0.0, le=130.0)
    patient_sex: Sex
    is_pregnant: Optional[bool] = None
    is_postpartum: bool = False

    @field_validator("patient_display_name", "patient_village", "abha_id", mode="before")
    @classmethod
    def sanitize_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = str(v).replace("\x00", "").strip()
        return cleaned if cleaned else None

    @field_validator("mobile", mode="before")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        digits = "".join(c for c in str(v) if c.isdigit())
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        return digits if len(digits) == 10 else digits


class SyncClientTriage(BaseModel):
    urgency: Urgency
    recommended_action: Optional[str] = ""
    citizen_message: Optional[str] = ""
    requires_referral: bool = False
    referral_target_level: Optional[str] = None
    rule_trace: Optional[List[str]] = Field(default_factory=list)
    evaluated_at: Optional[str] = None
    is_offline_evaluation: bool = True


class SyncPatientRecord(BaseModel):
    record_id: Optional[str] = Field(default=None, description="Client-generated UUID for triage record")
    patient: SyncPatientDemographics
    symptoms: List[str] = Field(default_factory=list)
    symptom_duration_days: Optional[int] = Field(default=None, ge=0, le=365)
    vitals: Optional[Vitals] = None
    triage: SyncClientTriage
    created_at: Optional[str] = None
    synced: Optional[bool] = False
    asha_worker_id: Optional[str] = None
    language: Optional[str] = "en"


class SyncReferralRecord(BaseModel):
    referral_id: str = Field(description="Client referral ID")
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_village: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age: Optional[float] = None
    patient_sex: Optional[Sex] = None
    urgency: Optional[Urgency] = None
    target_facility: Optional[str] = None
    status: Optional[str] = "created"
    status_history: Optional[List[dict]] = Field(default_factory=list)
    symptoms: Optional[List[str]] = Field(default_factory=list)
    recommended_action: Optional[str] = None
    created_at: Optional[str] = None
    synced: Optional[bool] = False
    asha_worker_id: Optional[str] = None
    is_demo: Optional[bool] = False


class SyncPayload(BaseModel):
    patients: List[SyncPatientRecord] = Field(default_factory=list)
    referrals: Optional[List[SyncReferralRecord]] = Field(default_factory=list)
    synced_at: Optional[str] = None


class SyncedPatientItem(BaseModel):
    client_record_id: Optional[str] = None
    client_patient_id: str
    triage_record_id: str
    patient_id: str
    referral_id: Optional[str] = None
    server_urgency: Urgency
    client_urgency: Urgency
    urgency_mismatch: bool


class SyncedReferralItem(BaseModel):
    client_ref_id: str
    referral_id: str
    status: str


class SyncErrorItem(BaseModel):
    client_record_id: Optional[str] = None
    client_patient_id: Optional[str] = None
    error: str


class SyncResponse(BaseModel):
    success: bool
    synced_patients: List[SyncedPatientItem] = Field(default_factory=list)
    synced_referrals: List[SyncedReferralItem] = Field(default_factory=list)
    errors: List[SyncErrorItem] = Field(default_factory=list)
    total_synced: int = 0
    total_errors: int = 0
    mismatches_count: int = 0
