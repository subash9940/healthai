from typing import Optional, List, Any
from pydantic import BaseModel
from datetime import datetime


class FacilityLoginRequest(BaseModel):
    phone_or_username: str
    mpin: str


class FacilityRegisterRequest(BaseModel):
    name: str
    phone_or_username: str
    mpin: str
    role: str = "medical_officer"
    facility_id: str


class FacilityPublicItem(BaseModel):
    id: str
    name: str
    level: str
    district: Optional[str] = None


class FacilityAvailabilityItem(BaseModel):
    id: str
    name: str
    level: str
    operational_status: str  # 'AVAILABLE' | 'BUSY' | 'EMERGENCY_ONLY' | 'FULL'
    available_beds: int
    status_note: Optional[str] = None
    updated_at: Optional[str] = None
    district: Optional[str] = "Pune"


class FacilityStaffInfo(BaseModel):
    id: str
    name: str
    phone_or_username: str
    role: str
    facility_id: str
    facility_name: Optional[str] = None
    facility_level: Optional[str] = None


class FacilityLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff: FacilityStaffInfo


class TransitionReferralRequest(BaseModel):
    notes: Optional[str] = None


class ReferralItemResponse(BaseModel):
    id: str
    triage_record_id: str
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    facility_level: Optional[str] = None
    created_by_role: Optional[str] = None
    state: str
    created_at: str
    updated_at: str

    # Patient & Triage Details
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age_years: Optional[int] = None
    patient_sex: Optional[str] = None
    patient_village: Optional[str] = None
    urgency: str
    rule_name: str
    symptoms: List[str] = []
    vitals: Optional[dict[str, Any]] = None
    recommended_action: Optional[str] = None
    citizen_message: Optional[str] = None
    requires_referral: bool = True
    referral_target_level: Optional[str] = None


class ReferralTransitionResponse(BaseModel):
    referral_id: str
    previous_state: str
    new_state: str
    updated_by_staff_id: str
    updated_at: str
    message: str


class FacilityStatusResponse(BaseModel):
    facility_id: str
    facility_name: str
    facility_level: str
    operational_status: str  # 'AVAILABLE' | 'BUSY' | 'EMERGENCY_ONLY' | 'FULL'
    available_beds: int
    status_note: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by_staff_id: Optional[str] = None
    updated_by_staff_name: Optional[str] = None


class UpdateFacilityStatusRequest(BaseModel):
    operational_status: Optional[str] = None  # 'AVAILABLE' | 'BUSY' | 'EMERGENCY_ONLY' | 'FULL'
    available_beds: Optional[int] = None
    status_note: Optional[str] = None

