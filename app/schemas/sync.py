"""
app/schemas/sync.py — Pydantic schemas for ASHA Field Mobile Application synchronization.
Matches the payload sent by asha_app/src/services/syncService.ts.
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from app.schemas.triage import Sex, Urgency, Vitals


class PatientDemographicsSync(BaseModel):
    patient_id: str
    patient_display_name: Optional[str] = None
    patient_village: Optional[str] = None
    mobile: Optional[str] = None
    abha_id: Optional[str] = None
    patient_age_years: float = Field(ge=0.0, le=130.0)
    patient_sex: Sex
    is_pregnant: Optional[bool] = None
    is_postpartum: Optional[bool] = False


class TriageEvaluationResponseSync(BaseModel):
    urgency: Urgency
    recommended_action: str
    citizen_message: Optional[str] = ""
    requires_referral: bool = False
    referral_target_level: Optional[str] = None
    rule_trace: List[str] = Field(default_factory=list)
    evaluated_at: Optional[str] = None
    is_offline_evaluation: Optional[bool] = True


class PatientRecordSync(BaseModel):
    patient: PatientDemographicsSync
    symptoms: List[str] = Field(default_factory=list)
    vitals: Optional[Vitals] = None
    triage: TriageEvaluationResponseSync
    created_at: str
    synced: bool = False
    synced_at: Optional[str] = None
    asha_worker_id: Optional[str] = None


class StatusHistoryItemSync(BaseModel):
    status: str
    timestamp: str
    note: Optional[str] = None


class ReferralRecordSync(BaseModel):
    referral_id: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_village: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age: float = Field(ge=0.0, le=130.0)
    patient_sex: Sex
    urgency: Urgency
    target_facility: Optional[str] = "phc"
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    status: str = "created"  # "created" | "in_transit" | "received_at_facility" | "closed"
    status_history: List[StatusHistoryItemSync] = Field(default_factory=list)
    symptoms: List[str] = Field(default_factory=list)
    recommended_action: str
    created_at: str
    synced: bool = False
    asha_worker_id: Optional[str] = None


class SyncRequest(BaseModel):
    patients: List[PatientRecordSync] = Field(default_factory=list)
    referrals: List[ReferralRecordSync] = Field(default_factory=list)
    synced_at: str


class SyncResponse(BaseModel):
    status: str = "ok"
    synced_patient_ids: List[str] = Field(default_factory=list)
    synced_referral_ids: List[str] = Field(default_factory=list)
    persisted_patients_count: int = 0
    persisted_referrals_count: int = 0
    message: str = "Sync successful"
