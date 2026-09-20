import math
from typing import Optional, List, Any
from pydantic import BaseModel, field_validator


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

    @field_validator("client_alert_id", mode="before")
    @classmethod
    def validate_client_alert_id(cls, v: Any) -> str:
        if v is None:
            raise ValueError("client_alert_id is required")
        s = str(v).strip()
        if not s:
            raise ValueError("client_alert_id cannot be empty")
        return s

    @field_validator("lat", mode="before")
    @classmethod
    def validate_lat(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            val = float(v)
            if math.isfinite(val) and -90.0 <= val <= 90.0:
                return val
        except (ValueError, TypeError):
            pass
        return None

    @field_validator("lng", mode="before")
    @classmethod
    def validate_lng(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            val = float(v)
            if math.isfinite(val) and -180.0 <= val <= 180.0:
                return val
        except (ValueError, TypeError):
            pass
        return None

    @field_validator("accuracy", mode="before")
    @classmethod
    def validate_accuracy(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            val = float(v)
            if math.isfinite(val) and val >= 0:
                return val
        except (ValueError, TypeError):
            pass
        return None

    @field_validator("patient_age", mode="before")
    @classmethod
    def validate_patient_age(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            val = float(v)
            if math.isfinite(val) and 0 <= val <= 150:
                return val
        except (ValueError, TypeError):
            pass
        return None

    @field_validator("reported_at", "patient_name", "patient_phone", "patient_village", "patient_sex", "facility_id", mode="before")
    @classmethod
    def validate_optional_strings(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    @field_validator("channel", mode="before")
    @classmethod
    def validate_channel(cls, v: Any) -> Optional[str]:
        if v is None:
            return "citizen_web"
        s = str(v).strip()
        return s if s else "citizen_web"

    @field_validator("symptoms", mode="before")
    @classmethod
    def validate_symptoms(cls, v: Any) -> Optional[List[str]]:
        if v is None:
            return None
        if not isinstance(v, list):
            return None
        cleaned = []
        for item in v:
            if item is not None:
                item_str = str(item).strip()
                if item_str:
                    cleaned.append(item_str)
        return cleaned


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

    @field_validator("notes", mode="before")
    @classmethod
    def validate_notes(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None
