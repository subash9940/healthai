"""
app/schemas/sync.py — Request & Response schemas for /sync endpoint
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from app.schemas.triage import Vitals, Sex, Urgency


class ClientPatientDemographics(BaseModel):
    patient_id: str
    patient_display_name: Optional[str] = None
    patient_village: Optional[str] = None
    mobile: Optional[str] = None
    abha_id: Optional[str] = None
    patient_age_years: float
    patient_sex: Sex
    is_pregnant: Optional[bool] = None
    is_postpartum: Optional[bool] = False


class ClientTriageResponse(BaseModel):
    urgency: Urgency
    recommended_action: Optional[str] = ""
    citizen_message: Optional[str] = ""
    requires_referral: bool = False
    referral_target_level: Optional[str] = None
    rule_trace: Optional[List[str]] = Field(default_factory=list)
    evaluated_at: Optional[str] = None
    is_offline_evaluation: Optional[bool] = True


class ClientPatientRecord(BaseModel):
    patient: ClientPatientDemographics
    symptoms: List[str] = Field(default_factory=list)
    vitals: Optional[Vitals] = None
    triage: Optional[ClientTriageResponse] = None
    created_at: str
    synced: Optional[bool] = False
    synced_at: Optional[str] = None
    asha_worker_id: Optional[str] = None


class ClientReferralStatusHistory(BaseModel):
    status: str
    timestamp: str
    note: Optional[str] = None


class ClientReferralRecord(BaseModel):
    referral_id: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_village: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age: Optional[float] = None
    patient_sex: Optional[Sex] = None
    urgency: Optional[Urgency] = None
    target_facility: Optional[str] = None
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    status: Optional[str] = "created"
    status_history: Optional[List[ClientReferralStatusHistory]] = Field(default_factory=list)
    symptoms: Optional[List[str]] = Field(default_factory=list)
    recommended_action: Optional[str] = None
    created_at: str
    synced: Optional[bool] = False
    asha_worker_id: Optional[str] = None


class SyncRequest(BaseModel):
    patients: List[ClientPatientRecord] = Field(default_factory=list)
    referrals: List[ClientReferralRecord] = Field(default_factory=list)
    synced_at: Optional[str] = None


class RecordSyncStatus(BaseModel):
    id: str  # client patient_id or referral_id
    status: Literal["accepted", "duplicate", "rejected"]
    type: Literal["patient", "referral"]
    reason: Optional[str] = None


class SyncResponse(BaseModel):
    success: bool
    synced_count: int
    records: List[RecordSyncStatus]
    message: str
