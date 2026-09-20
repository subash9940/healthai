"""
Swasthya Setu API — main FastAPI application.

Wired for DB persistence as of the /triage endpoint integration.
"""

from contextlib import asynccontextmanager
import json
import os
import logging
import secrets

# Load .env BEFORE any module that reads os.environ (db.py does)
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg

from app.db import init_pool, close_pool, get_pool
from app.persistence import save_triage, process_sync_batch
from app.schemas.triage import TriageRequest, TriageResponse
from app.schemas.sync import SyncRequest, SyncResponse
from app.services.rules_engine import evaluate
from app.symptom_vocab import SYMPTOM_KEYS, SYMPTOM_KEY_SET
from app.facility_routes import router as facility_router
from app.sos_routes import router as sos_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB pool on startup, close on shutdown."""
    await init_pool()
    yield
    await close_pool()


app = FastAPI(title="Swasthya Setu API", lifespan=lifespan)

# Allow all origins for development and local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facility_router)
app.include_router(sos_router)


# ---------------------------------------------------------------------------
# Health Probe (D9)
# ---------------------------------------------------------------------------

@app.get("/health")
async def health(pool: asyncpg.Pool = Depends(get_pool)):
    """
    D9: Health check endpoint.
    Runs 'SELECT 1' on database pool.
    Returns 200 OK or 503 Service Unavailable.
    Requires no authentication key.
    """
    try:
        async with pool.acquire() as conn:
            val = await conn.fetchval("SELECT 1")
            if val == 1:
                return {"status": "ok", "db": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database check failed",
    )


# ---------------------------------------------------------------------------
# Sync Authentication Dependency (D7)
# ---------------------------------------------------------------------------

def verify_sync_key(x_sync_key: str | None = Header(default=None, alias="X-Sync-Key")):
    """
    D7: /sync requires header X-Sync-Key matching env SYNC_API_KEY.
    - Unset env SYNC_API_KEY -> 503 Service Unavailable
    - Missing or wrong key -> 401 Unauthorized
    """
    sync_api_key = os.getenv("SYNC_API_KEY")
    if not sync_api_key:
        logger.error("SYNC_API_KEY environment variable is not configured on server")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sync service is temporarily misconfigured or unavailable",
        )
    if not x_sync_key or not secrets.compare_digest(x_sync_key, sync_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Sync-Key authentication header",
        )
    return True


@app.post("/triage", response_model=TriageResponse)
async def triage(
    request: TriageRequest,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Deterministic triage endpoint — rule engine + DB persistence.

    1. Rule engine (evaluate) determines urgency + referral — unchanged.
    2. Persistence layer writes to triage_records (+ patients, referrals).
    3. Return response with DB-assigned IDs attached for client reference.
    """
    # 1. Deterministic rule engine — unchanged, still the source of truth
    response = evaluate(request)

    # 2. Persist — this is the part that didn't exist before
    saved = await save_triage(pool, request, response)

    # 3. Attach DB-assigned IDs so clients can reference these
    # records later (referral status polling, FHIR bundle export, etc.)
    response.triage_record_id = str(saved["triage_record_id"])
    response.patient_id = str(saved["patient_id"])
    response.referral_id = str(saved["referral_id"]) if saved["referral_id"] else None
    return response


# ---------------------------------------------------------------------------
# Sync Endpoint (D1-D8)
# ---------------------------------------------------------------------------

@app.post("/sync", response_model=SyncResponse)
async def sync_records(
    request: SyncRequest,
    _auth: bool = Depends(verify_sync_key),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Batch synchronization endpoint for ASHA mobile client outbox.
    Processes each patient and referral in its own savepoint.
    Returns per-record status (accepted / duplicate / rejected).
    """
    statuses, synced_count, overall_success = await process_sync_batch(
        pool, request.patients, request.referrals
    )

    msg = (
        f"Batch processed successfully: {synced_count} records synchronized."
        if overall_success
        else f"Batch processed with partial rejections: {synced_count} records synchronized."
    )

    return SyncResponse(
        success=overall_success,
        synced_count=synced_count,
        records=statuses,
        message=msg,
    )


# ---------------------------------------------------------------------------
# NLP Symptom Extraction (Phase 3)
# ---------------------------------------------------------------------------

class ExtractSymptomsRequest(BaseModel):
    transcript: str
    language: str = "en"  # one of: en, hi, mr, ta


class ExtractSymptomsResponse(BaseModel):
    symptoms: list[str]
    vitals_mentioned: dict[str, float | None] = {}


@app.post("/extract-symptoms", response_model=ExtractSymptomsResponse)
async def extract_symptoms(request: ExtractSymptomsRequest):
    """
    NLP symptom extraction endpoint — maps natural language transcripts
    (free-text or voice) strictly to the fixed 102-symptom vocabulary.

    LLM is used ONLY for language understanding (non-clinical task).
    Clinical severity classification remains in the deterministic rule engine.

    This endpoint calls a local LLM proxy (OmniRoute on localhost:20128) using
    the Anthropic SDK with model "kiro/auto".
    """
    from anthropic import Anthropic

    client = Anthropic(
        base_url="http://localhost:20128/v1",
        api_key="dummy-key-for-local-proxy",
    )

    system_prompt = f"""You are a clinical symptom extraction assistant for Swasthya Setu, an AI triage system for rural India.

Your ONLY job: read the patient's narrative description of symptoms (in English, Hindi, Marathi, or Tamil) and accurately extract all matching symptom keys from the official vocabulary below. Patients often speak in long, multi-sentence stories mentioning multiple symptoms and numbers.

OFFICIAL SYMPTOM KEYS (102 total):
{json.dumps(SYMPTOM_KEYS, indent=2)}

EXTRACTION RULES:
1. Output ONLY exact keys from the official list above — never invent new keys.
2. Carefully parse compound and multi-clause sentences (e.g., fever + vomiting + fast breathing) to extract ALL present symptoms.
3. Extract any vitals mentioned in the text into "vitals_mentioned" (keys: temperature_celsius, pulse_bpm, systolic_bp, diastolic_bp, respiratory_rate, spo2_percent; null if not mentioned). Convert Fahrenheit to Celsius if applicable (e.g., 102°F → 38.9°C).
4. Return ONLY a valid JSON object with the following schema:
   {{
     "symptoms": ["symptom_key_1", "symptom_key_2", ...],
     "vitals_mentioned": {{
       "temperature_celsius": float or null,
       "pulse_bpm": int or null,
       "systolic_bp": int or null,
       "diastolic_bp": int or null,
       "respiratory_rate": int or null,
       "spo2_percent": int or null
     }}
   }}

NARRATIVE EXAMPLES:
- Example 1 (Hindi multi-sentence):
  Input: "बच्चे को 2 दिन से बहुत तेज बुखार है, वह कुछ भी नहीं पी पा रहा है, बार-बार उल्टी कर रहा है और छाती में तेज सांस चल रही है।"
  Output: {{"symptoms": ["fever", "not_able_to_drink_or_feed", "vomiting", "difficult_breathing"], "vitals_mentioned": {{}}}}

- Example 2 (Marathi multi-sentence):
  Input: "माझ्या सासूबाईंना छातीत खूप कळ मारते आहे, घाम फुटला आहे, चक्कर येऊन पडल्या आणि BP 160/100 मोजला आहे."
  Output: {{"symptoms": ["chest_pain", "lethargic_or_unconscious", "headache_or_dizziness"], "vitals_mentioned": {{"systolic_bp": 160, "diastolic_bp": 100}}}}

- Example 3 (Tamil multi-sentence):
  Input: "3 வயது குழந்தைக்கு இரண்டு நாளாக கடும் காய்ச்சல், எது சாப்பிட்டாலும் வாந்தி வருது, மூச்சு விட ரொம்ப சிரமப்படுகிறான், இருமலும் இருக்கு."
  Output: {{"symptoms": ["fever", "vomiting", "difficult_breathing", "cough"], "vitals_mentioned": {{}}}}

- Example 4 (English rural clinical account):
  Input: "Pregnant mother 28 years old reporting severe headache, blurred vision, swelling on feet and face, BP checked at 155/98 mmHg."
  Output: {{"symptoms": ["headache_or_dizziness", "visual_disturbances", "swelling_face_or_hands"], "vitals_mentioned": {{"systolic_bp": 155, "diastolic_bp": 98}}}}

Now extract all symptoms and vitals from the user's input."""

    user_message = f"Language: {request.language}\nTranscript: {request.transcript}"

    try:
        message = client.messages.create(
            model="kiro/auto",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        # Find first text block (handle ThinkingBlock reasoning objects)
        text_content = next((b.text for b in message.content if hasattr(b, "text")), None)
        if not text_content:
            raise HTTPException(status_code=500, detail="LLM returned no text content")

        # Parse JSON response
        try:
            parsed = json.loads(text_content)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            if "```json" in text_content:
                json_str = text_content.split("```json")[1].split("```")[0].strip()
                parsed = json.loads(json_str)
            elif "```" in text_content:
                json_str = text_content.split("```")[1].split("```")[0].strip()
                parsed = json.loads(json_str)
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"LLM returned unparseable JSON: {text_content[:200]}"
                )

        # Validate symptoms against SYMPTOM_KEY_SET
        extracted_symptoms = parsed.get("symptoms", [])
        valid_symptoms = [s for s in extracted_symptoms if s in SYMPTOM_KEY_SET]

        if len(valid_symptoms) < len(extracted_symptoms):
            invalid = [s for s in extracted_symptoms if s not in SYMPTOM_KEY_SET]
            logger.warning(f"LLM produced invalid symptom keys: {invalid}")

        vitals = parsed.get("vitals_mentioned", {})

        return ExtractSymptomsResponse(
            symptoms=valid_symptoms,
            vitals_mentioned=vitals,
        )

    except Exception as e:
        logger.warning(f"LLM proxy extraction failed or exhausted credits ({e}). Falling back to deterministic offline NLP extractor.")
        from app.services.fallback_extractor import extract_symptoms_fallback
        fallback_res = extract_symptoms_fallback(request.transcript, request.language)
        return ExtractSymptomsResponse(
            symptoms=fallback_res["symptoms"],
            vitals_mentioned=fallback_res["vitals_mentioned"],
        )
