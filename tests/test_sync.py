"""
tests/test_sync.py

Integration tests for /health and /sync endpoints against jeevanya_test DB.
Verifies all 7 sync requirements:
1. test_health
2. test_sync_single_record
3. test_sync_idempotency
4. test_sync_urgency_mismatch
5. test_sync_partial_failure
6. test_sync_patient_linking_by_phone
7. test_sync_demo_referral_ignored
"""

import os
import uuid
import pytest
import httpx
import asyncpg
from dotenv import load_dotenv

# Ensure test DB is targeted before importing app modules
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql://subash@/jeevanya_test")
load_dotenv()

from app.main import app
from app.db import init_pool, close_pool, get_pool
from app.schemas.triage import Urgency


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Fixture to initialize and tear down connection pool for jeevanya_test."""
    pool = await init_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM referral_state_transitions WHERE 1=1;")
        await conn.execute("DELETE FROM referrals WHERE 1=1;")
        await conn.execute("DELETE FROM triage_records WHERE 1=1;")
        await conn.execute("DELETE FROM patients WHERE 1=1;")
    yield pool
    await close_pool()


@pytest.mark.asyncio
async def test_health():
    """1. GET /health returns 200 {'status': 'ok'}."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_sync_single_record():
    """2. POST /sync with 1 patient record inserts patient and triage_record and evaluates urgency."""
    client_rec_id = str(uuid.uuid4())
    client_pat_id = str(uuid.uuid4())

    payload = {
        "patients": [
            {
                "record_id": client_rec_id,
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "Ramesh Kumar",
                    "patient_village": "Ralegan Siddhi",
                    "mobile": "9876543210",
                    "patient_age_years": 35.0,
                    "patient_sex": "male",
                    "is_pregnant": False,
                    "is_postpartum": False,
                },
                "symptoms": ["chest_pain"],
                "symptom_duration_days": 1,
                "triage": {
                    "urgency": "emergency",
                    "recommended_action": "Refer to emergency",
                    "citizen_message": "Immediate care required",
                    "requires_referral": True,
                    "is_offline_evaluation": True,
                },
                "language": "en",
            }
        ],
        "referrals": [],
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/sync", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total_synced"] >= 1
        assert data["total_errors"] == 0
        assert len(data["synced_patients"]) == 1

        synced_pat = data["synced_patients"][0]
        assert synced_pat["client_record_id"] == client_rec_id
        assert synced_pat["client_patient_id"] == client_pat_id
        assert synced_pat["server_urgency"] == "emergency"
        assert synced_pat["urgency_mismatch"] is False

        # Verify in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            pat_count = await conn.fetchval("SELECT count(*) FROM patients WHERE client_patient_id = $1", client_pat_id)
            assert pat_count == 1

            triage_row = await conn.fetchrow("SELECT * FROM triage_records WHERE client_record_id = $1", client_rec_id)
            assert triage_row is not None
            assert triage_row["urgency"] == "emergency"
            assert triage_row["urgency_mismatch"] is False


@pytest.mark.asyncio
async def test_sync_idempotency():
    """3. POST the same payload twice returns same IDs and does not duplicate DB rows."""
    client_rec_id = str(uuid.uuid4())
    client_pat_id = str(uuid.uuid4())

    payload = {
        "patients": [
            {
                "record_id": client_rec_id,
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "Sita Devi",
                    "patient_village": "Hingoli",
                    "mobile": "9876543211",
                    "patient_age_years": 28.0,
                    "patient_sex": "female",
                    "is_pregnant": False,
                    "is_postpartum": False,
                },
                "symptoms": ["cough"],
                "symptom_duration_days": 2,
                "triage": {
                    "urgency": "low",
                    "recommended_action": "Home care",
                    "requires_referral": False,
                },
            }
        ],
        "referrals": [],
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # First POST
        res1 = await client.post("/sync", json=payload)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["success"] is True
        triage_id_1 = data1["synced_patients"][0]["triage_record_id"]
        patient_id_1 = data1["synced_patients"][0]["patient_id"]

        # Second POST (exact duplicate)
        res2 = await client.post("/sync", json=payload)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["success"] is True
        triage_id_2 = data2["synced_patients"][0]["triage_record_id"]
        patient_id_2 = data2["synced_patients"][0]["patient_id"]

        # Assert returned IDs match
        assert triage_id_1 == triage_id_2
        assert patient_id_1 == patient_id_2

        # Assert no duplicate rows in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            pat_count = await conn.fetchval("SELECT count(*) FROM patients WHERE client_patient_id = $1", client_pat_id)
            assert pat_count == 1
            triage_count = await conn.fetchval("SELECT count(*) FROM triage_records WHERE client_record_id = $1", client_rec_id)
            assert triage_count == 1


@pytest.mark.asyncio
async def test_sync_urgency_mismatch():
    """4. Detect and record urgency mismatch when client claimed urgency differs from server evaluated urgency."""
    client_rec_id = str(uuid.uuid4())
    client_pat_id = str(uuid.uuid4())

    # Client claims "low", but chest_pain for adult is "emergency"
    payload = {
        "patients": [
            {
                "record_id": client_rec_id,
                "patient": {
                    "patient_id": client_pat_id,
                    "patient_display_name": "Anil Deshmukh",
                    "patient_village": "Satara",
                    "mobile": "9876543212",
                    "patient_age_years": 45.0,
                    "patient_sex": "male",
                },
                "symptoms": ["chest_pain"],
                "symptom_duration_days": 1,
                "triage": {
                    "urgency": "low",  # Under-triaged by client
                    "recommended_action": "Rest",
                    "requires_referral": False,
                },
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/sync", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["mismatches_count"] == 1
        synced_pat = data["synced_patients"][0]
        assert synced_pat["client_urgency"] == "low"
        assert synced_pat["server_urgency"] == "emergency"
        assert synced_pat["urgency_mismatch"] is True

        # Verify in DB
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT urgency, client_claimed_urgency, urgency_mismatch FROM triage_records WHERE client_record_id = $1", client_rec_id)
            assert row["urgency"] == "emergency"
            assert row["client_claimed_urgency"] == "low"
            assert row["urgency_mismatch"] is True


@pytest.mark.asyncio
async def test_sync_partial_failure():
    """5. Verify partial batch failure resilience: valid record succeeds while invalid records generate errors."""
    valid_rec_id = str(uuid.uuid4())
    valid_pat_id = str(uuid.uuid4())
    invalid_rec_id = str(uuid.uuid4())
    invalid_pat_id = str(uuid.uuid4())

    payload = {
        "patients": [
            {
                "record_id": valid_rec_id,
                "patient": {
                    "patient_id": valid_pat_id,
                    "patient_display_name": "Valid Patient",
                    "patient_age_years": 30.0,
                    "patient_sex": "female",
                    "mobile": "9876543213",
                },
                "symptoms": ["cough"],
                "triage": {
                    "urgency": "low",
                },
            },
            {
                # Corrupted record: patient_age_years is 30 but symptom evaluation with invalid symptom types or DB error trigger
                "record_id": invalid_rec_id,
                "patient": {
                    "patient_id": invalid_pat_id,
                    "patient_display_name": "Invalid Record",
                    "patient_age_years": 25.0,
                    "patient_sex": "male",
                    # A non-sanitizable or mock error condition:
                    # Let's test handling by introducing duplicate client_patient_id with a non-matching unresolvable conflict or simulating DB failure
                    "mobile": "9876543214",
                },
                # Passing symptoms that might trigger error if we pass something invalid, or we test DB rollback
                "symptoms": None,  # None will fail serialization or evaluate
                "triage": {
                    "urgency": "low",
                },
            }
        ]
    }

    # If symptoms=None triggers Pydantic ValidationError or internal exception during processing
    # Let's construct a payload that passes Pydantic schema validation for the request but causes a processing error in the loop
    # In SyncPatientRecord, symptoms default is list, but if we pass an invalid symptom item or if we test per-record failure:
    payload_valid_pydantic = {
        "patients": [
            {
                "record_id": valid_rec_id,
                "patient": {
                    "patient_id": valid_pat_id,
                    "patient_display_name": "Valid Patient",
                    "patient_age_years": 30.0,
                    "patient_sex": "female",
                    "mobile": "9876543213",
                },
                "symptoms": ["cough"],
                "triage": {
                    "urgency": "low",
                },
            },
            {
                "record_id": invalid_rec_id,
                "patient": {
                    "patient_id": invalid_pat_id,
                    "patient_display_name": "Error Patient",
                    "patient_age_years": 25.0,
                    "patient_sex": "male",
                    "mobile": "9876543214",
                },
                # Let's pass invalid symptom duration that would fail or test error branch
                "symptoms": ["unknown_symptom_key"],
                "symptom_duration_days": -1,  # schema validator will catch if validated, so let's check
                "triage": {
                    "urgency": "low",
                },
            }
        ]
    }

    # Let's test with a mock error or DB constraint:
    # First insert a patient with client_patient_id = 'BLOCKED_PATIENT'
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("INSERT INTO patients (display_name, age_years, sex, client_patient_id) VALUES ('Blocked', 20, 'male', $1)", invalid_pat_id)
        # Now drop its ability to insert by creating a trigger or inserting duplicate key when not handled
        # Actually in sync_routes.py, if db_patient_id is found by client_pat_id, it reuses it.
        # But if we pass client_rec_id that already exists with different constraint, or if we pass a record that raises in evaluate:
        # What if symptoms contains None or an unhashable type inside list: e.g. ["cough", None]? Pydantic allows List[str].

    # Alternatively, let's create a test case where evaluate or DB insert raises an exception for record 2
    # For instance, patient_age_years is 30.0 for record 1, and for record 2 we simulate an error during transaction
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Let's send 1 valid patient
        res = await client.post("/sync", json={
            "patients": [
                {
                    "record_id": valid_rec_id,
                    "patient": {
                        "patient_id": valid_pat_id,
                        "patient_display_name": "Valid Patient",
                        "patient_age_years": 30.0,
                        "patient_sex": "female",
                        "mobile": "9876543213",
                    },
                    "symptoms": ["cough"],
                    "triage": {
                        "urgency": "low",
                    },
                }
            ]
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Now test partial failure by patching or sending a record where DB insert fails
        # Let's test with a mock/patched failure on one record:
        from unittest.mock import patch
        from app.services.rules_engine import evaluate as orig_evaluate

        def mock_evaluate(req):
            if req.patient_display_name == "Faulty Patient":
                raise ValueError("Simulated clinical engine failure on corrupted patient record")
            return orig_evaluate(req)

        with patch("app.sync_routes.evaluate", side_effect=mock_evaluate):
            batch_payload = {
                "patients": [
                    {
                        "record_id": str(uuid.uuid4()),
                        "patient": {
                            "patient_id": str(uuid.uuid4()),
                            "patient_display_name": "Valid Batch Patient",
                            "patient_age_years": 22.0,
                            "patient_sex": "male",
                        },
                        "symptoms": ["fever"],
                        "triage": {"urgency": "medium"},
                    },
                    {
                        "record_id": str(uuid.uuid4()),
                        "patient": {
                            "patient_id": str(uuid.uuid4()),
                            "patient_display_name": "Faulty Patient",
                            "patient_age_years": 22.0,
                            "patient_sex": "female",
                        },
                        "symptoms": ["fever"],
                        "triage": {"urgency": "medium"},
                    }
                ]
            }
            batch_res = await client.post("/sync", json=batch_payload)
            assert batch_res.status_code == 200
            bdata = batch_res.json()
            assert bdata["success"] is False
            assert bdata["total_synced"] == 1
            assert bdata["total_errors"] == 1
            assert len(bdata["synced_patients"]) == 1
            assert len(bdata["errors"]) == 1
            assert "Simulated clinical engine failure" in bdata["errors"][0]["error"]


@pytest.mark.asyncio
async def test_sync_patient_linking_by_phone():
    """6. Two records with same phone number link to the same patient row in DB."""
    phone = "9876500001"
    rec1_id = str(uuid.uuid4())
    pat1_id = str(uuid.uuid4())
    rec2_id = str(uuid.uuid4())
    pat2_id = str(uuid.uuid4())

    payload1 = {
        "patients": [
            {
                "record_id": rec1_id,
                "patient": {
                    "patient_id": pat1_id,
                    "patient_display_name": "Geeta Bai",
                    "patient_village": "Village A",
                    "mobile": phone,
                    "patient_age_years": 40.0,
                    "patient_sex": "female",
                },
                "symptoms": ["fever"],
                "triage": {"urgency": "medium"},
            }
        ]
    }

    payload2 = {
        "patients": [
            {
                "record_id": rec2_id,
                "patient": {
                    "patient_id": pat2_id,
                    "patient_display_name": "Geeta Bai (Follow-up)",
                    "patient_village": "Village A",
                    "mobile": phone,
                    "patient_age_years": 40.0,
                    "patient_sex": "female",
                },
                "symptoms": ["cough"],
                "triage": {"urgency": "low"},
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res1 = await client.post("/sync", json=payload1)
        assert res1.status_code == 200
        db_pat_id_1 = res1.json()["synced_patients"][0]["patient_id"]

        res2 = await client.post("/sync", json=payload2)
        assert res2.status_code == 200
        db_pat_id_2 = res2.json()["synced_patients"][0]["patient_id"]

        # Both triage records must be linked to the EXACT same database patient ID
        assert db_pat_id_1 == db_pat_id_2

        # Verify in DB that only 1 patient exists with this phone
        pool = get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT count(*) FROM patients WHERE phone = $1", phone)
            assert count == 1

            triage_pat_ids = await conn.fetch("SELECT patient_id FROM triage_records WHERE client_record_id = ANY($1)", [rec1_id, rec2_id])
            assert len(triage_pat_ids) == 2
            assert str(triage_pat_ids[0]["patient_id"]) == str(db_pat_id_1)
            assert str(triage_pat_ids[1]["patient_id"]) == str(db_pat_id_1)


@pytest.mark.asyncio
async def test_sync_demo_referral_ignored():
    """7. Standalone referrals with is_demo: true or REF-DEMO- prefix are ignored."""
    payload = {
        "patients": [],
        "referrals": [
            {
                "referral_id": "REF-DEMO-12345",
                "patient_id": str(uuid.uuid4()),
                "status": "created",
                "is_demo": True,
            },
            {
                "referral_id": "REF-DEMO-99999",
                "patient_id": str(uuid.uuid4()),
                "status": "created",
                "is_demo": False,
            },
            {
                "referral_id": "REF-REGULAR-12345",
                "patient_id": str(uuid.uuid4()),
                "status": "created",
                "is_demo": True,
            }
        ]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/sync", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["synced_referrals"]) == 0

        # Verify DB has 0 referrals inserted
        pool = get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT count(*) FROM referrals WHERE client_ref_id LIKE 'REF-DEMO%'")
            assert count == 0
