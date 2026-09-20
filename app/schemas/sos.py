from typing import Optional, List, Any
from pydantic import BaseModel
from datetime import datetime


class SosCreateRequest(BaseModel):
    client_alert_id: str
    reported_at: Optional[str] = None
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_village: Optional[str] = None
    patient_age: Optional[float] = None
    patient_sex: Optional[str] = None
    symptoms: Optional[List[str]] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    facility_id: Optional[str] = None
    channel: Optional[str] = "citizen_web"


class SosAlertResponse(BaseModel):
    alert_id: str
    client_alert_id: str
    status: str
    received_at: str
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    facility_level: Optional[str] = None
    facility_phone: Optional[str] = None
    distance_km: Optional[float] = None
    repeat_count: int = 1
    unrouted: bool = False
    message: str


class SosListItemResponse(BaseModel):
    id: str
    client_alert_id: str
    reported_at: Optional[str] = None
    received_at: str
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_village: Optional[str] = None
    patient_age: Optional[float] = None
    patient_sex: Optional[str] = None
    symptoms: List[str] = []
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    facility_level: Optional[str] = None
    facility_phone: Optional[str] = None
    channel: str = "citizen_web"
    status: str = "open"
    repeat_count: int = 1
    unrouted: bool = False
    acknowledged_by_staff_id: Optional[str] = None
    acknowledged_by_staff_name: Optional[str] = None
    acknowledged_at: Optional[str] = None
    resolved_at: Optional[str] = None
    resolution_notes: Optional[str] = None


class SosActionResponse(BaseModel):
    alert_id: str
    status: str
    facility_id: str
    facility_name: Optional[str] = None
    facility_level: Optional[str] = None
    updated_at: str
    message: str


class SosResolveRequest(BaseModel):
    notes: Optional[str] = None
